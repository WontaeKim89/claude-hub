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
async def test_browse_returns_extended_fields(client):
    """browse()가 homepage, source_url, author, tags 필드를 반환하는지 검증."""
    resp = await client.get("/api/marketplace/browse")
    assert resp.status_code == 200
    data = resp.json()

    test_plugin = next(p for p in data if p["name"] == "test-plugin")
    assert test_plugin["homepage"] == "https://github.com/test/test-plugin"
    assert test_plugin["source_url"] == "https://github.com/test/test-plugin.git"
    assert test_plugin["author"] == "Test Author"
    assert test_plugin["tags"] == ["testing", "development"]

    # 필드가 없는 플러그인은 빈 기본값
    another = next(p for p in data if p["name"] == "another-plugin")
    assert another["homepage"] == ""
    assert another["source_url"] == ""
    assert another["author"] == ""
    assert another["tags"] == []


@pytest.mark.asyncio
async def test_browse_with_query(client):
    resp = await client.get("/api/marketplace/browse?q=another")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["name"] == "another-plugin"


@pytest.mark.asyncio
async def test_browse_mcp_returns_wrapped_response(client):
    """browse_mcp()가 서버 리스트 + 메타데이터를 포함한 객체를 반환하는지 검증."""
    resp = await client.get("/api/marketplace/mcp")
    assert resp.status_code == 200
    data = resp.json()

    assert "servers" in data
    assert "source" in data
    assert "updated_at" in data
    assert isinstance(data["servers"], list)
    assert data["source"] in ("registry_cache", "fallback", "error")


@pytest.mark.asyncio
async def test_browse_mcp_fallback_when_no_cache(client, fake_claude_dir):
    """캐시 파일 없을 때 기존 mcp_servers.json 폴백."""
    cache_path = fake_claude_dir / "hub" / "mcp_registry_cache.json"
    if cache_path.exists():
        cache_path.unlink()

    resp = await client.get("/api/marketplace/mcp")
    assert resp.status_code == 200
    data = resp.json()
    assert data["source"] == "fallback"
    assert len(data["servers"]) >= 10
