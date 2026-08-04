import sys
import time
import threading
from python_sensors.config import VIOLATION_CODES

class USBDetector:
    """
    Sensor 1: USB Hardware Insertion Listener (H1 Violation)
    Monitors physical removable storage device arrivals during active exam session.
    """

    def __init__(self, callback_on_violation):
        self.callback = callback_on_violation
        self.running = False
        self.thread = None

    def start(self):
        """Starts USB monitoring in a background thread."""
        self.running = True
        self.thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.thread.start()
        print("[USB Sensor] Monitoring initialized.")

    def stop(self):
        self.running = False

    def _monitor_loop(self):
        """Cross-platform drive polling + Win32 WMI event listener."""
        if sys.platform == "win32":
            self._win32_usb_listen()
        else:
            self._generic_drive_poll()

    def _win32_usb_listen(self):
        """Windows WMI / Drive volume detection for USB insertion."""
        known_drives = self._get_removable_drives()
        
        while self.running:
            try:
                current_drives = self._get_removable_drives()
                new_drives = current_drives - known_drives
                
                if new_drives:
                    for drive in new_drives:
                        v_info = VIOLATION_CODES["H1"]
                        print(f"[ALERT H1] USB Device Inserted: Drive {drive}")
                        if self.callback:
                            self.callback(
                                code="H1",
                                title=v_info["title"],
                                severity=v_info["severity"],
                                description=f"Physical USB drive inserted at volume: {drive}",
                                detected_value=drive
                            )
                    known_drives = current_drives
                elif len(current_drives) < len(known_drives):
                    known_drives = current_drives
                    
            except Exception as e:
                print(f"[USB Sensor Warning] {e}")
                
            time.sleep(1.5)

    def _get_removable_drives(self):
        """Returns set of drive letters for removable USB storage."""
        drives = set()
        if sys.platform == "win32":
            try:
                import win32file
                for drive_letter in "EFGHIJKLMNOPQRSTUVWXYZ":
                    path = f"{drive_letter}:\\"
                    drive_type = win32file.GetDriveType(path)
                    # DRIVE_REMOVABLE = 2
                    if drive_type == 2:
                        drives.add(path)
            except Exception:
                pass
        return drives

    def _generic_drive_poll(self):
        """Fallback polling for non-Windows platforms."""
        while self.running:
            time.sleep(2.0)
