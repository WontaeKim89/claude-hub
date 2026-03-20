"""MCP Servers API."""
import json

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from claude_hub.services.editor import ConflictError

router = APIRouter(tags=["mcp"])


class McpUpdate(BaseModel):
    servers: dict  # { serverName: { command, args, env, ... } }
    last_mtime: float


@router.get("/mcp")
async def get_mcp(request: Request):
    scanner = request.app.state.scanner
    servers = scanner.read_mcp_servers()
    config = request.app.state.config
    paths = config.paths
    last_mtime = 0.0
    if paths.settings_path.exists():
        last_mtime = paths.settings_path.stat().st_mtime
    return {"servers": servers, "last_mtime": last_mtime}


@router.put("/mcp")
async def update_mcp(body: McpUpdate, request: Request):
    editor = request.app.state.editor
    config = request.app.state.config
    paths = config.paths

    # 현재 settings.json 읽기
    if paths.settings_path.exists():
        current_settings = json.loads(paths.settings_path.read_text(encoding="utf-8"))
    else:
        current_settings = {}

    current_mcp = current_settings.get("mcpServers", {})

    # *** 값은 기존 값 유지, 새 값은 덮어씀
    merged_mcp = {}
    for name, server_cfg in body.servers.items():
        merged_cfg = dict(server_cfg)
        if "env" in merged_cfg and isinstance(merged_cfg["env"], dict):
            original_env = current_mcp.get(name, {}).get("env", {})
            merged_env = {}
            for k, v in merged_cfg["env"].items():
                if v == "***":
                    merged_env[k] = original_env.get(k, "")
                else:
                    merged_env[k] = v
            merged_cfg["env"] = merged_env
        merged_mcp[name] = merged_cfg

    updated_settings = dict(current_settings)
    updated_settings["mcpServers"] = merged_mcp

    try:
        editor.write_json(
            path=paths.settings_path,
            data=updated_settings,
            last_mtime=body.last_mtime,
        )
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))

    return {"ok": True}
