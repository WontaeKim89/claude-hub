"""백업/복원/이력 관리 서비스."""
import json
import shutil
import time
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class BackupService:
    backup_dir: Path = field(default_factory=lambda: Path.home() / ".claude-hub")
    max_backups: int = 50

    def __post_init__(self):
        (self.backup_dir / "backups").mkdir(parents=True, exist_ok=True)
        self._history_path = self.backup_dir / "history.json"
        if not self._history_path.exists():
            self._history_path.write_text("[]")

    def create_backup(self, target: Path) -> str:
        timestamp = time.time()
        time_str = time.strftime("%Y-%m-%dT%H-%M-%S", time.localtime(timestamp))
        # 동일 초 내 중복 방지를 위해 밀리초 포함
        ms = int((timestamp % 1) * 1000)
        backup_id = f"{time_str}-{ms:03d}_{target.name}"
        backup_path = self.backup_dir / "backups" / backup_id
        shutil.copy2(target, backup_path)
        entry = {
            "id": backup_id,
            "target_path": str(target),
            "backup_path": str(backup_path),
            "timestamp": timestamp,
        }
        history = self._load_history()
        history.append(entry)
        if len(history) > self.max_backups:
            removed = history[: len(history) - self.max_backups]
            for r in removed:
                p = Path(r["backup_path"])
                if p.exists():
                    p.unlink()
            history = history[-self.max_backups :]
        self._save_history(history)
        return backup_id

    def restore(self, backup_id: str) -> None:
        history = self._load_history()
        entry = next((e for e in history if e["id"] == backup_id), None)
        if not entry:
            raise ValueError(f"Backup not found: {backup_id}")
        backup_path = Path(entry["backup_path"])
        target_path = Path(entry["target_path"])
        if not backup_path.exists():
            raise FileNotFoundError(f"Backup file missing: {backup_path}")
        # 복원 전 현재 파일을 백업
        if target_path.exists():
            self.create_backup(target_path)
        shutil.copy2(backup_path, target_path)

    def list_history(self) -> list[dict]:
        return self._load_history()

    def _load_history(self) -> list[dict]:
        return json.loads(self._history_path.read_text())

    def _save_history(self, history: list[dict]) -> None:
        self._history_path.write_text(json.dumps(history, indent=2))
