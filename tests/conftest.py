import json
from pathlib import Path

import pytest


@pytest.fixture
def fake_claude_dir(tmp_path: Path) -> Path:
    claude_dir = tmp_path / ".claude"
    claude_dir.mkdir()

    # skills
    skill_dir = claude_dir / "skills" / "gen-pr"
    skill_dir.mkdir(parents=True)
    (skill_dir / "SKILL.md").write_text(
        "---\nname: gen-pr\ndescription: PR 생성\n---\n# gen-pr\nPR 본문 생성 스킬"
    )

    # plugins
    plugins_dir = claude_dir / "plugins"
    plugins_dir.mkdir()
    (plugins_dir / "installed_plugins.json").write_text(
        json.dumps(
            [
                {
                    "name": "superpowers",
                    "marketplace": "claude-plugins-official",
                    "version": "5.0.2",
                    "installedAt": "2026-03-01T00:00:00Z",
                }
            ]
        )
    )
    (plugins_dir / "known_marketplaces.json").write_text(
        json.dumps(
            [
                {
                    "name": "claude-plugins-official",
                    "source": {"type": "github", "repo": "anthropics/claude-plugins"},
                }
            ]
        )
    )

    # settings.json
    (claude_dir / "settings.json").write_text(
        json.dumps(
            {
                "model": "opus",
                "enabledPlugins": {"superpowers@claude-plugins-official": True},
                "hooks": {
                    "SessionStart": [
                        {
                            "hooks": [
                                {"type": "command", "command": "echo start", "timeout": 2000}
                            ]
                        }
                    ]
                },
                "mcpServers": {
                    "github": {
                        "command": "npx",
                        "args": ["-y", "@modelcontextprotocol/server-github"],
                        "env": {"GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_secret123"},
                    }
                },
            }
        )
    )

    # agents
    agents_dir = claude_dir / "agents"
    agents_dir.mkdir()
    (agents_dir / "code-reviewer.md").write_text(
        "---\nname: code-reviewer\ndescription: 코드 리뷰\ntools: Read, Grep\nmodel: sonnet\nmaxTurns: 15\n---\n리뷰 프롬프트"
    )

    # projects / memory
    project_dir = claude_dir / "projects" / "-Users-test-Desktop-myproject"
    memory_dir = project_dir / "memory"
    memory_dir.mkdir(parents=True)
    (memory_dir / "MEMORY.md").write_text("# 프로젝트 메모리\n테스트 프로젝트")

    # CLAUDE.md
    (claude_dir / "CLAUDE.md").write_text("# Global Rules\n- 한글로 답변")

    # commands (empty dir)
    (claude_dir / "commands").mkdir()

    # teams
    teams_dir = claude_dir / "teams" / "test-team"
    teams_dir.mkdir(parents=True)

    return claude_dir
