import pytest


@pytest.mark.asyncio
async def test_list_templates_includes_builtin(client):
    resp = await client.get("/api/templates")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    names = [t["name"] for t in data]
    assert "react-typescript" in names
    assert "python-fastapi" in names


@pytest.mark.asyncio
async def test_get_builtin_template(client):
    resp = await client.get("/api/templates/react-typescript")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "react-typescript"
    assert data["builtin"] is True
    assert "claude_md" in data


@pytest.mark.asyncio
async def test_get_missing_template_returns_404(client):
    resp = await client.get("/api/templates/nonexistent-template")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_save_and_delete_template(client):
    payload = {
        "name": "test-custom",
        "display_name": "Test Custom",
        "description": "테스트 템플릿",
        "claude_md": "# Test",
        "hooks": [],
        "mcp_servers": {},
        "tags": ["test"],
    }
    save_resp = await client.post("/api/templates", json=payload)
    assert save_resp.status_code == 200
    assert save_resp.json()["saved"] is True

    get_resp = await client.get("/api/templates/test-custom")
    assert get_resp.status_code == 200
    assert get_resp.json()["display_name"] == "Test Custom"

    del_resp = await client.delete("/api/templates/test-custom")
    assert del_resp.status_code == 200
    assert del_resp.json()["deleted"] is True


@pytest.mark.asyncio
async def test_delete_builtin_returns_400(client):
    resp = await client.delete("/api/templates/react-typescript")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_export_template(client, fake_claude_dir):
    resp = await client.post(
        "/api/templates/export",
        json={"project_path": str(fake_claude_dir.parent)},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "claude_md" in data
    assert "hooks" in data


@pytest.mark.asyncio
async def test_apply_missing_template_returns_404(client, fake_claude_dir):
    resp = await client.post(
        "/api/templates/nonexistent/apply",
        json={"project_path": str(fake_claude_dir.parent)},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_config_diff(client, fake_claude_dir):
    project_a = "/Users/test/Desktop/myproject"
    project_b = "/Users/test/Desktop/other"
    resp = await client.post(
        "/api/config/diff",
        json={"project_a": project_a, "project_b": project_b},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    components = [item["component"] for item in data]
    assert "CLAUDE.md" in components
    assert "Memory" in components


@pytest.mark.asyncio
async def test_config_sync(client, tmp_path):
    src = tmp_path / "src_project"
    src.mkdir()
    (src / "CLAUDE.md").write_text("# Source Project\n- Rule 1")

    dst = tmp_path / "dst_project"
    dst.mkdir()

    resp = await client.post(
        "/api/config/sync",
        json={"source": str(src), "target": str(dst)},
    )
    assert resp.status_code == 200
    assert resp.json()["synced"] is True
    assert (dst / "CLAUDE.md").read_text() == "# Source Project\n- Rule 1"


@pytest.mark.asyncio
async def test_config_sync_missing_source_returns_400(client, tmp_path):
    src = tmp_path / "no_such_project"
    dst = tmp_path / "dst"
    dst.mkdir()

    resp = await client.post(
        "/api/config/sync",
        json={"source": str(src), "target": str(dst)},
    )
    assert resp.status_code == 400
