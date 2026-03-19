"""Skills CRUD 엔드포인트 테스트."""
import pytest


@pytest.mark.asyncio
async def test_list_skills(client):
    resp = await client.get("/api/skills")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["name"] == "gen-pr"


@pytest.mark.asyncio
async def test_get_skill(client):
    resp = await client.get("/api/skills/gen-pr")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "gen-pr"
    assert "content" in data
    assert data["editable"] is True


@pytest.mark.asyncio
async def test_get_skill_not_found(client):
    resp = await client.get("/api/skills/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_skill(client):
    payload = {"name": "new-skill", "description": "새 스킬", "content": "# new-skill\n본문"}
    resp = await client.post("/api/skills", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "new-skill"
    assert data["invoke_command"] == "/skill:new-skill"


@pytest.mark.asyncio
async def test_create_skill_conflict(client):
    # gen-pr은 이미 존재
    payload = {"name": "gen-pr", "description": "중복", "content": "# 중복"}
    resp = await client.post("/api/skills", json=payload)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_update_skill(client):
    payload = {"content": "---\nname: gen-pr\ndescription: 수정됨\n---\n# 수정된 내용"}
    resp = await client.put("/api/skills/gen-pr", json=payload)
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


@pytest.mark.asyncio
async def test_update_skill_not_found(client):
    payload = {"content": "# 없는 스킬"}
    resp = await client.put("/api/skills/nonexistent", json=payload)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_skill(client):
    resp = await client.delete("/api/skills/gen-pr")
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    # 삭제 후 조회하면 404
    resp = await client.get("/api/skills/gen-pr")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_skill_not_found(client):
    resp = await client.delete("/api/skills/nonexistent")
    assert resp.status_code == 404
