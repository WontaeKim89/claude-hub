"""Marketplace API."""
import json

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from claude_hub.services.editor import ConflictError
from claude_hub.services.scanner import invalidate_settings_cache

router = APIRouter(tags=["marketplace"])


class McpInstallRequest(BaseModel):
    name: str
    package: str


@router.get("/marketplace/sources")
async def list_sources(request: Request):
    marketplace = request.app.state.marketplace
    return marketplace.list_sources()


@router.get("/marketplace/browse")
async def browse(
    request: Request,
    source: str | None = None,
    q: str | None = None,
    category: str | None = None,
):
    marketplace = request.app.state.marketplace
    return marketplace.browse(source=source, query=q, category=category)


@router.get("/marketplace/mcp")
async def marketplace_mcp(request: Request):
    """MCP 서버 마켓플레이스."""
    marketplace = request.app.state.marketplace
    return marketplace.browse_mcp()


@router.post("/marketplace/mcp/install")
async def install_mcp(body: McpInstallRequest, request: Request):
    """MCP 서버를 settings.json의 mcpServers에 추가."""
    config = request.app.state.config
    editor = request.app.state.editor
    paths = config.paths

    if paths.settings_path.exists():
        settings = json.loads(paths.settings_path.read_text(encoding="utf-8"))
        last_mtime = paths.settings_path.stat().st_mtime
    else:
        settings = {}
        last_mtime = 0.0

    mcp_servers = settings.setdefault("mcpServers", {})
    if body.name in mcp_servers:
        raise HTTPException(status_code=409, detail=f"'{body.name}' is already installed")

    mcp_servers[body.name] = {
        "command": "npx",
        "args": ["-y", body.package],
    }

    try:
        editor.write_json(path=paths.settings_path, data=settings, last_mtime=last_mtime)
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))

    invalidate_settings_cache()
    return {"ok": True, "name": body.name}


@router.delete("/marketplace/mcp/{name}")
async def uninstall_mcp(name: str, request: Request):
    """MCP 서버를 settings.json에서 제거."""
    config = request.app.state.config
    editor = request.app.state.editor
    paths = config.paths

    if not paths.settings_path.exists():
        raise HTTPException(status_code=404, detail="settings.json not found")

    settings = json.loads(paths.settings_path.read_text(encoding="utf-8"))
    last_mtime = paths.settings_path.stat().st_mtime
    mcp_servers = settings.get("mcpServers", {})

    if name not in mcp_servers:
        raise HTTPException(status_code=404, detail=f"'{name}' not found")

    del mcp_servers[name]
    settings["mcpServers"] = mcp_servers

    try:
        editor.write_json(path=paths.settings_path, data=settings, last_mtime=last_mtime)
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))

    invalidate_settings_cache()
    return {"ok": True, "name": name}
