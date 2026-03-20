"""스킬/플러그인 사용 통계 SQLite 서비스."""
import json
import sqlite3
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path


@dataclass
class UsageDB:
    db_path: Path = field(default_factory=lambda: Path.home() / ".claude-hub" / "usage.db")

    def __post_init__(self):
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    def _init_schema(self):
        with self._connect() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS usage_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    type TEXT NOT NULL,
                    name TEXT NOT NULL,
                    project TEXT,
                    session_id TEXT,
                    timestamp REAL NOT NULL,
                    metadata TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_usage_type_name ON usage_events(type, name);
                CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_events(timestamp);

                CREATE TABLE IF NOT EXISTS usage_daily (
                    date TEXT NOT NULL,
                    type TEXT NOT NULL,
                    name TEXT NOT NULL,
                    hit_count INTEGER DEFAULT 0,
                    PRIMARY KEY (date, type, name)
                );
            """)

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(str(self.db_path))

    def record_event(
        self,
        type: str,
        name: str,
        project: str | None = None,
        session_id: str | None = None,
        metadata: dict | None = None,
    ):
        ts = time.time()
        date_str = datetime.fromtimestamp(ts).strftime("%Y-%m-%d")
        meta_json = json.dumps(metadata) if metadata else None

        with self._connect() as conn:
            conn.execute(
                "INSERT INTO usage_events (type, name, project, session_id, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?)",
                (type, name, project, session_id, ts, meta_json),
            )
            conn.execute(
                """INSERT INTO usage_daily (date, type, name, hit_count)
                   VALUES (?, ?, ?, 1)
                   ON CONFLICT(date, type, name) DO UPDATE SET hit_count = hit_count + 1""",
                (date_str, type, name),
            )

    def get_top_skills(self, limit: int = 10) -> list[dict]:
        with self._connect() as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                """SELECT name, COUNT(*) as hit_count, MAX(timestamp) as last_used
                   FROM usage_events WHERE type = 'skill'
                   GROUP BY name ORDER BY hit_count DESC LIMIT ?""",
                (limit,),
            ).fetchall()
            return [dict(r) for r in rows]

    def get_top_plugins(self, limit: int = 10) -> list[dict]:
        with self._connect() as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                """SELECT name, COUNT(*) as hit_count, MAX(timestamp) as last_used
                   FROM usage_events WHERE type = 'plugin'
                   GROUP BY name ORDER BY hit_count DESC LIMIT ?""",
                (limit,),
            ).fetchall()
            return [dict(r) for r in rows]

    def get_unused_items(self, days: int = 30) -> list[dict]:
        """Return items not used in the last N days, or never used."""
        cutoff = time.time() - (days * 86400)
        with self._connect() as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                """SELECT type, name, MAX(timestamp) as last_used, COUNT(*) as total_hits
                   FROM usage_events
                   GROUP BY type, name
                   HAVING MAX(timestamp) < ?
                   ORDER BY last_used ASC""",
                (cutoff,),
            ).fetchall()
            return [dict(r) for r in rows]

    def get_timeline(self, days: int = 30) -> list[dict]:
        cutoff_date = datetime.fromtimestamp(time.time() - days * 86400).strftime("%Y-%m-%d")
        with self._connect() as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                """SELECT date, SUM(hit_count) as total
                   FROM usage_daily
                   WHERE date >= ?
                   GROUP BY date ORDER BY date""",
                (cutoff_date,),
            ).fetchall()
            return [dict(r) for r in rows]

    def get_overview(self) -> dict:
        with self._connect() as conn:
            total = conn.execute("SELECT COUNT(*) FROM usage_events").fetchone()[0]
            skill_count = conn.execute(
                "SELECT COUNT(DISTINCT name) FROM usage_events WHERE type='skill'"
            ).fetchone()[0]
            plugin_count = conn.execute(
                "SELECT COUNT(DISTINCT name) FROM usage_events WHERE type='plugin'"
            ).fetchone()[0]
            return {
                "total_events": total,
                "unique_skills_used": skill_count,
                "unique_plugins_used": plugin_count,
            }
