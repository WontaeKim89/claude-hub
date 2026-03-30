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
async def test_browse_mcp_returns_homepage(client):
    """MCP 서버 목록이 JSON 파일에서 로드되고 homepage 필드를 포함하는지 검증."""
    resp = await client.get("/api/marketplace/mcp")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 10

    github_server = next(s for s in data if s["name"] == "github")
    assert github_server["homepage"] != ""
    assert github_server["package"] == "@modelcontextprotocol/server-github"
    assert "installed" in github_server
