"""앱 설정."""
from dataclasses import dataclass, field
from pathlib import Path

from claude_hub.utils.paths import ClaudePaths


@dataclass
class AppConfig:
    port: int = 3847
    host: str = "127.0.0.1"
    claude_dir: Path = field(default_factory=lambda: Path.home() / ".claude")
    auto_open: bool = True

    @property
    def paths(self) -> ClaudePaths:
        return ClaudePaths(claude_dir=self.claude_dir)

    @property
    def backup_dir(self) -> Path:
        return Path.home() / ".claude-hub"
