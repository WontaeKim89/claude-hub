"""Core utils 테스트."""
from pathlib import Path

import pytest

from claude_hub.utils.paths import (
    ClaudePaths,
    decode_project_path,
    encode_project_path,
)
from claude_hub.utils.frontmatter import parse_skill_md, parse_agent_md
from claude_hub.utils.diff import unified_diff


# ---------------------------------------------------------------------------
# paths
# ---------------------------------------------------------------------------

class TestClaudePaths:
    def test_default_claude_dir(self):
        paths = ClaudePaths()
        assert paths.claude_dir == Path.home() / ".claude"

    def test_custom_claude_dir(self, fake_claude_dir: Path):
        paths = ClaudePaths(claude_dir=fake_claude_dir)
        assert paths.claude_dir == fake_claude_dir

    def test_property_paths(self, fake_claude_dir: Path):
        paths = ClaudePaths(claude_dir=fake_claude_dir)
        assert paths.skills_dir == fake_claude_dir / "skills"
        assert paths.plugins_dir == fake_claude_dir / "plugins"
        assert paths.agents_dir == fake_claude_dir / "agents"
        assert paths.commands_dir == fake_claude_dir / "commands"
        assert paths.teams_dir == fake_claude_dir / "teams"
        assert paths.projects_dir == fake_claude_dir / "projects"
        assert paths.settings_path == fake_claude_dir / "settings.json"
        assert paths.settings_local_path == fake_claude_dir / "settings.local.json"
        assert paths.claude_md_path == fake_claude_dir / "CLAUDE.md"
        assert paths.keybindings_path == fake_claude_dir / "keybindings.json"
        assert paths.installed_plugins_path == fake_claude_dir / "plugins" / "installed_plugins.json"
        assert paths.known_marketplaces_path == fake_claude_dir / "plugins" / "known_marketplaces.json"

    def test_list_projects_returns_project_info(self, fake_claude_dir: Path):
        paths = ClaudePaths(claude_dir=fake_claude_dir)
        projects = paths.list_projects()
        assert len(projects) == 1
        project = projects[0]
        assert project.encoded == "-Users-test-Desktop-myproject"
        # decode: '-' -> '/' 이므로 앞에 '/' 가 붙음
        assert project.decoded == "/Users/test/Desktop/myproject"
        assert project.memory_dir.exists()
        assert project.memory_dir == fake_claude_dir / "projects" / "-Users-test-Desktop-myproject" / "memory"

    def test_list_projects_empty_when_no_projects_dir(self, tmp_path: Path):
        paths = ClaudePaths(claude_dir=tmp_path / ".claude")
        assert paths.list_projects() == []

    def test_list_projects_skips_non_dash_dirs(self, fake_claude_dir: Path):
        # '-' 로 시작하지 않는 디렉터리는 무시해야 함
        extra = fake_claude_dir / "projects" / "not-a-project-path"
        extra.mkdir()
        (extra / "memory").mkdir()
        paths = ClaudePaths(claude_dir=fake_claude_dir)
        encoded_names = [p.encoded for p in paths.list_projects()]
        assert "not-a-project-path" not in encoded_names


class TestDecodeEncodePath:
    def test_decode_project_path(self):
        assert decode_project_path("-Users-john-Desktop-myapp") == "/Users/john/Desktop/myapp"

    def test_decode_no_leading_dash_returns_as_is(self):
        assert decode_project_path("plain-name") == "plain-name"

    def test_encode_project_path(self):
        assert encode_project_path("/Users/john/Desktop/myapp") == "-Users-john-Desktop-myapp"

    def test_encode_decode_roundtrip(self):
        original = "/Users/john/Desktop/my-project"
        # 인코딩 후 디코딩해도 완전히 복원되지 않는 한계 확인
        # (경로 내 하이픈과 구분자 하이픈이 동일하므로 손실 발생)
        encoded = encode_project_path(original)
        assert encoded.startswith("-")


# ---------------------------------------------------------------------------
# frontmatter
# ---------------------------------------------------------------------------

class TestParseSkillMd:
    def test_parse_skill_basic(self, fake_claude_dir: Path):
        skill_path = fake_claude_dir / "skills" / "gen-pr" / "SKILL.md"
        skill = parse_skill_md(skill_path)
        assert skill.name == "gen-pr"
        assert skill.description == "PR 생성"
        assert "PR 본문 생성 스킬" in skill.body
        assert skill.path == skill_path

    def test_parse_skill_fallback_name(self, tmp_path: Path):
        # frontmatter에 name 없으면 부모 디렉터리명 사용
        skill_dir = tmp_path / "my-skill"
        skill_dir.mkdir()
        skill_file = skill_dir / "SKILL.md"
        skill_file.write_text("---\ndescription: fallback test\n---\nbody content")
        skill = parse_skill_md(skill_file)
        assert skill.name == "my-skill"

    def test_parse_skill_empty_description(self, tmp_path: Path):
        skill_dir = tmp_path / "no-desc"
        skill_dir.mkdir()
        skill_file = skill_dir / "SKILL.md"
        skill_file.write_text("---\nname: no-desc\n---\nbody")
        skill = parse_skill_md(skill_file)
        assert skill.description == ""


class TestParseAgentMd:
    def test_parse_agent_basic(self, fake_claude_dir: Path):
        agent_path = fake_claude_dir / "agents" / "code-reviewer.md"
        agent = parse_agent_md(agent_path)
        assert agent.name == "code-reviewer"
        assert agent.description == "코드 리뷰"
        assert agent.tools == ["Read", "Grep"]
        assert agent.model == "sonnet"
        assert agent.max_turns == 15
        assert agent.body == "리뷰 프롬프트"
        assert agent.path == agent_path

    def test_parse_agent_fallback_name(self, tmp_path: Path):
        agent_file = tmp_path / "my-agent.md"
        agent_file.write_text("---\ndescription: test\ntools: \nmodel: opus\nmaxTurns: 5\n---\nbody")
        agent = parse_agent_md(agent_file)
        assert agent.name == "my-agent"

    def test_parse_agent_max_turns_default_zero(self, tmp_path: Path):
        agent_file = tmp_path / "agent.md"
        agent_file.write_text("---\nname: agent\ndescription: d\ntools: Read\nmodel: opus\n---\nbody")
        agent = parse_agent_md(agent_file)
        assert agent.max_turns == 0


# ---------------------------------------------------------------------------
# diff
# ---------------------------------------------------------------------------

class TestUnifiedDiff:
    def test_no_change_returns_empty(self):
        result = unified_diff("hello\n", "hello\n", filename="test.txt")
        assert result == ""

    def test_diff_shows_added_line(self):
        old = "line1\n"
        new = "line1\nline2\n"
        result = unified_diff(old, new, filename="test.txt")
        assert "+line2" in result
        assert "a/test.txt" in result
        assert "b/test.txt" in result

    def test_diff_shows_removed_line(self):
        old = "line1\nline2\n"
        new = "line1\n"
        result = unified_diff(old, new, filename="test.txt")
        assert "-line2" in result

    def test_diff_default_filename(self):
        result = unified_diff("a\n", "b\n")
        assert "a/file" in result
        assert "b/file" in result

    def test_diff_empty_strings(self):
        result = unified_diff("", "")
        assert result == ""
