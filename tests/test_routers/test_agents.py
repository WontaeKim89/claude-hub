"""Agents CRUD 엔드포인트 테스트."""
import pytest


@pytest.mark.asyncio
async def test_list_agents(client):
    resp = await client.get("/api/agents")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["name"] == "code-reviewer"


@pytest.mark.asyncio
async def test_get_agent(client):
    resp = await client.get("/api/agents/code-reviewer")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "code-reviewer"
    assert "content" in data
    assert data["model"] == "sonnet"


@pytest.mark.asyncio
async def test_get_agent_not_found(client):
    resp = await client.get("/api/agents/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_agent(client):
    payload = {
        "name": "test-agent",
        "description": "테스트 에이전트",
        "model": "sonnet",
        "tools": "Read, Grep",
        "max_turns": 10,
        "content": "# test-agent\n에이전트 프롬프트",
    }
    resp = await client.post("/api/agents", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "test-agent"
    assert data["model"] == "sonnet"


@pytest.mark.asyncio
async def test_create_agent_conflict(client):
    payload = {
        "name": "code-reviewer",
        "description": "중복",
        "model": "sonnet",
        "tools": "Read",
        "max_turns": 5,
        "content": "",
    }
    resp = await client.post("/api/agents", json=payload)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_update_agent(client):
    payload = {"content": "---\nname: code-reviewer\ndescription: 수정됨\n---\n수정된 프롬프트"}
    resp = await client.put("/api/agents/code-reviewer", json=payload)
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


@pytest.mark.asyncio
async def test_update_agent_not_found(client):
    payload = {"content": "# 없는 에이전트"}
    resp = await client.put("/api/agents/nonexistent", json=payload)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_agent(client):
    resp = await client.delete("/api/agents/code-reviewer")
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    # 삭제 후 조회하면 404
    resp = await client.get("/api/agents/code-reviewer")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_agent_not_found(client):
    resp = await client.delete("/api/agents/nonexistent")
    assert resp.status_code == 404
