from pathlib import Path
from claude_hub.services.usage_db import UsageDB


def test_record_and_query(tmp_path):
    db = UsageDB(db_path=tmp_path / "test.db")
    db.record_event("skill", "gen-pr", project="/test")
    db.record_event("skill", "gen-pr", project="/test")
    db.record_event("skill", "brainstorming")
    db.record_event("plugin", "superpowers")

    top = db.get_top_skills(10)
    assert len(top) == 2
    assert top[0]["name"] == "gen-pr"
    assert top[0]["hit_count"] == 2

    overview = db.get_overview()
    assert overview["total_events"] == 4
    assert overview["unique_skills_used"] == 2


def test_timeline(tmp_path):
    db = UsageDB(db_path=tmp_path / "test.db")
    db.record_event("skill", "test-skill")
    timeline = db.get_timeline(30)
    assert len(timeline) >= 1
    assert timeline[0]["total"] >= 1
