"""Backup 및 Preview Diff 엔드포인트 테스트."""
import pytest


@pytest.mark.asyncio
async def test_list_backups_empty(client):
    resp = await client.get("/api/backups")
    assert resp.status_code == 200
    data = resp.json()
    assert "history" in data
    assert isinstance(data["history"], list)


@pytest.mark.asyncio
async def test_restore_not_found(client):
    resp = await client.post("/api/backups/nonexistent-backup-id/restore")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_preview_diff_settings(client):
    resp = await client.post(
        "/api/preview-diff",
        json={"target": "settings", "scope": "global", "content": {"model": "sonnet"}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "diff" in data
    assert "target_path" in data
    assert "settings.json" in data["target_path"]


@pytest.mark.asyncio
async def test_preview_diff_skill(client):
    resp = await client.post(
        "/api/preview-diff",
        json={"target": "skill", "scope": "gen-pr", "content": "# Updated skill content"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "diff" in data
    assert "SKILL.md" in data["target_path"]
