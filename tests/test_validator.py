"""ValidatorService 테스트."""
import json
from pathlib import Path

import pytest

from claude_hub.services.validator import ValidationResult, ValidatorService


@pytest.fixture
def validator() -> ValidatorService:
    return ValidatorService()


def test_validate_settings_valid(validator, fake_claude_dir: Path):
    result = validator.validate_settings(fake_claude_dir / "settings.json")
    assert result.valid is True
    assert result.message == "OK"


def test_validate_settings_invalid_json(validator, tmp_path: Path):
    bad = tmp_path / "settings.json"
    bad.write_text("{not valid json")
    result = validator.validate_settings(bad)
    assert result.valid is False
    assert "JSON 파싱 오류" in result.message


def test_validate_settings_model_not_string(validator, tmp_path: Path):
    f = tmp_path / "settings.json"
    f.write_text(json.dumps({"model": 42}))
    result = validator.validate_settings(f)
    assert result.valid is False
    assert "model" in result.message


def test_validate_settings_missing_file(validator, tmp_path: Path):
    result = validator.validate_settings(tmp_path / "missing.json")
    assert result.valid is False
    assert "존재하지 않음" in result.message


def test_validate_skill_valid(validator, fake_claude_dir: Path):
    skill_md = fake_claude_dir / "skills" / "gen-pr" / "SKILL.md"
    result = validator.validate_skill(skill_md)
    assert result.valid is True


def test_validate_skill_missing_description(validator, tmp_path: Path):
    skill_md = tmp_path / "SKILL.md"
    skill_md.write_text("---\nname: my-skill\n---\n본문")
    result = validator.validate_skill(skill_md)
    assert result.valid is False
    assert "description" in result.message


def test_validate_skill_missing_name(validator, tmp_path: Path):
    skill_md = tmp_path / "SKILL.md"
    skill_md.write_text("---\ndescription: 설명\n---\n본문")
    result = validator.validate_skill(skill_md)
    assert result.valid is False
    assert "name" in result.message


def test_validate_skill_missing_file(validator, tmp_path: Path):
    result = validator.validate_skill(tmp_path / "SKILL.md")
    assert result.valid is False


def test_validate_all_returns_list(validator, fake_claude_dir: Path):
    results = validator.validate_all(fake_claude_dir)
    assert isinstance(results, list)
    # settings.json + gen-pr skill = 최소 2개
    assert len(results) >= 2
    assert all(isinstance(r, ValidationResult) for r in results)


def test_validate_all_all_valid(validator, fake_claude_dir: Path):
    results = validator.validate_all(fake_claude_dir)
    for r in results:
        assert r.valid is True, f"검사 실패: {r.target} — {r.message}"
