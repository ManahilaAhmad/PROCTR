import json
from datetime import datetime

class ViolationModel:
    """
    Data Access Model for Violation Records in SQLite database.
    """

    def __init__(self, db_manager):
        self.db = db_manager

    def create_violation(self, code, title, severity, description, detected_value=""):
        now_str = datetime.now().isoformat()
        try:
            conn = self.db.get_connection()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO violations_log (violation_code, title, severity, description, detected_value, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (code, title, severity, description, str(detected_value), now_str))
            conn.commit()
            conn.close()
            return {
                "code": code,
                "title": title,
                "severity": severity,
                "description": description,
                "detected_value": detected_value,
                "timestamp": now_str
            }
        except Exception as e:
            print(f"[Model Error] Violation insert failed: {e}")
            return None

    def get_all(self):
        try:
            conn = self.db.get_connection()
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
