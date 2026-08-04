import sys
import time
import threading
from python_sensors.config import VIOLATION_CODES

class ClipboardSensor:
    """
    Sensor 2: Universal OS Clipboard Monitor (H4a Violation)
    Monitors copy-paste buffer events across ALL IDEs and applications.
    """

    def __init__(self, violation_callback, max_paste_chars=300):
        self.callback = violation_callback
        self.max_paste_chars = max_paste_chars
        self.last_text = ""
        self.running = False
        self.thread = None

    def start(self):
        self.running = True
        self.last_text = self._get_clipboard_text()
        self.thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.thread.start()
        print("[ClipboardSensor] Monitoring initialized.")

    def stop(self):
        self.running = False

    def _monitor_loop(self):
        while self.running:
            try:
                current_text = self._get_clipboard_text()
                if current_text and current_text != self.last_text:
                    self.last_text = current_text
                    length = len(current_text)

                    if length > self.max_paste_chars:
                        snippet = current_text[:50].replace("\n", " ")
                        print(f"[ClipboardSensor ALERT] Large Paste Buffer ({length} chars)")
                        if self.callback:
                            self.callback("H4a", detected_value=f"{length} chars: '{snippet}'")
            except Exception:
                pass
            time.sleep(0.8)

    def _get_clipboard_text(self):
        if sys.platform == "win32":
            try:
                import win32clipboard
                win32clipboard.OpenClipboard()
                if win32clipboard.IsClipboardFormatAvailable(win32clipboard.CF_UNICODETEXT):
                    data = win32clipboard.GetClipboardData(win32clipboard.CF_UNICODETEXT)
                else:
                    data = ""
                win32clipboard.CloseClipboard()
                return data
            except Exception:
                return ""
        return ""
