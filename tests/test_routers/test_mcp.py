"""MCP Servers 엔드포인트 테스트."""
import pytest


@pytest.mark.asyncio
async def test_get_mcp_masked(client):
    resp = await client.get("/api/mcp")
    assert resp.status_code == 200
    data = resp.json()
    assert "servers" in data
    assert "last_mtime" in data

    github = next((s for s in data["servers"] if s["name"] == "github"), None)
    assert github is not None
    # 민감 키(TOKEN)는 마스킹되어야 함
    assert github["env"]["GITHUB_PERSONAL_ACCESS_TOKEN"] == "***"


@pytest.mark.asyncio
async def test_update_mcp_preserve_masked(client):
    # 현재 상태 조회
    get_resp = await client.get("/api/mcp")
    last_mtime = get_resp.json()["last_mtime"]

    # *** 값 그대로 전송 → 기존 값 보존
    put_resp = await client.put(
        "/api/mcp",
        json={
            "servers": {
                "github": {
                    "command": "npx",
                    "args": ["-y", "@modelcontextprotocol/server-github"],
                    "env": {"GITHUB_PERSONAL_ACCESS_TOKEN": "***"},
                }
            },
            "last_mtime": last_mtime,
        },
    )
    assert put_resp.status_code == 200
    assert put_resp.json()["ok"] is True

    # 저장 후 다시 조회하면 여전히 마스킹 상태
    get_resp2 = await client.get("/api/mcp")
    github = next((s for s in get_resp2.json()["servers"] if s["name"] == "github"), None)
    assert github["env"]["GITHUB_PERSONAL_ACCESS_TOKEN"] == "***"


@pytest.mark.asyncio
async def test_update_mcp_new_value(client):
    get_resp = await client.get("/api/mcp")
    last_mtime = get_resp.json()["last_mtime"]

    # 새 값 전송 → 덮어씀
    put_resp = await client.put(
        "/api/mcp",
        json={
            "servers": {
                "github": {
                    "command": "npx",
                    "args": ["-y", "@modelcontextprotocol/server-github"],
                    "env": {"GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_newtoken"},
                }
            },
            "last_mtime": last_mtime,
        },
    )
    assert put_resp.status_code == 200


@pytest.mark.asyncio
async def test_update_mcp_conflict(client):
    get_resp = await client.get("/api/mcp")
    servers = {s["name"]: {k: v for k, v in s.items() if k != "name"} for s in get_resp.json()["servers"]}

    put_resp = await client.put(
        "/api/mcp",
        json={"servers": servers, "last_mtime": 0.0},
    )
    assert put_resp.status_code == 409
