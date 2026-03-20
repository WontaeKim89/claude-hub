"""Hooks 엔드포인트 테스트."""
import pytest


@pytest.mark.asyncio
async def test_get_hooks(client):
    resp = await client.get("/api/hooks")
    assert resp.status_code == 200
    data = resp.json()
    assert "hooks" in data
    assert "last_mtime" in data
    # conftest의 fake_claude_dir에 SessionStart 훅이 정의돼 있음
    assert "SessionStart" in data["hooks"]


@pytest.mark.asyncio
async def test_update_hooks(client):
    get_resp = await client.get("/api/hooks")
    assert get_resp.status_code == 200
    mtime = get_resp.json()["last_mtime"]

    new_hooks = {
        "SessionStart": [
            {"hooks": [{"type": "command", "command": "echo updated", "timeout": 3000}]}
        ],
        "SessionEnd": [
            {"hooks": [{"type": "command", "command": "echo end", "timeout": 1000}]}
        ],
    }

    put_resp = await client.put("/api/hooks", json={"hooks": new_hooks, "last_mtime": mtime})
    assert put_resp.status_code == 200
    assert put_resp.json()["ok"] is True

    # 변경 확인
    verify_resp = await client.get("/api/hooks")
    updated = verify_resp.json()["hooks"]
    assert "SessionEnd" in updated
    assert updated["SessionStart"][0]["hooks"][0]["command"] == "echo updated"


@pytest.mark.asyncio
async def test_update_hooks_conflict(client):
    get_resp = await client.get("/api/hooks")
    current_hooks = get_resp.json()["hooks"]

    # mtime 0.0으로 충돌 유발
    put_resp = await client.put(
        "/api/hooks",
        json={"hooks": current_hooks, "last_mtime": 0.0},
    )
    assert put_resp.status_code == 409
