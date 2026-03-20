"""Marketplace 엔드포인트 테스트."""
import pytest


@pytest.mark.asyncio
async def test_list_sources(client):
    resp = await client.get("/api/marketplace/sources")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["name"] == "claude-plugins-official"


@pytest.mark.asyncio
async def test_browse_all(client):
    resp = await client.get("/api/marketplace/browse")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 2

    names = [p["name"] for p in data]
    assert "test-plugin" in names
    assert "another-plugin" in names

    test_plugin = next(p for p in data if p["name"] == "test-plugin")
    assert test_plugin["marketplace"] == "test-marketplace"
    assert test_plugin["version"] == "1.0.0"
    assert test_plugin["category"] == "development"
    assert test_plugin["installed"] is False


@pytest.mark.asyncio
async def test_browse_with_query(client):
    resp = await client.get("/api/marketplace/browse?q=another")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["name"] == "another-plugin"
