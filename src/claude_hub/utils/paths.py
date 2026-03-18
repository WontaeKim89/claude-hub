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
    if not encoded.startswith("-"):
        return encoded
    return encoded.replace("-", "/")


def encode_project_path(path: str) -> str:
    return path.replace("/", "-")
