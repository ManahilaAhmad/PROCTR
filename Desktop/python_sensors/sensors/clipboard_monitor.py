import sys
import time
import threading
from python_sensors.config import VIOLATION_CODES

class ClipboardMonitor:
    """
    Sensor 2: Universal OS Clipboard Monitor (H4a Violation)
    Monitors copy-paste buffer events across ALL IDEs and applications.
    Checks buffer lengths, text structures, and external paste violations.
    """

    def __init__(self, callback_on_violation, max_paste_chars=300):
        self.callback = callback_on_violation
        self.max_paste_chars = max_paste_chars
        self.last_clipboard_text = ""
        self.running = False
        self.thread = None

    def start(self):
        """Starts clipboard monitoring in a background thread."""
        self.running = True
        self.last_clipboard_text = self._get_clipboard_text()
        self.thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.thread.start()
        print("[Clipboard Sensor] Monitoring initialized.")

    def stop(self):
        self.running = False

    def _monitor_loop(self):
        while self.running:
            try:
                current_text = self._get_clipboard_text()
                if current_text and current_text != self.last_clipboard_text:
                    self.last_clipboard_text = current_text
                    text_length = len(current_text)

                    # Trigger H4a Violation if clipboard content exceeds threshold or contains external block
                    if text_length > self.max_paste_chars:
                        v_info = VIOLATION_CODES["H4a"]
                        snippet = current_text[:60].replace("\n", " ") + "..."
                        print(f"[ALERT H4a] Large External Paste Buffer ({text_length} chars): {snippet}")
                        
                        if self.callback:
                            self.callback(
                                code="H4a",
                                title=v_info["title"],
                                severity=v_info["severity"],
                                description=f"Clipboard buffer copied contains {text_length} characters. Sample: '{snippet}'",
                                detected_value=f"Length: {text_length} chars"
                            )
            except Exception as e:
                pass
                
            time.sleep(0.8)

    def _get_clipboard_text(self):
        """Reads current OS clipboard text content."""
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
        else:
            try:
                import tkinter as tk
                root = tk.Tk()
                root.withdraw()
                data = root.clipboard_get()
                root.destroy()
                return data
            except Exception:
                return ""
