"""Memory API 엔드포인트 테스트."""
import pytest


@pytest.mark.asyncio
async def test_list_projects(client):
    resp = await client.get("/api/memory/projects")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["encoded"] == "-Users-test-Desktop-myproject"


@pytest.mark.asyncio
async def test_list_memory_files(client):
    resp = await client.get("/api/memory/-Users-test-Desktop-myproject")
    assert resp.status_code == 200
    data = resp.json()
    assert data["project"] == "-Users-test-Desktop-myproject"
    assert isinstance(data["files"], list)
    assert any(f["name"] == "MEMORY.md" for f in data["files"])


@pytest.mark.asyncio
async def test_list_memory_files_not_found(client):
    resp = await client.get("/api/memory/nonexistent-project")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_memory_file(client):
    resp = await client.get("/api/memory/-Users-test-Desktop-myproject/MEMORY.md")
    assert resp.status_code == 200
    data = resp.json()
    assert data["project"] == "-Users-test-Desktop-myproject"
    assert data["file"] == "MEMORY.md"
    assert "content" in data
    assert len(data["content"]) > 0


@pytest.mark.asyncio
async def test_get_memory_file_not_found(client):
    resp = await client.get("/api/memory/-Users-test-Desktop-myproject/nonexistent.md")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_memory_file(client):
    payload = {"content": "# Updated Memory\n새로운 내용"}
    resp = await client.put(
        "/api/memory/-Users-test-Desktop-myproject/MEMORY.md",
        json=payload,
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    # 실제로 반영됐는지 확인
    resp = await client.get("/api/memory/-Users-test-Desktop-myproject/MEMORY.md")
    assert resp.json()["content"] == "# Updated Memory\n새로운 내용"


@pytest.mark.asyncio
async def test_update_memory_file_not_found(client):
    payload = {"content": "# content"}
    resp = await client.put(
        "/api/memory/-Users-test-Desktop-myproject/nonexistent.md",
        json=payload,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_memory_file(client):
    payload = {"name": "new-notes.md", "content": "# New Notes"}
    resp = await client.post("/api/memory/-Users-test-Desktop-myproject", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["file"] == "new-notes.md"

    # 파일 목록에 포함됐는지 확인
    resp = await client.get("/api/memory/-Users-test-Desktop-myproject")
    files = resp.json()["files"]
    assert any(f["name"] == "new-notes.md" for f in files)


@pytest.mark.asyncio
async def test_create_memory_file_conflict(client):
    # MEMORY.md는 이미 존재
    payload = {"name": "MEMORY.md", "content": "# 중복"}
    resp = await client.post("/api/memory/-Users-test-Desktop-myproject", json=payload)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_create_memory_file_project_not_found(client):
    payload = {"name": "new.md", "content": "# content"}
    resp = await client.post("/api/memory/nonexistent-project", json=payload)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_memory_file(client):
    # 먼저 파일 하나 생성
    await client.post(
        "/api/memory/-Users-test-Desktop-myproject",
        json={"name": "to-delete.md", "content": "# delete me"},
    )

    resp = await client.delete("/api/memory/-Users-test-Desktop-myproject/to-delete.md")
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    # 삭제 후 조회하면 404
    resp = await client.get("/api/memory/-Users-test-Desktop-myproject/to-delete.md")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_memory_file_not_found(client):
    resp = await client.delete("/api/memory/-Users-test-Desktop-myproject/nonexistent.md")
    assert resp.status_code == 404
