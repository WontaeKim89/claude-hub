"""ScannerService 테스트."""
from pathlib import Path

import pytest

from claude_hub.services.scanner import ScannerService


@pytest.fixture
def scanner(fake_claude_dir: Path) -> ScannerService:
    return ScannerService(claude_dir=fake_claude_dir)


def test_scan_skills_returns_skill_summary(scanner):
    skills = scanner.scan_skills()
    assert len(skills) == 1
    skill = skills[0]
    assert skill.name == "gen-pr"
    assert skill.description == "PR 생성"
    assert skill.invoke_command == "/gen-pr"
    assert skill.source == "custom"


def test_scan_skills_empty_when_no_skills_dir(tmp_path):
    svc = ScannerService(claude_dir=tmp_path / ".claude_empty")
    assert svc.scan_skills() == []


def test_scan_agents_returns_agent_summary(scanner):
    agents = scanner.scan_agents()
    assert len(agents) == 1
    agent = agents[0]
    assert agent.name == "code-reviewer"
    assert agent.description == "코드 리뷰"
    assert agent.model == "sonnet"
    assert agent.max_turns == 15
    assert "Read" in agent.tools


def test_scan_agents_empty_when_no_agents_dir(tmp_path):
    svc = ScannerService(claude_dir=tmp_path / ".claude_empty")
    assert svc.scan_agents() == []


def test_read_settings_returns_global(scanner):
    result = scanner.read_settings()
    assert result["global_settings"]["model"] == "opus"
    assert result["local_settings"] == {}
    assert result["last_mtime"] > 0


def test_read_settings_with_local(fake_claude_dir: Path):
    import json

    (fake_claude_dir / "settings.local.json").write_text(json.dumps({"theme": "dark"}))
    svc = ScannerService(claude_dir=fake_claude_dir)
    result = svc.read_settings()
    assert result["local_settings"]["theme"] == "dark"


def test_read_hooks(scanner):
    hooks = scanner.read_hooks()
    assert "SessionStart" in hooks
    assert len(hooks["SessionStart"]) == 1


def test_read_mcp_servers_masks_sensitive_env(scanner):
    servers = scanner.read_mcp_servers()
    assert len(servers) == 1
    server = servers[0]
    assert server["name"] == "github"
    # GITHUB_PERSONAL_ACCESS_TOKEN은 "token" 포함 → 마스킹
    assert server["env"]["GITHUB_PERSONAL_ACCESS_TOKEN"] == "***"


def test_read_mcp_servers_does_not_mask_non_sensitive(fake_claude_dir: Path):
    import json

    settings_path = fake_claude_dir / "settings.json"
    settings = json.loads(settings_path.read_text())
    settings["mcpServers"]["github"]["env"]["DEBUG"] = "true"
    settings_path.write_text(json.dumps(settings))

    svc = ScannerService(claude_dir=fake_claude_dir)
    servers = svc.read_mcp_servers()
    server = next(s for s in servers if s["name"] == "github")
    # DEBUG는 민감 키 아님 → 원본 값 유지
    assert server["env"]["DEBUG"] == "true"


def test_list_projects(scanner):
    projects = scanner.list_projects()
    assert len(projects) == 1
    assert projects[0]["encoded"] == "-Users-test-Desktop-myproject"


def test_get_dashboard(scanner):
    summary = scanner.get_dashboard()
    assert summary["skills"]["total"] >= 1
    assert summary["agents"]["total"] >= 1
    assert summary["projects"]["total"] >= 1
    assert summary["mcp_servers"]["total"] == 1
