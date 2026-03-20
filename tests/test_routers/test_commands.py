"""Commands CRUD 엔드포인트 테스트."""
import pytest


@pytest.mark.asyncio
async def test_list_commands_empty(client):
    # conftest에서 commands 디렉토리는 비어있음
    resp = await client.get("/api/commands")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_create_command(client):
    payload = {"name": "deploy", "content": "# deploy\n배포 커맨드"}
    resp = await client.post("/api/commands", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "deploy"


@pytest.mark.asyncio
async def test_get_command(client):
    # 먼저 생성
    await client.post("/api/commands", json={"name": "my-cmd", "content": "# my-cmd\n내용"})
    resp = await client.get("/api/commands/my-cmd")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "my-cmd"
    assert "content" in data


@pytest.mark.asyncio
async def test_get_command_not_found(client):
    resp = await client.get("/api/commands/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_command_conflict(client):
    await client.post("/api/commands", json={"name": "dup", "content": "첫번째"})
    resp = await client.post("/api/commands", json={"name": "dup", "content": "두번째"})
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_update_command(client):
    await client.post("/api/commands", json={"name": "update-me", "content": "원본"})
    resp = await client.put("/api/commands/update-me", json={"content": "수정된 내용"})
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


@pytest.mark.asyncio
async def test_update_command_not_found(client):
    resp = await client.put("/api/commands/nonexistent", json={"content": "내용"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_command(client):
    await client.post("/api/commands", json={"name": "to-delete", "content": "삭제 대상"})
    resp = await client.delete("/api/commands/to-delete")
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    resp = await client.get("/api/commands/to-delete")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_command_not_found(client):
    resp = await client.delete("/api/commands/nonexistent")
    assert resp.status_code == 404
