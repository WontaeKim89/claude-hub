"""파일 편집 서비스 (atomic write + 충돌 감지)."""
import json
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path

from claude_hub.services.backup import BackupService
from claude_hub.utils.filelock import file_lock


class ConflictError(Exception):
    """파일이 마지막으로 읽은 이후 외부에서 변경된 경우."""


@dataclass
class EditorService:
    backup_service: BackupService

    def write_json(self, path: Path, data: dict, last_mtime: float) -> None:
        """JSON을 atomic하게 기록. last_mtime이 현재 mtime과 다르면 ConflictError."""
        with file_lock(path):
            if path.exists():
                current_mtime = path.stat().st_mtime
                if current_mtime != last_mtime:
                    raise ConflictError(
                        f"파일이 변경됨: {path} "
                        f"(expected mtime={last_mtime}, actual={current_mtime})"
                    )
                self.backup_service.create_backup(path)

            self._atomic_write(path, json.dumps(data, indent=2, ensure_ascii=False))

    def write_text(self, path: Path, content: str) -> None:
        """텍스트 파일을 atomic하게 기록. 기존 파일이 있으면 백업 후 덮어씀."""
        with file_lock(path):
            if path.exists():
                self.backup_service.create_backup(path)
            self._atomic_write(path, content)

    def create_skill(
        self, skills_dir: Path, name: str, description: str, body: str
    ) -> Path:
        """스킬 디렉토리와 SKILL.md를 생성."""
        skill_dir = skills_dir / name
        skill_dir.mkdir(parents=True, exist_ok=True)
        skill_md = skill_dir / "SKILL.md"
        content = f"---\nname: {name}\ndescription: {description}\n---\n{body}"
        self._atomic_write(skill_md, content)
        return skill_md

    def delete_skill(self, skills_dir: Path, name: str) -> None:
        """스킬 디렉토리를 삭제. SKILL.md를 백업한 후 디렉토리 전체 제거."""
        skill_dir = skills_dir / name
        if not skill_dir.exists():
            raise FileNotFoundError(f"스킬 없음: {name}")
        skill_md = skill_dir / "SKILL.md"
        if skill_md.exists():
            self.backup_service.create_backup(skill_md)
        import shutil
        shutil.rmtree(skill_dir)

    @staticmethod
    def _atomic_write(path: Path, content: str) -> None:
        """임시 파일에 쓴 뒤 rename으로 원자적 교체."""
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp_path = tempfile.mkstemp(dir=path.parent, prefix=".tmp_")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(content)
            os.replace(tmp_path, path)
        except Exception:
            os.unlink(tmp_path)
            raise
