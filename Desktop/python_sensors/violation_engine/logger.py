import os
import json
import sqlite3
from datetime import datetime

class LocalEventLogger:
    """
    Dual-Logging Engine for PROCTR Desktop Sensors:
    1. Primary: Self-contained SQLite database (proctr_local_events.db)
    2. Fallback: Append-only JSONL file (violations_backup.jsonl)
    """

    def __init__(self, workspace_path):
        self.workspace_path = workspace_path
        os.makedirs(self.workspace_path, exist_ok=True)
        
        self.db_path = os.path.join(self.workspace_path, "proctr_local_events.db")
        self.backup_json_path = os.path.join(self.workspace_path, "violations_backup.jsonl")
        
        self._init_sqlite()

    def _init_sqlite(self):
        """Initializes SQLite tables if they do not exist."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Violations Table (H1 - H4b)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS violations_log (
                    violation_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    violation_code TEXT NOT NULL,
                    title TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    description TEXT NOT NULL,
                    detected_value TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    synced BOOLEAN DEFAULT 0
                )
            """)
            
            # Telemetry Stream Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS telemetry_events (
                    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_type TEXT NOT NULL,
                    details TEXT NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"[Logger Error] Failed to initialize SQLite: {e}")
            self._log_to_backup({"event": "LOGGER_INIT_FAILED", "error": str(e), "timestamp": datetime.now().isoformat()})

    def log_violation(self, code, title, severity, description, detected_value=""):
        """Logs a hard violation to SQLite with fallback to JSONL."""
        now_str = datetime.now().isoformat()
        payload = {
            "violation_code": code,
            "title": title,
            "severity": severity,
            "description": description,
            "detected_value": str(detected_value),
            "timestamp": now_str
        }

        # 1. Primary Write: SQLite
        sqlite_success = False
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO violations_log (violation_code, title, severity, description, detected_value)
                VALUES (?, ?, ?, ?, ?)
            """, (code, title, severity, description, str(detected_value)))
            conn.commit()
            conn.close()
            sqlite_success = True
        except Exception as e:
            print(f"[Logger Warning] SQLite write failed: {e}. Falling back to JSONL.")

        # 2. Always maintain JSONL backup if SQLite failed or as mirror
        if not sqlite_success:
            self._log_to_backup(payload)

        return payload

    def log_telemetry(self, event_type, details):
        """Logs general telemetry event (window switch, clipboard update, etc.)."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO telemetry_events (event_type, details)
                VALUES (?, ?)
            """, (event_type, json.dumps(details)))
            conn.commit()
            conn.close()
        except Exception as e:
            pass

    def _log_to_backup(self, data):
        """Appends JSON payload line to violations_backup.jsonl file."""
        try:
            with open(self.backup_json_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(data) + "\n")
        except Exception as e:
            print(f"[Critical Logger Error] Could not write to backup log file: {e}")

    def get_all_violations(self):
        """Returns all logged violations from SQLite."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT violation_id, violation_code, title, severity, description, detected_value, timestamp FROM violations_log ORDER BY timestamp DESC")
            rows = cursor.fetchall()
            conn.close()
            return [
                {
                    "id": r[0],
                    "code": r[1],
                    "title": r[2],
                    "severity": r[3],
                    "description": r[4],
                    "detected_value": r[5],
                    "timestamp": r[6]
                }
                for r in rows
            ]
        except Exception:
            return []
