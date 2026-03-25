"""Hooks API - settings.json의 hooks 섹션 관리."""
import json

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from claude_hub.services.editor import ConflictError

router = APIRouter(tags=["hooks"])


class HooksUpdate(BaseModel):
    hooks: dict
    last_mtime: float


@router.get("/hooks")
async def get_hooks(request: Request):
    scanner = request.app.state.scanner
    config = request.app.state.config
    settings_path = config.paths.settings_path

    hooks = scanner.read_hooks()
    last_mtime = settings_path.stat().st_mtime if settings_path.exists() else 0.0

    return {"hooks": hooks, "last_mtime": last_mtime}


@router.put("/hooks")
async def update_hooks(body: HooksUpdate, request: Request):
    editor = request.app.state.editor
    config = request.app.state.config
    settings_path = config.paths.settings_path

    # 현재 settings.json 읽기
    if settings_path.exists():
        current_settings = json.loads(settings_path.read_text())
    else:
        current_settings = {}

    # hooks 섹션만 교체
    current_settings["hooks"] = body.hooks

    try:
        editor.write_json(path=settings_path, data=current_settings, last_mtime=body.last_mtime)
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))

    # settings.json 캐시 무효화
    from claude_hub.services.scanner import _cache
    _cache.pop("settings_json", None)

    return {"ok": True}
