"""Settings 엔드포인트 테스트."""
import pytest


@pytest.mark.asyncio
async def test_get_settings(client):
    resp = await client.get("/api/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert "global_settings" in data
    assert "local_settings" in data
    assert "last_mtime" in data
    assert data["global_settings"]["model"] == "opus"


@pytest.mark.asyncio
async def test_update_settings(client):
    # 먼저 현재 mtime 조회
    get_resp = await client.get("/api/settings")
    mtime = get_resp.json()["last_mtime"]
    current = get_resp.json()["global_settings"]

    updated = dict(current)
    updated["model"] = "sonnet"

    put_resp = await client.put("/api/settings", json={"data": updated, "last_mtime": mtime})
    assert put_resp.status_code == 200
    assert put_resp.json()["ok"] is True


@pytest.mark.asyncio
async def test_update_settings_conflict(client):
    # 잘못된 mtime으로 충돌 유발
    get_resp = await client.get("/api/settings")
    current = get_resp.json()["global_settings"]

    put_resp = await client.put(
        "/api/settings",
        json={"data": current, "last_mtime": 0.0},  # 0.0은 실제 mtime과 다름
    )
    assert put_resp.status_code == 409
