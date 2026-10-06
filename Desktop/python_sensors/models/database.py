import os
import sqlite3

class DatabaseManager:
    """
    SQLite Connection Manager for PROCTR Desktop Sensors (proctr_local_events.db)
    """

    def __init__(self, workspace_path):
        self.workspace_path = workspace_path
        os.makedirs(self.workspace_path, exist_ok=True)
        self.db_path = os.path.join(self.workspace_path, "proctr_local_events.db")
        self.init_db()

    def get_connection(self):
        return sqlite3.connect(self.db_path)

    def init_db(self):
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
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
            print(f"[DB Error] Initialization failed: {e}")
