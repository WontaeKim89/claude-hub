"""실시간 모니터링 API 테스트."""
import json
import time

import pytest
from httpx import ASGITransport, AsyncClient

from claude_hub.config import AppConfig
from claude_hub.main import create_app
from claude_hub.services.session_watcher import SessionWatcher


@pytest.fixture
def app(fake_claude_dir):
    return create_app(AppConfig(claude_dir=fake_claude_dir))


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_active_sessions_empty(client):
    resp = await client.get("/api/monitor/active")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_active_sessions_with_recent_file(client, fake_claude_dir, app):
    """최근 수정된 JSONL 파일이 poll 후 활성 세션으로 인식되는지 확인."""
    project_dir = fake_claude_dir / "projects" / "-Users-test-Desktop-myproject"
    project_dir.mkdir(parents=True, exist_ok=True)
    session_file = project_dir / "test-session-123.jsonl"
    session_file.write_text(
        json.dumps({"role": "user", "content": "hello"}) + "\n"
    )

    # poll을 한번 호출해서 watcher가 세션을 등록하게 함
    await app.state.session_watcher.poll_new_lines()

    resp = await client.get("/api/monitor/active")
    assert resp.status_code == 200
    sessions = resp.json()
    assert len(sessions) == 1
    assert sessions[0]["session_id"] == "test-session-123"


@pytest.mark.asyncio
async def test_watcher_poll_new_lines(fake_claude_dir):
    """Watcher가 새로 추가된 줄을 감지하는지 확인."""
    from claude_hub.utils.paths import ClaudePaths
    paths = ClaudePaths(claude_dir=fake_claude_dir)
    watcher = SessionWatcher(paths=paths)

    project_dir = fake_claude_dir / "projects" / "-Users-test-Desktop-myproject"
    project_dir.mkdir(parents=True, exist_ok=True)
    session_file = project_dir / "watcher-test.jsonl"

    # 초기 내용 작성
    session_file.write_text(
        json.dumps({"role": "user", "content": "initial"}) + "\n"
    )

    # 첫 poll: 파일 발견, session_active 이벤트
    events = await watcher.poll_new_lines()
    active_events = [e for e in events if e["type"] == "session_active"]
    assert len(active_events) == 1
    assert active_events[0]["session_id"] == "watcher-test"

    # 새 줄 추가
    with open(session_file, "a") as f:
        f.write(json.dumps({"message": {"role": "assistant", "content": [
            {"type": "text", "text": "Hello!"},
            {"type": "tool_use", "name": "Read", "input": {"file_path": "/tmp/test.py"}},
        ], "model": "claude-sonnet-4-6"}}) + "\n")

    # 두 번째 poll: 새 메시지 이벤트
    events = await watcher.poll_new_lines()
    msg_events = [e for e in events if e["type"] == "message"]
    assert len(msg_events) == 1
    assert msg_events[0]["role"] == "assistant"
    assert msg_events[0]["text_preview"] == "Hello!"
    assert len(msg_events[0]["tools"]) == 1
    assert msg_events[0]["tools"][0]["name"] == "Read"
    assert "/tmp/test.py" in msg_events[0]["tools"][0]["summary"]


@pytest.mark.asyncio
async def test_watcher_session_ended_by_idle(fake_claude_dir):
    """idle timeout이 지나면 session_ended 이벤트가 발생하는지 확인."""
    from claude_hub.utils.paths import ClaudePaths
    paths = ClaudePaths(claude_dir=fake_claude_dir)
    # idle_timeout을 충분히 줘서 첫 poll에서 등록되게 하고, 두 번째에서 만료시킴
    watcher = SessionWatcher(paths=paths, idle_timeout=60)

    project_dir = fake_claude_dir / "projects" / "-Users-test-Desktop-myproject"
    project_dir.mkdir(parents=True, exist_ok=True)
    session_file = project_dir / "idle-session.jsonl"
    session_file.write_text(json.dumps({"role": "user", "content": "hi"}) + "\n")

    # 첫 poll: 세션 발견 → session_active
    events = await watcher.poll_new_lines()
    active_events = [e for e in events if e["type"] == "session_active"]
    assert len(active_events) == 1

    # last_change를 과거로 강제 설정하여 idle 만료 시뮬레이션
    key = list(watcher._watched.keys())[0]
    watcher._watched[key].last_change = time.time() - 120

    # 두 번째 poll: idle 판정 → session_ended
    events = await watcher.poll_new_lines()
    ended_events = [e for e in events if e["type"] == "session_ended"]
    assert len(ended_events) == 1
    assert ended_events[0]["session_id"] == "idle-session"


