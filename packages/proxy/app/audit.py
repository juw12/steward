"""SQLite audit log for the Steward proxy."""

from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

# Default DB path: <proxy>/data/audit.db
_PROXY_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(_PROXY_DIR, "data", "audit.db")

_SCHEMA = """\
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    feature TEXT NOT NULL,
    category TEXT NOT NULL,
    action TEXT NOT NULL,
    reason TEXT,
    user_message TEXT,
    redirect_message TEXT,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0.0,
    response_time_ms INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_log(category);
CREATE INDEX IF NOT EXISTS idx_audit_feature ON audit_log(feature);
"""


def init_db(db_path: str = DB_PATH) -> None:
    """Create the audit table and indexes if they don't exist."""
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    with sqlite3.connect(db_path) as conn:
        conn.executescript(_SCHEMA)


def log_entry(
    db_path: str,
    *,
    feature: str,
    category: str,
    action: str,
    reason: str,
    user_message: str,
    redirect_message: Optional[str] = None,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    total_tokens: int = 0,
    cost_usd: float = 0.0,
    response_time_ms: int = 0,
) -> None:
    """Insert a single audit log entry."""
    ts = datetime.now(timezone.utc).isoformat()
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            """INSERT INTO audit_log
               (timestamp, feature, category, action, reason, user_message,
                redirect_message, prompt_tokens, completion_tokens,
                total_tokens, cost_usd, response_time_ms)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                ts, feature, category, action, reason, user_message,
                redirect_message, prompt_tokens, completion_tokens,
                total_tokens, cost_usd, response_time_ms,
            ),
        )


def query_entries(
    db_path: str,
    *,
    limit: int = 50,
    offset: int = 0,
    category: Optional[str] = None,
    action: Optional[str] = None,
    feature: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Query audit entries with optional filters and pagination."""
    sql = "SELECT * FROM audit_log WHERE 1=1"
    params: list = []
    if category:
        sql += " AND category = ?"
        params.append(category)
    if action:
        sql += " AND action = ?"
        params.append(action)
    if feature:
        sql += " AND feature = ?"
        params.append(feature)
    sql += " ORDER BY id DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(sql, params).fetchall()
    return [dict(row) for row in rows]


def get_stats(db_path: str) -> Dict[str, Any]:
    """Return aggregated counts for the dashboard."""
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        total = conn.execute("SELECT COUNT(*) as c FROM audit_log").fetchone()["c"]
        by_category = {
            r["category"]: r["c"]
            for r in conn.execute(
                "SELECT category, COUNT(*) as c FROM audit_log GROUP BY category"
            ).fetchall()
        }
        by_action = {
            r["action"]: r["c"]
            for r in conn.execute(
                "SELECT action, COUNT(*) as c FROM audit_log GROUP BY action"
            ).fetchall()
        }
        by_feature = {
            r["feature"]: r["c"]
            for r in conn.execute(
                "SELECT feature, COUNT(*) as c FROM audit_log GROUP BY feature"
            ).fetchall()
        }
        total_cost = conn.execute(
            "SELECT COALESCE(SUM(cost_usd), 0) as c FROM audit_log"
        ).fetchone()["c"]

    return {
        "total": total,
        "by_category": by_category,
        "by_action": by_action,
        "by_feature": by_feature,
        "total_cost": total_cost,
    }
