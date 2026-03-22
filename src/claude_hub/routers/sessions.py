"""세션 브라우저 API."""
from fastapi import APIRouter, HTTPException, Request

router = APIRouter(tags=["sessions"])


@router.get("/sessions")
async def list_sessions_endpoint(request: Request, project: str | None = None):
    from claude_hub.services.session_browser import list_sessions
    config = request.app.state.config
    sessions = list_sessions(config.paths, project_encoded=project)
    return sessions


@router.get("/sessions/{session_id}/messages")
async def get_session_messages_endpoint(
    session_id: str,
    request: Request,
    project: str | None = None,
    limit: int = 200,
):
    from claude_hub.services.session_browser import get_session_messages
    config = request.app.state.config
    projects_dir = config.paths.projects_dir
    session_file = None
    if project:
        candidate = projects_dir / project / f"{session_id}.jsonl"
        if candidate.exists():
            session_file = str(candidate)
    else:
        for jsonl in projects_dir.rglob(f"{session_id}.jsonl"):
            session_file = str(jsonl)
            break
    if not session_file:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = get_session_messages(session_file, limit=limit)
    return {"session_id": session_id, "messages": messages}


@router.delete("/sessions/{session_id}")
async def delete_session_endpoint(session_id: str, request: Request):
    from claude_hub.services.session_browser import delete_session
    config = request.app.state.config
    for jsonl in config.paths.projects_dir.rglob(f"{session_id}.jsonl"):
        if delete_session(str(jsonl)):
            return {"deleted": True, "session_id": session_id}
    raise HTTPException(status_code=404, detail="Session not found")
