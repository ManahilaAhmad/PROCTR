import sys
import time
import threading
from python_sensors.config import VIOLATION_CODES

class USBSensor:
    """
    Sensor 1: USB Hardware Insertion Listener (H1 Violation)
    Monitors physical removable storage device arrivals during active exam session.
    """

    def __init__(self, violation_callback):
        self.callback = violation_callback
        self.running = False
        self.thread = None

    def start(self):
        self.running = True
        self.thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.thread.start()
        print("[USBSensor] Monitoring initialized.")

    def stop(self):
        self.running = False

    def _monitor_loop(self):
        known_drives = self._get_removable_drives()
        
        while self.running:
            try:
                current_drives = self._get_removable_drives()
                new_drives = current_drives - known_drives
                
                if new_drives:
                    for drive in new_drives:
                        print(f"[USBSensor ALERT] Drive Inserted: {drive}")
                        if self.callback:
                            self.callback("H1", detected_value=drive)
                    known_drives = current_drives
                elif len(current_drives) < len(known_drives):
                    known_drives = current_drives
            except Exception as e:
                pass
            time.sleep(1.5)

    def _get_removable_drives(self):
        drives = set()
        if sys.platform == "win32":
            try:
                import win32file
                for drive_letter in "EFGHIJKLMNOPQRSTUVWXYZ":
                    path = f"{drive_letter}:\\"
                    if win32file.GetDriveType(path) == 2: # DRIVE_REMOVABLE
                        drives.add(path)
            except Exception:
                pass
        return drives
