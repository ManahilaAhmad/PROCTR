import os
from python_sensors.sensors.fs_watcher import FileSystemWatcher

class FileSystemSensor:
    """
    Sensor 4: Workspace & Word Document File System Watcher (H4b Violation)
    Delegates to production FileSystemWatcher with Safe-Zone & Auto-Restoration Engine.
    """

    def __init__(self, workspace_path, violation_callback):
        self.watcher = FileSystemWatcher(workspace_path=workspace_path, callback_on_violation=violation_callback)

    def start(self):
        self.watcher.start()

    def stop(self):
        self.watcher.stop()
