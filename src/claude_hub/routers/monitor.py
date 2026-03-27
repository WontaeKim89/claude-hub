"""실시간 세션 모니터링 SSE 엔드포인트."""
import asyncio
import json

from fastapi import APIRouter, Request
from starlette.responses import StreamingResponse

from claude_hub.utils.paths import decode_project_path

router = APIRouter(tags=["monitor"])


@router.get("/monitor/stream")
async def monitor_stream(request: Request):
    """SSE 스트림으로 활성 세션 이벤트를 실시간 전송."""
    watcher = request.app.state.session_watcher

    async def event_generator():
        while True:
            if await request.is_disconnected():
                break
            events = await watcher.poll_new_lines()
            for event in events:
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
            if not events:
                # keepalive comment (브라우저 타임아웃 방지)
                yield ": keepalive\n\n"
            await asyncio.sleep(1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/monitor/active")
async def active_sessions(request: Request):
    """현재 추적 중인 활성 세션 목록 (idle timeout 이내에 데이터가 들어온 세션만)."""
    watcher = request.app.state.session_watcher
    result = []
    for key, watched in watcher._watched.items():
        try:
            stat = watched.path.stat()
            result.append({
                "session_id": watched.path.stem,
                "project": watched.path.parent.name,
                "project_path": decode_project_path(watched.path.parent.name),
                "modified": stat.st_mtime,
                "size": stat.st_size,
            })
        except OSError:
            continue
    result.sort(key=lambda x: x["modified"], reverse=True)
    return result
