"""백업 이력 조회 및 복원 엔드포인트."""
import json

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from claude_hub.utils.diff import unified_diff

router = APIRouter(tags=["backups"])


@router.get("/backups")
async def list_backups(request: Request):
    backup = request.app.state.backup
    return {"history": backup.list_history()}


@router.post("/backups/{backup_id}/restore")
async def restore_backup(backup_id: str, request: Request):
    backup = request.app.state.backup
    try:
        backup.restore(backup_id)
        return {"restored": True, "backup_id": backup_id}
    except (ValueError, FileNotFoundError) as e:
        raise HTTPException(status_code=404, detail=str(e))


class DiffRequest(BaseModel):
    target: str
    scope: str
    content: str | dict


@router.post("/preview-diff")
async def preview_diff(body: DiffRequest, request: Request):
    config = request.app.state.config

    if body.target == "settings":
        path = config.paths.settings_path if body.scope == "global" else config.paths.settings_local_path
    elif body.target == "claude-md":
        path = config.paths.claude_md_path if body.scope == "global" else config.paths.projects_dir / body.scope / "CLAUDE.md"
    elif body.target == "skill":
        path = config.paths.skills_dir / body.scope / "SKILL.md"
    elif body.target == "agent":
        path = config.paths.agents_dir / f"{body.scope}.md"
    else:
        path = config.paths.claude_dir / body.scope

    old_content = path.read_text() if path.exists() else ""
    new_content = json.dumps(body.content, indent=2, ensure_ascii=False) if isinstance(body.content, dict) else body.content

    diff = unified_diff(old_content, new_content, filename=path.name)
    return {"diff": diff, "target_path": str(path)}
