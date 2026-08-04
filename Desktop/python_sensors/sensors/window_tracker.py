import sys
import time
import threading
import psutil
from python_sensors.config import DEFAULT_WHITELISTED_PROCESSES, VIOLATION_CODES

class WindowTracker:
    """
    Sensor 3: Active Window Focus & Process Whitelist Tracker (H2 & H3 Violations)
    - H2 Violation: Unauthorized non-whitelisted process running in foreground.
    - H3 Violation: Window focus lost for an extended period (> 15 seconds away).
    """

    def __init__(self, callback_on_violation, custom_whitelist=None, away_threshold_sec=15):
        self.callback = callback_on_violation
        self.whitelist = set(custom_whitelist) if custom_whitelist else DEFAULT_WHITELISTED_PROCESSES
        self.away_threshold_sec = away_threshold_sec
        
        self.running = False
        self.thread = None
        self.last_away_time = None
        self.away_logged = False

    def update_whitelist(self, new_whitelist):
        """Allows dynamic whitelist updating from Teacher exam options."""
        self.whitelist = set(new_whitelist).union({"explorer.exe", "proctr-desktop.exe", "electron.exe", "python.exe"})

    def start(self):
        """Starts window and process focus tracking thread."""
        self.running = True
        self.thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.thread.start()
        print("[Window Sensor] Focus & Process Whitelist monitoring initialized.")

    def stop(self):
        self.running = False

    def _monitor_loop(self):
        while self.running:
            try:
                active_process, window_title = self._get_active_window_info()
                
                if active_process:
                    active_process_lower = active_process.lower()
                    
                    # 1. H2 Check: Unauthorized Process Launch
                    is_whitelisted = any(active_process_lower == w.lower() for w in self.whitelist)
                    
                    if not is_whitelisted:
                        # Log H2 Violation
                        v_info = VIOLATION_CODES["H2"]
                        print(f"[ALERT H2] Unauthorized Process Active: {active_process} (Title: {window_title})")
                        
                        if self.callback:
                            self.callback(
                                code="H2",
                                title=v_info["title"],
                                severity=v_info["severity"],
                                description=f"Unauthorized process active in foreground: {active_process} ('{window_title}')",
                                detected_value=f"Process: {active_process}"
                            )

                        # Track time away for H3 Check
                        if self.last_away_time is None:
                            self.last_away_time = time.time()
                        else:
                            away_duration = time.time() - self.last_away_time
                            if away_duration >= self.away_threshold_sec and not self.away_logged:
                                self.away_logged = True
                                v3_info = VIOLATION_CODES["H3"]
                                print(f"[ALERT H3] Extended Window Focus Loss ({int(away_duration)}s away)")
                                if self.callback:
                                    self.callback(
                                        code="H3",
                                        title=v3_info["title"],
                                        severity=v3_info["severity"],
                                        description=f"Student focused away from exam for {int(away_duration)} seconds.",
                                        detected_value=f"Away Duration: {int(away_duration)}s"
                                    )
                    else:
                        # Student is back in whitelisted exam workspace
                        self.last_away_time = None
                        self.away_logged = False
                        
            except Exception as e:
                pass
                
            time.sleep(1.0)

    def _get_active_window_info(self):
        """Returns (process_name, window_title) of current foreground window."""
        if sys.platform == "win32":
            try:
                import win32gui
                import win32process
                
                hwnd = win32gui.GetForegroundWindow()
                if not hwnd:
                    return None, ""
                    
                window_title = win32gui.GetWindowText(hwnd)
                _, pid = win32process.GetWindowThreadProcessId(hwnd)
                
                try:
                    proc = psutil.Process(pid)
                    return proc.name(), window_title
                except Exception:
                    return None, window_title
            except Exception:
                return None, ""
        else:
            return "python.exe", "Mock Exam Window"
