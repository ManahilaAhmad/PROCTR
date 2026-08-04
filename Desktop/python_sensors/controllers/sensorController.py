import sys
import os
import json
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from python_sensors.models.database import DatabaseManager
from python_sensors.models.violationModel import ViolationModel
from python_sensors.controllers.violationController import ViolationController
from python_sensors.controllers.workspaceController import WorkspaceController
from python_sensors.sensors.usbSensor import USBSensor
from python_sensors.sensors.clipboardSensor import ClipboardSensor
from python_sensors.sensors.windowSensor import WindowSensor
from python_sensors.sensors.fileSystemSensor import FileSystemSensor

class SensorController:
    """
    Central Controller for Python Sensor Subsystem (MVC Architecture):
    Orchestrates Workspace setup, Database connection, Sensors & IPC stream to Electron.
    """

    def __init__(self, exam_id=1, student_id=101, custom_whitelist=None):
        self.exam_id = exam_id
        self.student_id = student_id

        # 1. Initialize Workspace Controller & Path
        self.workspace_ctrl = WorkspaceController(exam_id=self.exam_id, student_id=self.student_id)
        self.workspace_info = self.workspace_ctrl.setup_workspace()
        
        # 2. Initialize Database & Models
        self.db = DatabaseManager(self.workspace_ctrl.get_workspace_path())
        self.violation_model = ViolationModel(self.db)
        
        # 3. Initialize Violation Controller
        self.violation_ctrl = ViolationController(self.violation_model)

        # 4. Initialize Sensors
        self.usb_sensor = USBSensor(violation_callback=self.on_violation)
        self.clipboard_sensor = ClipboardSensor(violation_callback=self.on_violation)
        self.window_sensor = WindowSensor(violation_callback=self.on_violation, custom_whitelist=custom_whitelist)
        self.fs_sensor = FileSystemSensor(workspace_path=self.workspace_ctrl.get_workspace_path(), violation_callback=self.on_violation)

    def on_violation(self, code, detected_value=""):
        record = self.violation_ctrl.handle_violation(code=code, detected_value=detected_value)
        if record:
            alert_payload = {
                "type": "VIOLATION_ALERT",
                "code": record["code"],
                "title": record["title"],
                "severity": record["severity"],
                "description": record["description"],
                "detected_value": record["detected_value"],
                "timestamp": record["timestamp"]
            }
            print(json.dumps(alert_payload), flush=True)

    def start(self):
        print(json.dumps({
            "type": "SENSOR_SYSTEM_START",
            "message": "PROCTR Sensors Initialized Successfully",
            "workspace_dir": self.workspace_info["workspace_dir"]
        }), flush=True)

        self.usb_sensor.start()
        self.clipboard_sensor.start()
        self.window_sensor.start()
        self.fs_sensor.start()

    def stop(self):
        self.usb_sensor.stop()
        self.clipboard_sensor.stop()
        self.window_sensor.stop()
        self.fs_sensor.stop()
        print(json.dumps({"type": "SENSOR_SYSTEM_STOP", "message": "Sensors stopped."}), flush=True)
