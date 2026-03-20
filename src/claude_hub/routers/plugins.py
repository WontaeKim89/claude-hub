"""Plugins API."""
import asyncio
import json

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from claude_hub.models.plugin import PluginSummary, PluginToggle
from claude_hub.services.editor import ConflictError

router = APIRouter(tags=["plugins"])


class PluginInstall(BaseModel):
    name: str
    marketplace: str


@router.get("/plugins", response_model=list[PluginSummary])
async def list_plugins(request: Request):
    scanner = request.app.state.scanner
    return scanner.scan_plugins()


@router.put("/plugins/{name}/toggle")
async def toggle_plugin(name: str, body: PluginToggle, request: Request):
    scanner = request.app.state.scanner
    editor = request.app.state.editor
    config = request.app.state.config

    settings_path = config.paths.settings_path
    if not settings_path.exists():
        raise HTTPException(status_code=404, detail="settings.json 없음")

    last_mtime = settings_path.stat().st_mtime
    settings = json.loads(settings_path.read_text())

    # installed_plugins.json (v2) 에서 플러그인의 marketplace 정보 조회
    installed_path = config.paths.installed_plugins_path
    marketplace = None
    if installed_path.exists():
        raw = json.loads(installed_path.read_text())
        plugins_dict = raw.get("plugins", {}) if isinstance(raw, dict) else {}
        for key in plugins_dict:
            plugin_name = key.split("@", 1)[0]
            if plugin_name == name:
                marketplace = key.split("@", 1)[1] if "@" in key else ""
                break

    if marketplace is None:
        raise HTTPException(status_code=404, detail=f"플러그인 없음: {name}")

    plugin_key = f"{name}@{marketplace}"
    enabled_plugins = settings.get("enabledPlugins", {})
    enabled_plugins[plugin_key] = body.enabled
    settings["enabledPlugins"] = enabled_plugins

    try:
        editor.write_json(path=settings_path, data=settings, last_mtime=last_mtime)
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))

    return {"ok": True}


@router.post("/plugins/install", status_code=201)
async def install_plugin(body: PluginInstall):
    proc = await asyncio.create_subprocess_exec(
        "claude", "plugin", "install", f"{body.name}@{body.marketplace}",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail=stderr.decode().strip() or "플러그인 설치 실패",
        )
    return {"ok": True, "output": stdout.decode().strip()}


@router.delete("/plugins/{name}")
async def remove_plugin(name: str):
    proc = await asyncio.create_subprocess_exec(
        "claude", "plugin", "remove", name,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail=stderr.decode().strip() or "플러그인 제거 실패",
        )
    return {"ok": True, "output": stdout.decode().strip()}
