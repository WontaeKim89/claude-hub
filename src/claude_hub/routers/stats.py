"""사용 통계 API."""
from fastapi import APIRouter, Request

router = APIRouter(tags=["stats"])


@router.get("/stats/overview")
async def stats_overview(request: Request):
    db = request.app.state.usage_db
    return db.get_overview()


@router.get("/stats/skills")
async def stats_skills(request: Request, limit: int = 10, days: int = 30):
    db = request.app.state.usage_db
    return db.get_top_skills(limit, days=days)


@router.get("/stats/plugins")
async def stats_plugins(request: Request, limit: int = 10, days: int = 30):
    db = request.app.state.usage_db
    return db.get_top_plugins(limit, days=days)


@router.get("/stats/unused")
async def stats_unused(request: Request, days: int = 30):
    db = request.app.state.usage_db
    return db.get_unused_items(days)


@router.get("/stats/timeline")
async def stats_timeline(request: Request, days: int = 30):
    db = request.app.state.usage_db
    return db.get_timeline(days)


@router.post("/stats/record")
async def stats_record(request: Request):
    """Hook tracker가 호출하는 엔드포인트."""
    body = await request.json()
    db = request.app.state.usage_db
    db.record_event(
        type=body.get("type", "skill"),
        name=body.get("name", ""),
        project=body.get("project"),
        session_id=body.get("session_id"),
        metadata=body.get("metadata"),
    )
    return {"ok": True}


@router.post("/stats/sync")
async def stats_sync(request: Request):
    """세션 로그에서 과거 데이터 소급 파싱."""
    from claude_hub.services.log_parser import parse_session_logs
    config = request.app.state.config
    db = request.app.state.usage_db
    result = parse_session_logs(config.paths, db)
    return result
