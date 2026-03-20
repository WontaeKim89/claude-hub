"""Keybindings 엔드포인트 테스트."""
import pytest


@pytest.mark.asyncio
async def test_get_keybindings_empty(client):
    # fake_claude_dir에 keybindings.json이 없으면 빈 객체 반환
    resp = await client.get("/api/keybindings")
    assert resp.status_code == 200
    data = resp.json()
    assert "data" in data
    assert "last_mtime" in data
    assert data["data"] == {}
    assert data["last_mtime"] == 0.0


@pytest.mark.asyncio
async def test_update_keybindings(client):
    # 파일이 없는 상태에서 PUT → 새로 생성
    get_resp = await client.get("/api/keybindings")
    last_mtime = get_resp.json()["last_mtime"]

    keybindings_data = {
        "openFile": "Ctrl+P",
        "saveFile": "Ctrl+S",
    }

    put_resp = await client.put(
        "/api/keybindings",
        json={"data": keybindings_data, "last_mtime": last_mtime},
    )
    assert put_resp.status_code == 200
    assert put_resp.json()["ok"] is True

    # 저장 후 다시 조회
    get_resp2 = await client.get("/api/keybindings")
    assert get_resp2.json()["data"] == keybindings_data
    assert get_resp2.json()["last_mtime"] > 0.0


@pytest.mark.asyncio
async def test_update_keybindings_conflict(client, fake_claude_dir):
    # 먼저 파일 생성
    import json
    kb_path = fake_claude_dir / "keybindings.json"
    kb_path.write_text(json.dumps({"openFile": "Ctrl+P"}))

    put_resp = await client.put(
        "/api/keybindings",
        json={"data": {"openFile": "Ctrl+O"}, "last_mtime": 0.0},
    )
    assert put_resp.status_code == 409
