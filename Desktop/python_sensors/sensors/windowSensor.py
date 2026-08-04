import sys
import time
import threading
import psutil
from python_sensors.config import DEFAULT_WHITELISTED_PROCESSES, VIOLATION_CODES

class WindowSensor:
    """
    Sensor 3: Active Window Focus & Process Whitelist Tracker (H2 & H3 Violations)
    - H2 Violation: Unauthorized process running in foreground.
    - H3 Violation: Window focus lost for > 15 seconds.
    """

    def __init__(self, violation_callback, custom_whitelist=None, away_threshold_sec=15):
        self.callback = violation_callback
        self.whitelist = set(custom_whitelist) if custom_whitelist else DEFAULT_WHITELISTED_PROCESSES
        self.away_threshold_sec = away_threshold_sec
        self.running = False
        self.thread = None
        self.last_away_time = None
        self.away_logged = False

    def start(self):
        self.running = True
        self.thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.thread.start()
        print("[WindowSensor] Focus & Process Whitelist monitoring initialized.")

    def stop(self):
        self.running = False

    def _monitor_loop(self):
        while self.running:
            try:
                proc_name, window_title = self._get_active_window_info()
                if proc_name:
                    proc_lower = proc_name.lower()
                    is_whitelisted = any(proc_lower == w.lower() for w in self.whitelist)

                    if not is_whitelisted:
                        print(f"[WindowSensor ALERT H2] Unauthorized App: {proc_name}")
                        if self.callback:
                            self.callback("H2", detected_value=f"Process: {proc_name} ('{window_title}')")

                        if self.last_away_time is None:
                            self.last_away_time = time.time()
                        else:
                            away_dur = time.time() - self.last_away_time
                            if away_dur >= self.away_threshold_sec and not self.away_logged:
                                self.away_logged = True
                                print(f"[WindowSensor ALERT H3] Away Duration: {int(away_dur)}s")
                                if self.callback:
                                    self.callback("H3", detected_value=f"{int(away_dur)}s away")
                    else:
                        self.last_away_time = None
                        self.away_logged = False
            except Exception:
                pass
            time.sleep(1.0)

    def _get_active_window_info(self):
        if sys.platform == "win32":
            try:
                import win32gui
                import win32process
                hwnd = win32gui.GetForegroundWindow()
                if not hwnd:
                    return None, ""
                title = win32gui.GetWindowText(hwnd)
                _, pid = win32process.GetWindowThreadProcessId(hwnd)
                proc = psutil.Process(pid)
                return proc.name(), title
            except Exception:
                return None, ""
        return "python.exe", "Exam Window"
