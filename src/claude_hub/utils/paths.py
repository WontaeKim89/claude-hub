"""~/.claude/ 경로 해석 유틸리티."""
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

    def list_projects(self) -> list[ProjectInfo]:
        projects = []
        if not self.projects_dir.exists():
            return projects
        for entry in sorted(self.projects_dir.iterdir()):
            if not entry.is_dir() or not entry.name.startswith("-"):
                continue
            memory_dir = entry / "memory"
            if memory_dir.exists():
                projects.append(
                    ProjectInfo(
                        encoded=entry.name,
                        decoded=decode_project_path(entry.name),
                        memory_dir=memory_dir,
                    )
                )
        return projects


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
    # fallback: 단순 치환 (존재하지 않는 경로)
    return encoded.replace("-", "/")


def _resolve_path(base: str, remaining: str) -> str | None:
    """하이픈으로 구분된 경로를 실제 파일시스템과 대조하여 복원."""
    import os
    if not remaining:
        return base if os.path.isdir(base) else None

    parts = remaining.split("-")
    # 앞에서부터 하이픈을 하나씩 늘려가며 디렉토리 존재 여부 확인
    for i in range(1, len(parts) + 1):
        candidate_name = "-".join(parts[:i])
        candidate_path = os.path.join(base, candidate_name)
        if os.path.exists(candidate_path):
            rest = "-".join(parts[i:])
            result = _resolve_path(candidate_path, rest)
            if result:
                return result
    return None


def encode_project_path(path: str) -> str:
    return path.replace("/", "-")
