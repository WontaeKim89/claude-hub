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

    # 프로젝트별 CLAUDE.md — 그룹 구조 (메인 + 워크트리)
    from pathlib import Path
    from claude_hub.utils.paths import decode_project_path
    scanner = request.app.state.scanner
    grouped = scanner.list_projects_grouped()

    for group in grouped:
        # 메인 프로젝트
        main = group.get("main")
        if main:
            encoded = main["encoded"]
            decoded = decode_project_path(encoded)
            project_name = decoded.rstrip("/").split("/")[-1] if "/" in decoded else encoded
            project_claude_md = paths.projects_dir / encoded / "CLAUDE.md"
            entries.append({
                "scope": encoded,
                "decoded_path": decoded,
                "project_name": project_name,
                "is_worktree": False,
                "parent": None,
                "path": str(project_claude_md),
                "exists": project_claude_md.exists(),
            })
            # 워크트리들
            for wt in group.get("worktrees", []):
                wt_encoded = wt["encoded"]
                wt_decoded = decode_project_path(wt_encoded)
                wt_name = wt_decoded.rstrip("/").split("/")[-1] if "/" in wt_decoded else wt_encoded
                wt_claude_md = paths.projects_dir / wt_encoded / "CLAUDE.md"
                entries.append({
                    "scope": wt_encoded,
                    "decoded_path": wt_decoded,
                    "project_name": wt_name,
                    "is_worktree": True,
                    "parent": project_name,
                    "path": str(wt_claude_md),
                    "exists": wt_claude_md.exists(),
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
