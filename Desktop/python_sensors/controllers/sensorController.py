import sys
import os
import json
import time
import threading

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from python_sensors.models.database import DatabaseManager
from python_sensors.models.violationModel import ViolationModel
from python_sensors.controllers.violationController import ViolationController
from python_sensors.controllers.workspaceController import WorkspaceController
from python_sensors.sensors.usbSensor import USBSensor
from python_sensors.sensors.clipboardSensor import ClipboardSensor
from python_sensors.sensors.windowSensor import WindowSensor
from python_sensors.sensors.fileSystemSensor import FileSystemSensor
from python_sensors.sensors.dnsSensor import DNSSensor
from python_sensors.sensors.lan_detector import LANDetector

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

        # 4. Initialize All Production OS Sensors
        self.usb_sensor = USBSensor(violation_callback=self.on_violation)
        self.clipboard_sensor = ClipboardSensor(violation_callback=self.on_violation, auto_clear=True)
        self.window_sensor = WindowSensor(violation_callback=self.on_violation, custom_whitelist=custom_whitelist)
        self.fs_sensor = FileSystemSensor(workspace_path=self.workspace_ctrl.get_workspace_path(), violation_callback=self.on_violation)
        self.dns_sensor = DNSSensor(violation_callback=self.on_violation, active_blocking=True)
        self.lan_sensor = LANDetector(violation_callback=self.on_violation, allowed_subnet_prefix="172.30.")

    def on_violation(self, code, detected_value="", title="", severity="", description="", event_key="", *args, **kwargs):
        val = detected_value or description or str(kwargs)
        record = self.violation_ctrl.handle_violation(code=code, detected_value=val)
        
        v_title = title or (record["title"] if record else "Security Violation")
        v_severity = severity or (record["severity"] if record else "HIGH")
        v_desc = description or (record["description"] if record else "OS Telemetry Breach Detected")

        alert_payload = {
            "type": "VIOLATION_ALERT",
            "code": code,
            "title": v_title,
            "severity": v_severity,
            "description": v_desc,
            "detected_value": val,
            "event_key": event_key or f"{code}:{v_desc}",
            "timestamp": record["timestamp"] if record else time.strftime("%Y-%m-%dT%H:%M:%S")
        }
        
        # Stream JSON alert line over stdout for Electron Process Bridge
        print(json.dumps(alert_payload), flush=True)

    def update_policy(self, allowed_domains=None, allowed_processes=None):
        """Allows Teacher/Invigilator live policy overrides during active exam."""
        if allowed_domains is not None:
            self.dns_sensor.update_allowed_domains(allowed_domains)
        if allowed_processes is not None:
            self.window_sensor.update_whitelist(allowed_processes)
        
        print(json.dumps({
            "type": "POLICY_UPDATED",
            "exam_id": self.exam_id,
            "allowed_domains": list(self.dns_sensor.allowed_domains),
            "allowed_processes": list(self.window_sensor.whitelist)
        }), flush=True)

    def _listen_stdin_commands(self):
        """IPC Listener thread that receives control commands from Electron via stdin."""
        def stdin_loop():
            for line in sys.stdin:
                try:
                    data = json.loads(line.strip())
                    cmd_type = data.get("type")

                    if cmd_type == "UPDATE_WHITELIST":
                        new_whitelist = data.get("whitelist", [])
                        self.window_sensor.update_whitelist(new_whitelist)
                    elif cmd_type == "UPDATE_ALLOWED_DOMAINS":
                        new_domains = data.get("allowed_domains", [])
                        self.dns_sensor.update_allowed_domains(new_domains)
                    elif cmd_type == "UPDATE_LAB_SUBNET":
                        new_subnet = data.get("allowed_subnet", "172.30.")
                        self.lan_sensor.allowed_subnet_prefix = new_subnet
                    elif cmd_type == "FORCE_STOP":
                        self.stop()
                        sys.exit(0)
                except Exception:
                    pass

        t = threading.Thread(target=stdin_loop, daemon=True)
        t.start()

    def start(self):
        self._listen_stdin_commands()
        print(json.dumps({
            "type": "SENSOR_SYSTEM_START",
            "message": "PROCTR OS Security Sensors Initialized Successfully",
            "workspace_dir": self.workspace_info["workspace_dir"]
        }), flush=True)

        self.usb_sensor.start()
        self.clipboard_sensor.start()
        self.window_sensor.start()
        self.fs_sensor.start()
        self.dns_sensor.start()
        self.lan_sensor.start()

    def stop(self):
        self.usb_sensor.stop()
        self.clipboard_sensor.stop()
        self.window_sensor.stop()
        self.fs_sensor.stop()
        self.dns_sensor.stop()
        self.lan_sensor.stop()
        print(json.dumps({"type": "SENSOR_SYSTEM_STOP", "message": "Sensors stopped."}), flush=True)