@pytest.mark.asyncio
async def test_notification_response_complete(fake_claude_dir):
    """stop_reason=end_turn 시 즉시 response_complete 알림이 발생하는지 확인."""
    from claude_hub.utils.paths import ClaudePaths
    paths = ClaudePaths(claude_dir=fake_claude_dir)
    watcher = SessionWatcher(paths=paths)

    project_dir = fake_claude_dir / "projects" / "-Users-test-Desktop-myproject"
    project_dir.mkdir(parents=True, exist_ok=True)
    session_file = project_dir / "notify-test.jsonl"
    session_file.write_text("")

    await watcher.poll_new_lines()

    # stop_reason: end_turn → 즉시 알림
    with open(session_file, "a") as f:
        f.write(json.dumps({"message": {
            "role": "assistant", "content": "Done!", "model": "claude-sonnet-4-6",
            "stop_reason": "end_turn",
        }}) + "\n")

    events = await watcher.poll_new_lines()
    notif_events = [e for e in events if e["type"] == "notification"]
    assert len(notif_events) == 1
    assert notif_events[0]["reason"] == "response_complete"
    assert "Response complete" in notif_events[0]["title"]
    assert "Done!" in notif_events[0]["body"]


@pytest.mark.asyncio
async def test_notification_needs_input(fake_claude_dir):
    """tool_use 후 결과가 오지 않으면 needs_input 알림이 발생하는지 확인."""
    from claude_hub.utils.paths import ClaudePaths
    paths = ClaudePaths(claude_dir=fake_claude_dir)
    watcher = SessionWatcher(paths=paths)

    project_dir = fake_claude_dir / "projects" / "-Users-test-Desktop-myproject"
    project_dir.mkdir(parents=True, exist_ok=True)
    session_file = project_dir / "permission-test.jsonl"
    session_file.write_text("")

    await watcher.poll_new_lines()

    # stop_reason: tool_use → permission 대기 가능
    with open(session_file, "a") as f:
        f.write(json.dumps({"message": {
            "role": "assistant",
            "content": [{"type": "tool_use", "name": "Bash", "input": {"command": "rm -rf /"}}],
            "model": "claude-sonnet-4-6",
            "stop_reason": "tool_use",
        }}) + "\n")

    events = await watcher.poll_new_lines()
    # 아직 알림 없음 (PERMISSION_WAIT 대기)
    assert len([e for e in events if e["type"] == "notification"]) == 0

    # pending_tool_use_at를 과거로 밀어서 즉시 트리거
    key = list(watcher._watched.keys())[0]
    watcher._watched[key].pending_tool_use_at = time.time() - 10

    events = await watcher.poll_new_lines()
    notif_events = [e for e in events if e["type"] == "notification"]
    assert len(notif_events) == 1
    assert notif_events[0]["reason"] == "needs_input"
    assert "Permission needed" in notif_events[0]["title"]


@pytest.mark.asyncio
async def test_no_permission_notif_when_tool_result_arrives(fake_claude_dir):
    """tool_use 후 tool_result가 오면 permission 알림이 발생하지 않는지 확인."""
    from claude_hub.utils.paths import ClaudePaths
    paths = ClaudePaths(claude_dir=fake_claude_dir)
    watcher = SessionWatcher(paths=paths)

    project_dir = fake_claude_dir / "projects" / "-Users-test-Desktop-myproject"
    project_dir.mkdir(parents=True, exist_ok=True)
    session_file = project_dir / "auto-tool.jsonl"
    session_file.write_text("")

    await watcher.poll_new_lines()

    # tool_use + 바로 tool_result → 자동 실행됨
    with open(session_file, "a") as f:
        f.write(json.dumps({"message": {
            "role": "assistant",
            "content": [{"type": "tool_use", "name": "Read", "input": {"file_path": "/tmp/x"}}],
            "stop_reason": "tool_use",
        }}) + "\n")
        f.write(json.dumps({"type": "tool_result", "content": "file content"}) + "\n")

    events = await watcher.poll_new_lines()
    # tool_result가 왔으므로 pending 리셋 → permission 알림 없음
    key = list(watcher._watched.keys())[0]
    assert watcher._watched[key].pending_tool_use_at == 0.0


@pytest.mark.asyncio
async def test_tool_summary():
    """_summarize_tool 함수 동작 확인."""
    from claude_hub.services.session_watcher import _summarize_tool

    assert _summarize_tool("Read", {"file_path": "/tmp/test.py"}) == "/tmp/test.py"
    assert _summarize_tool("Bash", {"command": "ls -la"}) == "ls -la"
    assert _summarize_tool("Grep", {"pattern": "TODO"}) == "/TODO/"
    assert _summarize_tool("Skill", {"skill": "gen-pr"}) == "gen-pr"
    assert _summarize_tool("Agent", {"description": "test agent"}) == "test agent"
