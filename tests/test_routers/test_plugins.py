"""Plugins 엔드포인트 테스트."""
import pytest


@pytest.mark.asyncio
async def test_list_plugins(client):
    resp = await client.get("/api/plugins")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 1

    plugin = data[0]
    assert plugin["name"] == "superpowers"
    assert plugin["marketplace"] == "claude-plugins-official"
    assert plugin["version"] == "5.0.2"
    assert plugin["source_type"] == "official"
    assert plugin["enabled"] is True
    assert "assets" in plugin


@pytest.mark.asyncio
async def test_toggle_plugin(client):
    # 현재 enabled=True → False 로 토글
    resp = await client.put(
        "/api/plugins/superpowers/toggle",
        json={"enabled": False},
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    # 다시 조회해서 반영 확인
    list_resp = await client.get("/api/plugins")
    plugin = next(p for p in list_resp.json() if p["name"] == "superpowers")
    assert plugin["enabled"] is False


@pytest.mark.asyncio
async def test_toggle_plugin_not_found(client):
    resp = await client.put(
        "/api/plugins/nonexistent/toggle",
        json={"enabled": True},
    )
    assert resp.status_code == 404
