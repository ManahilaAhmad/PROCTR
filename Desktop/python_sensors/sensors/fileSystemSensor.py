import os
import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class ExamFileHandler(FileSystemEventHandler):
    def __init__(self, violation_callback):
        super().__init__()
        self.callback = violation_callback
        self.last_time = 0

    def on_created(self, event):
        if not event.is_directory:
            self._handle_event(event.src_path, "CREATED")

    def on_deleted(self, event):
        if not event.is_directory:
            filename = os.path.basename(event.src_path)
            if not (filename.endswith(".db") or filename.endswith(".jsonl") or filename.endswith(".tmp")):
                self._handle_event(event.src_path, "DELETED")

    def _handle_event(self, path, action):
        filename = os.path.basename(path)
        if filename in ["proctr_local_events.db", "violations_backup.jsonl"] or filename.startswith("."):
            return
        now = time.time()
        if now - self.last_time < 1.0:
            return
        self.last_time = now

        print(f"[FileSensor ALERT H4b] Workspace File Event: {action} {filename}")
        if self.callback:
            self.callback("H4b", detected_value=f"File: {filename} ({action})")


class FileSystemSensor:
    """
    Sensor 4: Workspace & Word Document File System Watcher (H4b Violation)
    """

    def __init__(self, workspace_path, violation_callback):
        self.workspace_path = workspace_path
        self.callback = violation_callback
        self.observer = None

    def start(self):
        os.makedirs(self.workspace_path, exist_ok=True)
        handler = ExamFileHandler(self.callback)
        self.observer = Observer()
        self.observer.schedule(handler, path=self.workspace_path, recursive=True)
        self.observer.start()
        print(f"[FileSystemSensor] Monitoring path: {self.workspace_path}")

    def stop(self):
        if self.observer:
            self.observer.stop()
            self.observer.join()
