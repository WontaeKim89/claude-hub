"""설정 및 스킬 유효성 검사 서비스."""
import json
from dataclasses import dataclass
from pathlib import Path

import frontmatter

from claude_hub.utils.paths import ClaudePaths


@dataclass
class ValidationResult:
    valid: bool
    message: str
    target: str


@dataclass
class ValidatorService:

    def validate_settings(self, path: Path) -> ValidationResult:
        """settings.json이 JSON 파싱 가능하고 model 필드가 문자열인지 검사."""
        target = str(path)
        if not path.exists():
            return ValidationResult(valid=False, message="파일이 존재하지 않음", target=target)
        try:
            data = json.loads(path.read_text())
        except json.JSONDecodeError as e:
            return ValidationResult(valid=False, message=f"JSON 파싱 오류: {e}", target=target)
        if "model" in data and not isinstance(data["model"], str):
            return ValidationResult(
                valid=False,
                message=f"model 필드는 문자열이어야 함: {type(data['model']).__name__}",
                target=target,
            )
        return ValidationResult(valid=True, message="OK", target=target)

    def validate_skill(self, path: Path) -> ValidationResult:
        """SKILL.md frontmatter에 name과 description이 있는지 검사."""
        target = str(path)
        if not path.exists():
            return ValidationResult(valid=False, message="파일이 존재하지 않음", target=target)
        try:
            post = frontmatter.load(str(path))
        except Exception as e:
            return ValidationResult(valid=False, message=f"frontmatter 파싱 오류: {e}", target=target)
        missing = [f for f in ("name", "description") if not post.get(f)]
        if missing:
            return ValidationResult(
                valid=False,
                message=f"필수 frontmatter 필드 누락: {', '.join(missing)}",
                target=target,
            )
        return ValidationResult(valid=True, message="OK", target=target)

    def validate_all(self, claude_dir: Path) -> list[ValidationResult]:
        """settings.json과 모든 스킬의 SKILL.md를 일괄 검사."""
        paths = ClaudePaths(claude_dir=claude_dir)
        results = []

        results.append(self.validate_settings(paths.settings_path))

        skills_dir = paths.skills_dir
        if skills_dir.exists():
            for entry in sorted(skills_dir.iterdir()):
                if not entry.is_dir():
                    continue
                skill_md = entry / "SKILL.md"
                results.append(self.validate_skill(skill_md))

        return results
