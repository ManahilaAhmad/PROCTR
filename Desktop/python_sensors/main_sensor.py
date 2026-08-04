import sys
import os
import json
import time
import argparse

# Ensure current package can be imported cleanly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from python_sensors.workspace.workspace_manager import WorkspaceManager
from python_sensors.violation_engine.logger import LocalEventLogger
from python_sensors.violation_engine.rules import HardViolationEngine
from python_sensors.sensors.usb_detector import USBDetector
from python_sensors.sensors.clipboard_monitor import ClipboardMonitor
from python_sensors.sensors.window_tracker import WindowTracker
from python_sensors.sensors.fs_watcher import FileSystemWatcher

class SensorOrchestrator:
    """
    Central Controller for Person 1 (Desktop App Core - Monitoring & Enforcement):
    Orchestrates all OS sensors, workspace setup, local SQLite logging,
    and streams live JSON alerts over stdout IPC to Electron.
    """

    def __init__(self, exam_id=1, student_id=101, custom_whitelist=None):
        self.exam_id = exam_id
        self.student_id = student_id
        
        # 1. Setup Workspace Manager
        self.workspace_mgr = WorkspaceManager(exam_id=self.exam_id, student_id=self.student_id)
        self.workspace_info = self.workspace_mgr.initialize_workspace()
        
        # 2. Setup Local Event Logger (SQLite + Backup JSONL)
        self.logger = LocalEventLogger(self.workspace_mgr.get_workspace_path())
        
        # 3. Setup Hard Violation Engine
        self.violation_engine = HardViolationEngine(self.logger)
        
        # 4. Initialize Sensor Modules
        self.usb_sensor = USBDetector(callback_on_violation=self.on_violation_detected)
        self.clipboard_sensor = ClipboardMonitor(callback_on_violation=self.on_violation_detected)
        self.window_sensor = WindowTracker(callback_on_violation=self.on_violation_detected, custom_whitelist=custom_whitelist)
        self.fs_sensor = FileSystemWatcher(workspace_path=self.workspace_mgr.get_workspace_path(), callback_on_violation=self.on_violation_detected)

    def on_violation_detected(self, code, title, severity, description, detected_value=""):
        """Triggered whenever any sensor detects a violation (H1 - H4b)."""
        record = self.violation_engine.process_violation(code=code, detected_value=detected_value)
        
        # Emit JSON alert line to stdout (Electron IPC picks this up instantly)
        alert_payload = {
            "type": "VIOLATION_ALERT",
            "code": code,
            "title": title,
            "severity": severity,
            "description": description,
            "detected_value": detected_value,
            "timestamp": record["timestamp"] if record else time.strftime("%Y-%m-%dT%H:%M:%S")
        }
        
        print(json.dumps(alert_payload), flush=True)

    def start_all_sensors(self):
        """Starts all sensor threads."""
        print(json.dumps({
            "type": "SENSOR_SYSTEM_START",
            "message": "PROCTR Sensors Initialized Successfully",
            "workspace_dir": self.workspace_info["workspace_dir"]
        }), flush=True)

        self.usb_sensor.start()
        self.clipboard_sensor.start()
        self.window_sensor.start()
        self.fs_sensor.start()

    def stop_all_sensors(self):
        """Stops all background sensors gracefully."""
        self.usb_sensor.stop()
        self.clipboard_sensor.stop()
        self.window_sensor.stop()
        self.fs_sensor.stop()
        print(json.dumps({"type": "SENSOR_SYSTEM_STOP", "message": "Sensors stopped."}), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PROCTR Background OS Sensor Engine")
    parser.add_argument("--exam_id", type=int, default=1, help="Exam ID")
    parser.add_argument("--student_id", type=int, default=101, help="Student ID")
    parser.add_argument("--whitelist", type=str, default="", help="Comma-separated whitelisted process names")
    
    args = parser.parse_args()
    
    custom_whitelist = [p.strip() for p in args.whitelist.split(",") if p.strip()] if args.whitelist else None

    orchestrator = SensorOrchestrator(
        exam_id=args.exam_id,
        student_id=args.student_id,
        custom_whitelist=custom_whitelist
    )
    
    orchestrator.start_all_sensors()
    
    try:
        while True:
            time.sleep(1.0)
    except KeyboardInterrupt:
        orchestrator.stop_all_sensors()
