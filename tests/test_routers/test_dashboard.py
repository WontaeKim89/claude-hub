"""Dashboard 및 Health 엔드포인트 테스트."""
import pytest


@pytest.mark.asyncio
async def test_get_dashboard(client):
    resp = await client.get("/api/dashboard")
    assert resp.status_code == 200
    data = resp.json()
    assert "skills" in data
    assert "plugins" in data
    assert "hooks" in data
    assert "agents" in data
    assert "projects" in data
    assert data["skills"]["total"] >= 1
    assert data["agents"]["total"] >= 1


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
