"""~/.claude/ 경로 해석 유틸리티."""
import functools
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class ProjectInfo:
    encoded: str
    decoded: str
    memory_dir: Path


@dataclass
class ClaudePaths:
    claude_dir: Path = field(default_factory=lambda: Path.home() / ".claude")

    @property
    def skills_dir(self) -> Path:
        return self.claude_dir / "skills"

    @property
    def plugins_dir(self) -> Path:
        return self.claude_dir / "plugins"

    @property
    def agents_dir(self) -> Path:
        return self.claude_dir / "agents"

    @property
    def commands_dir(self) -> Path:
        return self.claude_dir / "commands"

    @property
    def teams_dir(self) -> Path:
        return self.claude_dir / "teams"

    @property
    def projects_dir(self) -> Path:
        return self.claude_dir / "projects"

    @property
    def settings_path(self) -> Path:
        return self.claude_dir / "settings.json"

    @property
    def settings_local_path(self) -> Path:
        return self.claude_dir / "settings.local.json"

    @property
    def claude_md_path(self) -> Path:
        return self.claude_dir / "CLAUDE.md"

    @property
    def keybindings_path(self) -> Path:
        return self.claude_dir / "keybindings.json"

    @property
    def installed_plugins_path(self) -> Path:
        return self.plugins_dir / "installed_plugins.json"

    @property
    def known_marketplaces_path(self) -> Path:
        return self.plugins_dir / "known_marketplaces.json"

    @property
    def backup_dir(self) -> Path:
        return Path.home() / ".claude-hub"

    def list_projects(self, include_sessions: bool = False) -> list[ProjectInfo]:
        """프로젝트 목록. include_sessions=True면 JSONL만 있는 프로젝트도 포함."""
        projects = []
        if not self.projects_dir.exists():
            return projects
        EXCLUDE = {"subagents"}
        for entry in sorted(self.projects_dir.iterdir()):
            if not entry.is_dir() or not entry.name.startswith("-"):
                continue
            if entry.name in EXCLUDE:
                continue
            segments = entry.name.lstrip("-").split("-")
            if len(segments) < 3:
                continue
            memory_dir = entry / "memory"
            has_memory = memory_dir.exists()
            if has_memory:
                projects.append(ProjectInfo(encoded=entry.name, decoded=decode_project_path(entry.name), memory_dir=memory_dir))
            elif include_sessions and any(entry.glob("*.jsonl")):
                projects.append(ProjectInfo(encoded=entry.name, decoded=decode_project_path(entry.name), memory_dir=memory_dir))
        return projects


@functools.lru_cache(maxsize=256)
def decode_project_path(encoded: str) -> str:
    """인코딩된 프로젝트 경로를 실제 경로로 복원.
    '-'가 디렉토리 구분자인지 이름의 일부인지 구분하기 위해
    실제 파일시스템을 탐색하여 존재하는 경로를 찾는다."""
    if not encoded.startswith("-"):
        return encoded

    # 선행 '-' 제거 → 루트 '/'부터 시작
    raw = encoded[1:]
    result = _resolve_path("/", raw)
    if result:
        return result
    # fallback: 부분 탐색 — 존재하는 가장 깊은 경로까지 복원하고 나머지는 그대로
    partial = _resolve_partial("/", raw)
    if partial:
        return partial
    return encoded


def _resolve_path(base: str, remaining: str) -> str | None:
    """하이픈으로 구분된 경로를 실제 파일시스템과 대조하여 복원.
    가장 긴 매칭을 우선 시도하여 'Persnal_Project' 같은 언더스코어 포함
    디렉토리명이 'Persnal'/'Project'로 잘못 분리되는 것을 방지."""
    import os
    if not remaining:
        return base if os.path.isdir(base) else None

    parts = remaining.split("-")
    # 긴 이름부터 시도 (greedy) — 'claude-hub'이 'claude'+'hub'보다 우선
    for i in range(len(parts), 0, -1):
        candidate_name = "-".join(parts[:i])
        candidate_path = os.path.join(base, candidate_name)
        if os.path.exists(candidate_path):
            rest = "-".join(parts[i:])
            result = _resolve_path(candidate_path, rest)
            if result:
                return result
    return None


def _resolve_partial(base: str, remaining: str) -> str | None:
    """존재하는 가장 깊은 경로까지 복원, 나머지는 하이픈으로 연결 유지."""
    import os
    if not remaining:
        return base

    parts = remaining.split("-")
    for i in range(len(parts), 0, -1):
        candidate_name = "-".join(parts[:i])
        candidate_path = os.path.join(base, candidate_name)
        if os.path.exists(candidate_path):
            rest = "-".join(parts[i:])
            if rest:
                deeper = _resolve_partial(candidate_path, rest)
                if deeper:
                    return deeper
            # 여기까지만 존재 — 나머지를 슬래시 없이 붙임
            rest_str = "-".join(parts[i:])
            return candidate_path + ("/" + rest_str if rest_str else "")
    return None


def encode_project_path(path: str) -> str:
    return path.replace("/", "-")
