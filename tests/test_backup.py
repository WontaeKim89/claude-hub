"""BackupService 테스트."""
import time
from pathlib import Path

import pytest

from claude_hub.services.backup import BackupService


@pytest.fixture
def backup_dir(tmp_path: Path) -> Path:
    return tmp_path / ".claude-hub"


@pytest.fixture
def target_file(tmp_path: Path) -> Path:
    f = tmp_path / "settings.json"
    f.write_text('{"model": "opus"}')
    return f


def test_create_backup_returns_id(backup_dir, target_file):
    svc = BackupService(backup_dir=backup_dir)
    backup_id = svc.create_backup(target_file)
    assert backup_id.endswith("_settings.json")


def test_create_backup_stores_file(backup_dir, target_file):
    svc = BackupService(backup_dir=backup_dir)
    backup_id = svc.create_backup(target_file)
    backup_path = backup_dir / "backups" / backup_id
    assert backup_path.exists()
    assert backup_path.read_text() == '{"model": "opus"}'


def test_create_backup_records_history(backup_dir, target_file):
    svc = BackupService(backup_dir=backup_dir)
    backup_id = svc.create_backup(target_file)
    history = svc.list_history()
    assert len(history) == 1
    assert history[0]["id"] == backup_id
    assert history[0]["target_path"] == str(target_file)


def test_restore_overwrites_target(backup_dir, target_file):
    svc = BackupService(backup_dir=backup_dir)
    backup_id = svc.create_backup(target_file)
    # 원본 파일 내용 변경
    target_file.write_text('{"model": "sonnet"}')
    svc.restore(backup_id)
    assert target_file.read_text() == '{"model": "opus"}'


def test_restore_unknown_id_raises(backup_dir, target_file):
    svc = BackupService(backup_dir=backup_dir)
    with pytest.raises(ValueError, match="Backup not found"):
        svc.restore("nonexistent-id")


def test_restore_creates_pre_restore_backup(backup_dir, target_file):
    svc = BackupService(backup_dir=backup_dir)
    backup_id = svc.create_backup(target_file)
    target_file.write_text('{"model": "sonnet"}')
    svc.restore(backup_id)
    # restore 호출 시 현재 파일도 백업되므로 이력이 2개여야 함
    history = svc.list_history()
    assert len(history) == 2


def test_fifo_rotation(backup_dir, target_file):
    """max_backups=3으로 설정하고 5번 백업 시 오래된 것부터 삭제."""
    svc = BackupService(backup_dir=backup_dir, max_backups=3)

    ids = []
    for i in range(5):
        target_file.write_text(f'{{"version": {i}}}')
        # 동일한 타임스탬프 충돌 방지
        time.sleep(0.01)
        bid = svc.create_backup(target_file)
        ids.append(bid)

    history = svc.list_history()
    # 이력은 최신 3개만 남아야 함
    assert len(history) == 3
    remaining_ids = [e["id"] for e in history]
    # 오래된 2개는 제거됨
    assert ids[0] not in remaining_ids
    assert ids[1] not in remaining_ids
    # 최신 3개는 유지됨
    assert ids[2] in remaining_ids
    assert ids[3] in remaining_ids
    assert ids[4] in remaining_ids
    # 실제 백업 파일도 삭제됨
    for old_id in ids[:2]:
        assert not (backup_dir / "backups" / old_id).exists()
