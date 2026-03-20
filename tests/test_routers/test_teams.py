"""Teams API 엔드포인트 테스트."""
import pytest


@pytest.mark.asyncio
async def test_list_teams(client):
    resp = await client.get("/api/teams")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["name"] == "test-team"
    assert "path" in data[0]


@pytest.mark.asyncio
async def test_delete_team(client):
    resp = await client.delete("/api/teams/test-team")
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    # 삭제 후 목록에서 사라졌는지 확인
    resp = await client.get("/api/teams")
    data = resp.json()
    assert not any(t["name"] == "test-team" for t in data)


@pytest.mark.asyncio
async def test_delete_team_not_found(client):
    resp = await client.delete("/api/teams/nonexistent-team")
    assert resp.status_code == 404
