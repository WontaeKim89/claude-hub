"""EditorService 테스트."""
import json
from pathlib import Path

import pytest

from claude_hub.services.backup import BackupService
from claude_hub.services.editor import ConflictError, EditorService


@pytest.fixture
def backup_dir(tmp_path: Path) -> Path:
    return tmp_path / ".claude-hub"


@pytest.fixture
def editor(backup_dir: Path) -> EditorService:
    return EditorService(backup_service=BackupService(backup_dir=backup_dir))


@pytest.fixture
def json_file(tmp_path: Path) -> Path:
    f = tmp_path / "settings.json"
    f.write_text('{"model": "opus"}')
    return f


def test_write_json_updates_file(editor, json_file):
    mtime = json_file.stat().st_mtime
    editor.write_json(json_file, {"model": "sonnet"}, last_mtime=mtime)
    result = json.loads(json_file.read_text())
    assert result["model"] == "sonnet"


def test_write_json_creates_backup(editor, json_file, backup_dir):
    mtime = json_file.stat().st_mtime
    editor.write_json(json_file, {"model": "sonnet"}, last_mtime=mtime)
    svc = BackupService(backup_dir=backup_dir)
    assert len(svc.list_history()) == 1


def test_write_json_conflict_raises(editor, json_file):
    # mtime을 실제와 다르게 전달 → ConflictError
    with pytest.raises(ConflictError):
        editor.write_json(json_file, {"model": "sonnet"}, last_mtime=0.0)


def test_write_json_creates_new_file(editor, tmp_path):
    """존재하지 않는 파일에 쓸 때는 mtime 체크 없이 생성."""
    new_file = tmp_path / "new.json"
    # last_mtime=0 이지만 파일이 없으므로 충돌 아님
    editor.write_json(new_file, {"x": 1}, last_mtime=0.0)
    assert json.loads(new_file.read_text()) == {"x": 1}


def test_write_text_updates_file(editor, tmp_path):
    f = tmp_path / "CLAUDE.md"
    f.write_text("# old")
    editor.write_text(f, "# new")
    assert f.read_text() == "# new"


def test_write_text_creates_backup(editor, tmp_path, backup_dir):
    f = tmp_path / "CLAUDE.md"
    f.write_text("# old")
    editor.write_text(f, "# new")
    svc = BackupService(backup_dir=backup_dir)
    assert len(svc.list_history()) == 1


def test_create_skill(editor, tmp_path):
    skills_dir = tmp_path / "skills"
    skill_md = editor.create_skill(skills_dir, "my-skill", "설명", "# 본문")
    assert skill_md.exists()
    content = skill_md.read_text()
    assert "name: my-skill" in content
    assert "description: 설명" in content
    assert "# 본문" in content


def test_delete_skill_removes_directory(editor, tmp_path, backup_dir):
    skills_dir = tmp_path / "skills"
    editor.create_skill(skills_dir, "my-skill", "설명", "# 본문")
    editor.delete_skill(skills_dir, "my-skill")
    assert not (skills_dir / "my-skill").exists()


def test_delete_skill_creates_backup(editor, tmp_path, backup_dir):
    skills_dir = tmp_path / "skills"
    editor.create_skill(skills_dir, "my-skill", "설명", "# 본문")
    editor.delete_skill(skills_dir, "my-skill")
    svc = BackupService(backup_dir=backup_dir)
    # SKILL.md 백업이 1개 생성됨
    assert len(svc.list_history()) >= 1


def test_delete_skill_not_found_raises(editor, tmp_path):
    with pytest.raises(FileNotFoundError):
        editor.delete_skill(tmp_path / "skills", "nonexistent")
