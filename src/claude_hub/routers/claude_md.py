"""CLAUDE.md 관리 API."""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter(tags=["claude-md"])


class ClaudeMdUpdate(BaseModel):
    content: str


@router.get("/claude-md")
async def list_claude_md(request: Request):
    config = request.app.state.config
    paths = config.paths

    entries = []

    # 글로벌 CLAUDE.md
    global_path = paths.claude_md_path
    entries.append({
        "scope": "global",
        "label": "Global (~/.claude/CLAUDE.md)",
        "path": str(global_path),
        "exists": global_path.exists(),
    })

    # 프로젝트별 CLAUDE.md
    scanner = request.app.state.scanner
    for project in scanner.list_projects():
        # 프로젝트 디렉토리 내 CLAUDE.md
        from pathlib import Path
        project_claude_md = Path(project["memory_dir"]).parent.parent / "CLAUDE.md"
        entries.append({
            "scope": project["encoded"],
            "label": project["decoded"],
            "path": str(project_claude_md),
            "exists": project_claude_md.exists(),
        })

    return entries


@router.get("/claude-md/{scope}")
async def get_claude_md(scope: str, request: Request):
    config = request.app.state.config
    path = _resolve_scope(scope, config)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"CLAUDE.md 없음: {scope}")
    return {"scope": scope, "content": path.read_text(encoding="utf-8"), "path": str(path)}


@router.put("/claude-md/{scope}")
async def update_claude_md(scope: str, body: ClaudeMdUpdate, request: Request):
    config = request.app.state.config
    editor = request.app.state.editor
    path = _resolve_scope(scope, config)
    editor.write_text(path, body.content)
    return {"ok": True}


def _resolve_scope(scope: str, config):
    """scope 값으로 실제 CLAUDE.md 경로를 반환."""
    from pathlib import Path

    paths = config.paths
    if scope == "global":
        return paths.claude_md_path

    # scope는 projects 디렉토리 내 인코딩된 프로젝트명
    project_dir = paths.projects_dir / scope
    return project_dir / "CLAUDE.md"
