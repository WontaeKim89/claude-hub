"""Dashboard 및 Health 엔드포인트 테스트."""
import pytest


@pytest.mark.asyncio
async def test_get_dashboard(client):
    resp = await client.get("/api/dashboard")
    assert resp.status_code == 200
    data = resp.json()
    assert "skills_count" in data
    assert "agents_count" in data
    assert "projects_count" in data
    assert "mcp_servers_count" in data
    # conftest fake_claude_dir 기준: 스킬 1개, 에이전트 1개, 프로젝트 1개
    assert data["skills_count"] == 1
    assert data["agents_count"] == 1
    assert data["projects_count"] == 1


@pytest.mark.asyncio
async def test_get_health(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "results" in data
    assert isinstance(data["results"], list)
    for r in data["results"]:
        assert "valid" in r
        assert "message" in r
        assert "target" in r
