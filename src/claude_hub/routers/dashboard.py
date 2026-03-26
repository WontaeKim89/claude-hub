"""Dashboard + Health API."""
from fastapi import APIRouter, Request

router = APIRouter(tags=["overview"])


@router.get("/dashboard")
async def get_dashboard(request: Request):
    scanner = request.app.state.scanner
    return scanner.get_dashboard()


@router.get("/dashboard/project-configs")
async def get_project_configs(request: Request):
    """프로젝트별 설정 파일 구성 현황."""
    from pathlib import Path
    from claude_hub.utils.paths import decode_project_path, encode_project_path

    scanner = request.app.state.scanner
    config = request.app.state.config
    projects = scanner.list_projects(include_sessions=True)
    result = []

    for p in projects:
        encoded = p["encoded"] if isinstance(p, dict) else p.encoded
        decoded = decode_project_path(encoded)
        name = decoded.rstrip("/").split("/")[-1] if "/" in decoded else encoded
        project_dir = Path(decoded) if "/" in decoded else None

        try:
            has_claude_md = project_dir and (project_dir / "CLAUDE.md").exists() if project_dir else False
        except (PermissionError, OSError):
            has_claude_md = False
        memory_dir = config.paths.projects_dir / encoded / "memory"
        has_memory = memory_dir.exists() and any(memory_dir.iterdir()) if memory_dir.exists() else False
        try:
            has_settings = project_dir and (project_dir / ".claude" / "settings.json").exists() if project_dir else False
            has_agents = project_dir and (project_dir / ".claude" / "agents").exists() if project_dir else False
            has_commands = project_dir and (project_dir / ".claude" / "commands").exists() if project_dir else False
        except (PermissionError, OSError):
            has_settings = False
            has_agents = False
            has_commands = False

        item_count = sum([has_claude_md, has_memory, has_settings, has_agents, has_commands])
        result.append({
            "name": name,
            "encoded": encoded,
            "path": decoded,
            "claude_md": has_claude_md,
            "memory": has_memory,
            "settings": has_settings,
            "agents": has_agents,
            "commands": has_commands,
            "count": item_count,
            "total": 5,
        })

    result.sort(key=lambda x: (-x["count"], x["name"]))
    return result


@router.get("/health")
async def get_health(request: Request):
    validator = request.app.state.validator
    config = request.app.state.config
    results = validator.validate_all(config.claude_dir)
    return {"results": [{"valid": r.valid, "message": r.message, "target": r.target} for r in results]}
