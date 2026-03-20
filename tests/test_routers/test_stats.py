import pytest
from httpx import ASGITransport, AsyncClient

from claude_hub.config import AppConfig
from claude_hub.main import create_app


@pytest.fixture
def app(fake_claude_dir, tmp_path):
    config = AppConfig(claude_dir=fake_claude_dir)
    config._backup_dir_override = tmp_path / "hub"
    return create_app(config)


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_stats_overview(client):
    resp = await client.get("/api/stats/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_events" in data
    assert "unique_skills_used" in data
    assert "unique_plugins_used" in data


@pytest.mark.asyncio
async def test_stats_record_and_query(client):
    await client.post("/api/stats/record", json={"type": "skill", "name": "gen-pr"})
    await client.post("/api/stats/record", json={"type": "skill", "name": "gen-pr"})
    await client.post("/api/stats/record", json={"type": "plugin", "name": "superpowers"})

    resp = await client.get("/api/stats/skills")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["name"] == "gen-pr"
    assert data[0]["hit_count"] == 2


@pytest.mark.asyncio
async def test_stats_plugins(client):
    await client.post("/api/stats/record", json={"type": "plugin", "name": "superpowers"})
    await client.post("/api/stats/record", json={"type": "plugin", "name": "superpowers"})

    resp = await client.get("/api/stats/plugins")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["name"] == "superpowers"


@pytest.mark.asyncio
async def test_stats_timeline(client):
    await client.post("/api/stats/record", json={"type": "skill", "name": "test"})
    resp = await client.get("/api/stats/timeline")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    if data:
        assert "date" in data[0]
        assert "total" in data[0]


@pytest.mark.asyncio
async def test_stats_unused(client):
    resp = await client.get("/api/stats/unused")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_stats_sync(client, fake_claude_dir, tmp_path):
    # 테스트용 jsonl 파일 생성
    import json
    project_dir = fake_claude_dir / "projects" / "-Users-test-Desktop-myproject"
    project_dir.mkdir(parents=True, exist_ok=True)
    session_file = project_dir / "session.jsonl"
    entry = {
        "role": "assistant",
        "session_id": "test-session-1",
        "content": [
            {
                "type": "tool_use",
                "name": "Skill",
                "input": {"skill": "gen-pr"},
            }
        ],
    }
    session_file.write_text(json.dumps(entry) + "\n", encoding="utf-8")

    resp = await client.post("/api/stats/sync")
    assert resp.status_code == 200
    result = resp.json()
    assert result["files_parsed"] >= 1
    assert result["events_found"] >= 1
    assert result["errors"] == 0
