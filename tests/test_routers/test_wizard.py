import pytest


@pytest.mark.asyncio
async def test_analyze_invalid_path(client):
    resp = await client.post("/api/wizard/analyze", json={"project_path": "/nonexistent/path"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_analyze_valid_path(client, fake_claude_dir):
    resp = await client.post("/api/wizard/analyze", json={"project_path": str(fake_claude_dir.parent)})
    assert resp.status_code == 200
    data = resp.json()
    assert "tech_stack" in data
    assert "claude_md" in data
