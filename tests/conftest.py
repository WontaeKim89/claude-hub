import json
from pathlib import Path

import pytest

from claude_hub.services.scanner import _cache


@pytest.fixture(autouse=True)
def _clear_cache():
    _cache.clear()
    yield
    _cache.clear()


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
    # version 2 형식 (실제 Claude Code 형식과 동일)
    cache_dir = plugins_dir / "cache" / "claude-plugins-official" / "superpowers" / "5.0.2"
    cache_plugin_dir = cache_dir / ".claude-plugin"
    cache_plugin_dir.mkdir(parents=True)
    (cache_plugin_dir / "plugin.json").write_text(json.dumps({
        "name": "superpowers", "description": "Agent skills framework", "version": "5.0.2"
    }))
    (cache_dir / "skills").mkdir()
    (plugins_dir / "installed_plugins.json").write_text(
        json.dumps({
            "version": 2,
            "plugins": {
                "superpowers@claude-plugins-official": [
                    {
                        "scope": "user",
                        "installPath": str(cache_dir),
                        "version": "5.0.2",
                        "installedAt": "2026-03-01T00:00:00Z",
                        "lastUpdated": "2026-03-01T00:00:00Z",
                    }
                ]
            }
        })
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

    # marketplace
    mp_dir = plugins_dir / "marketplaces" / "test-marketplace" / ".claude-plugin"
    mp_dir.mkdir(parents=True)
    (mp_dir / "marketplace.json").write_text(json.dumps({
        "name": "test-marketplace",
        "plugins": [
            {
                "name": "test-plugin",
                "description": "A test plugin",
                "version": "1.0.0",
                "category": "development",
                "homepage": "https://github.com/test/test-plugin",
                "source": {"source": "url", "url": "https://github.com/test/test-plugin.git"},
                "author": {"name": "Test Author"},
                "tags": ["testing", "development"],
            },
            {
                "name": "another-plugin",
                "description": "Another plugin",
                "version": "2.0.0",
                "category": "productivity",
            },
        ]
    }))

    return claude_dir
