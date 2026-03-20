"""앱 설정."""
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from claude_hub.utils.paths import ClaudePaths


@dataclass
class AppConfig:
    port: int = 3847
    host: str = "127.0.0.1"
    claude_dir: Path = field(default_factory=lambda: Path.home() / ".claude")
    auto_open: bool = True
    # 테스트 등에서 backup_dir를 임시 경로로 오버라이드할 때 사용
    _backup_dir_override: Optional[Path] = field(default=None, repr=False)

    @property
    def paths(self) -> ClaudePaths:
        return ClaudePaths(claude_dir=self.claude_dir)

    @property
    def backup_dir(self) -> Path:
        if self._backup_dir_override is not None:
            return self._backup_dir_override
        return Path.home() / ".claude-hub"
