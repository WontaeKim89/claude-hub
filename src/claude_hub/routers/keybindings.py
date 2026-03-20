"""Keybindings API."""
import json

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from claude_hub.services.editor import ConflictError

router = APIRouter(tags=["keybindings"])


class KeybindingsUpdate(BaseModel):
    data: dict
    last_mtime: float


@router.get("/keybindings")
async def get_keybindings(request: Request):
    config = request.app.state.config
    kb_path = config.paths.keybindings_path

    if not kb_path.exists():
        return {"data": {}, "last_mtime": 0.0}

    data = json.loads(kb_path.read_text(encoding="utf-8"))
    last_mtime = kb_path.stat().st_mtime
    return {"data": data, "last_mtime": last_mtime}


@router.put("/keybindings")
async def update_keybindings(body: KeybindingsUpdate, request: Request):
    editor = request.app.state.editor
    config = request.app.state.config
    kb_path = config.paths.keybindings_path

    try:
        editor.write_json(path=kb_path, data=body.data, last_mtime=body.last_mtime)
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))

    return {"ok": True}
