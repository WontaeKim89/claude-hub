"""Settings API."""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from claude_hub.services.editor import ConflictError

router = APIRouter(tags=["settings"])


class SettingsUpdate(BaseModel):
    data: dict
    last_mtime: float


@router.get("/settings")
async def get_settings(request: Request):
    scanner = request.app.state.scanner
    return scanner.read_settings()


@router.put("/settings")
async def update_settings(body: SettingsUpdate, request: Request):
    editor = request.app.state.editor
    config = request.app.state.config
    settings_path = config.paths.settings_path
    try:
        editor.write_json(path=settings_path, data=body.data, last_mtime=body.last_mtime)
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))
    from claude_hub.services.scanner import invalidate_settings_cache
    invalidate_settings_cache()
    return {"ok": True}
