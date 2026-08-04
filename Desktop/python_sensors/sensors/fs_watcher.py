import os
import time
import threading
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from python_sensors.config import VIOLATION_CODES

class ExamFileEventHandler(FileSystemEventHandler):
    """Event handler for watchdog file system events."""

    def __init__(self, callback_on_violation):
        super().__init__()
        self.callback = callback_on_violation
        self.last_event_time = 0

    def on_created(self, event):
        if event.is_directory:
            return
        self._check_file_event(event.src_path, "CREATED")

    def on_deleted(self, event):
        if event.is_directory:
            return
        # Don't flag standard DB / temp log file updates
        filename = os.path.basename(event.src_path)
        if filename.endswith(".db") or filename.endswith(".jsonl") or filename.endswith(".tmp"):
            return
        self._check_file_event(event.src_path, "DELETED")

    def _check_file_event(self, file_path, action):
        filename = os.path.basename(file_path)
        
        # Ignore internal system log files
        if filename in ["proctr_local_events.db", "violations_backup.jsonl"] or filename.startswith("."):
            return

        # Throttle rapid duplicate events
        now = time.time()
        if now - self.last_event_time < 1.0:
            return
        self.last_event_time = now

        print(f"[ALERT H4b] Workspace File Event [{action}]: {filename}")
        v_info = VIOLATION_CODES["H4b"]
        if self.callback:
            self.callback(
                code="H4b",
                title=v_info["title"],
                severity=v_info["severity"],
                description=f"File system activity [{action}] detected in workspace: {filename}",
                detected_value=f"File: {filename} ({action})"
            )


class FileSystemWatcher:
    """
    Sensor 4: Workspace File System & Document Watcher (H4b Violation)
    Uses watchdog to observe exam directory changes in real time.
    """

    def __init__(self, workspace_path, callback_on_violation):
        self.workspace_path = workspace_path
        self.callback = callback_on_violation
        self.observer = None
        self.running = False

    def start(self):
        """Starts watchdog observer on exam workspace directory."""
        if not os.path.exists(self.workspace_path):
            os.makedirs(self.workspace_path, exist_ok=True)

        event_handler = ExamFileEventHandler(self.callback)
        self.observer = Observer()
        self.observer.schedule(event_handler, path=self.workspace_path, recursive=True)
        self.observer.start()
        self.running = True
        print(f"[FS Sensor] Monitoring workspace path: {self.workspace_path}")

    def stop(self):
        if self.observer and self.running:
            self.observer.stop()
            self.observer.join()
            self.running = False
