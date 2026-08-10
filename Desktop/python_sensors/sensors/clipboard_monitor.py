import sys
import os
import json
import time
import threading
import psutil
from python_sensors.config import VIOLATION_CODES

LOG_DIR = r"C:\PROCTR_Exams\offline_logs" if sys.platform == "win32" else os.path.expanduser("~/PROCTR_Exams/offline_logs")

def _write_log_file(record: dict):
    """Appends a copy-paste forensic record to the daily log file."""
    try:
        os.makedirs(LOG_DIR, exist_ok=True)
        date_str = time.strftime("%Y-%m-%d")
        log_path = os.path.join(LOG_DIR, f"clipboard_log_{date_str}.json")
        records = []
        if os.path.exists(log_path):
            try:
                with open(log_path, "r", encoding="utf-8") as f:
                    records = json.load(f)
            except Exception:
                records = []
        records.append(record)
        with open(log_path, "w", encoding="utf-8") as f:
            json.dump(records, f, indent=2, ensure_ascii=False)
        return log_path
    except Exception as e:
        print(f"[ClipboardMonitor] Could not write log file: {e}")
        return None

_write_clipboard_log_file = _write_log_file


def resolve_file_and_app_info():
    """
    Extracts foreground process name, window title, AND full file path being edited/viewed.
    """
    if sys.platform != "win32":
        return "unknown.exe", "Unknown Window", "Unknown File Path"

    try:
        import win32gui
        import win32process

        hwnd = win32gui.GetForegroundWindow()
        if not hwnd:
            return "unknown.exe", "Unknown Window", "Unknown File Path"

        title = win32gui.GetWindowText(hwnd)
        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        proc = psutil.Process(pid)
        proc_name = proc.name().lower()
        exe_path = proc.exe()

        file_path = None

        # 1. Try resolving file path from process command line arguments
        try:
            cmdline = proc.cmdline()
            for arg in cmdline[1:]:
                if os.path.isfile(arg):
                    file_path = os.path.abspath(arg)
                    break
        except Exception:
            pass

        # 2. Try resolving open file handles for common code/document files
        if not file_path:
            try:
                for open_file in proc.open_files():
                    ext = os.path.splitext(open_file.path)[1].lower()
                    if ext in ['.py', '.txt', '.cpp', '.c', '.java', '.docx', '.pdf', '.md', '.json', '.html', '.css', '.js', '.cs']:
                        file_path = os.path.abspath(open_file.path)
                        break
            except Exception:
                pass

        # 3. Try parsing filename/path from Window Title (e.g. "cheating.txt - Notepad")
        if not file_path and title:
            parts = title.split(" - ")
            for part in parts:
                cleaned = part.strip().strip("*").strip()
                if os.path.isfile(cleaned):
                    file_path = os.path.abspath(cleaned)
                    break
                elif "." in cleaned and len(cleaned) > 2 and not cleaned.endswith(".exe"):
                    file_path = cleaned

        final_path = file_path or exe_path or title or "Unknown Path"
        return proc_name, title, final_path

    except Exception:
        return "unknown.exe", "Unknown Window", "Unknown File Path"


def _get_clipboard_text():
    """Reads current OS clipboard text."""
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


def _clear_clipboard():
    """Empties the OS clipboard buffer completely."""
    if sys.platform == "win32":
        try:
            import win32clipboard
            win32clipboard.OpenClipboard()
            win32clipboard.EmptyClipboard()
            win32clipboard.CloseClipboard()
        except Exception:
            pass


class ClipboardMonitor:
    """
    Forensic Copy-Paste File & Path Tracking Sensor (H4a Violation):
    - Multi-thread engine: combines keyboard event hooks (Ctrl+C, Ctrl+V) with clipboard polling.
    - Resolves EXACT source file path (e.g. D:\\cheat_notes\\cheating.txt) and destination file path (e.g. C:\\Exam\\python.py).
    - Logs exact format: "at time 10:55:27 879 characters were copied from D:\\cheating.txt to C:\\Exam\\python.py"
    """

    def __init__(self, callback_on_violation=None, max_paste_chars=300, auto_clear=False):
        self.callback = callback_on_violation
        self.max_paste_chars = max_paste_chars
        self.auto_clear = auto_clear  # Default to False for clear testing feedback
        self.running = False
        self.last_clipboard_text = ""
        self.pending_copy = None  # Holds copy source details until paste
        self._ctrl_held = False
        self._listener = None

    def start(self):
        """Starts keyboard hook listener and polling thread."""
        self.running = True
        self.last_clipboard_text = _get_clipboard_text()

        # Thread 1: pynput Keyboard listener for Ctrl+C / Ctrl+V
        t1 = threading.Thread(target=self._start_keyboard_listener, daemon=True)
        t1.start()

        # Thread 2: Fallback polling thread for clipboard content change
        t2 = threading.Thread(target=self._monitor_polling_loop, daemon=True)
        t2.start()

        print("[ClipboardMonitor] Forensic Copy-Paste Source/Destination Path Engine active.")

    def stop(self):
        self.running = False
        if self._listener:
            try:
                self._listener.stop()
            except Exception:
                pass

    def _start_keyboard_listener(self):
        from pynput import keyboard

        def on_press(key):
            try:
                if key in (keyboard.Key.ctrl, keyboard.Key.ctrl_l, keyboard.Key.ctrl_r):
                    self._ctrl_held = True

                char_val = getattr(key, 'char', None)
                vk_val = getattr(key, 'vk', None)

                # Direct ASCII control code checks: \x03 is Ctrl+C, \x16 is Ctrl+V
                is_copy = char_val == '\x03' or (self._ctrl_held and (char_val in ('c', 'C') or vk_val == 67))
                is_paste = char_val == '\x16' or (self._ctrl_held and (char_val in ('v', 'V') or vk_val == 86))

                if is_copy:
                    threading.Thread(target=self._on_copy_triggered, daemon=True).start()
                elif is_paste:
                    threading.Thread(target=self._on_paste_triggered, daemon=True).start()
            except Exception:
                pass

        def on_release(key):
            try:
                if key in (keyboard.Key.ctrl, keyboard.Key.ctrl_l, keyboard.Key.ctrl_r):
                    self._ctrl_held = False
            except Exception:
                pass

        try:
            with keyboard.Listener(on_press=on_press, on_release=on_release) as listener:
                self._listener = listener
                listener.join()
        except Exception:
            pass

    def _on_copy_triggered(self):
        """Called immediately when copy (Ctrl+C or clipboard update) occurs."""
        time.sleep(0.08)  # Wait 80ms for OS clipboard buffer update
        proc, title, file_path = resolve_file_and_app_info()
        text = _get_clipboard_text()

        if not text:
            return

        char_count = len(text)
        word_count = len(text.split())
        line_count = text.count("\n") + 1
        snippet = text[:100].replace("\n", " ") + ("..." if char_count > 100 else "")
        now_time = time.strftime("%H:%M:%S")
        full_date = time.strftime("%Y-%m-%d %H:%M:%S")

        EXAM_SAFE_APPS = {
            "code.exe", "pycharm64.exe", "devenv.exe", "codeblocks.exe",
            "devcpp.exe", "notepad++.exe", "sublime_text.exe", "eclipse.exe",
            "idea64.exe", "python.exe", "pythonw.exe", "cmd.exe", "powershell.exe",
            "proctr-desktop.exe", "electron.exe"
        }

        # Check if source file is in Teacher_Starter_Code or Submission safe-zone
        path_lower = os.path.abspath(file_path).lower() if file_path and not file_path.startswith("Unknown") else ""
        is_safe_zone = any(z in path_lower for z in ["submission", "teacher_starter_code", "starter_code"])

        is_safe_app = proc in EXAM_SAFE_APPS
        is_large = char_count > self.max_paste_chars

        # Flag as threat if outside safe-zone, not safe app, or exceeds char limit
        if (not is_safe_zone and not is_safe_app) or (not is_safe_zone and is_large) or (not is_safe_app):
            self.pending_copy = {
                "proc": proc,
                "title": title,
                "file_path": file_path,
                "char_count": char_count,
                "word_count": word_count,
                "line_count": line_count,
                "snippet": snippet,
                "time_str": now_time,
                "timestamp": full_date,
                "text": text,
                "is_safe_zone": is_safe_zone
            }
            log_msg = f"at time {now_time} {char_count} characters were copied from {file_path}"
            print(f"\n📋 [COPY EVENT LOGGED]")
            print(f"   --> {log_msg}")
            print(f"   App Name: [{proc}] '{title}'")
            print(f"   Snippet : '{snippet}'\n")

    def _on_paste_triggered(self):
        """Called immediately when paste (Ctrl+V) or destination switch occurs."""
        if not self.pending_copy:
            return

        time.sleep(0.05)
        proc_dest, title_dest, file_path_dest = resolve_file_and_app_info()
        src = self.pending_copy

        # Check if destination paste is into Submission folder
        path_dest_lower = os.path.abspath(file_path_dest).lower() if file_path_dest and not file_path_dest.startswith("Unknown") else ""
        dest_is_safe_zone = any(z in path_dest_lower for z in ["submission", "teacher_starter_code", "starter_code"])

        # Case 1: Copy source was OUTSIDE safe-zone, pasted INTO workspace (Import Violation)
        # Case 2: Copy source was INSIDE safe-zone, pasted OUTSIDE workspace (Export Leak Violation)
        src_is_safe = src.get("is_safe_zone", False)

        if not src_is_safe or (src_is_safe and not dest_is_safe_zone):
            if src_is_safe and not dest_is_safe_zone:
                v_title = "Unauthorized Exam File Export Attempt"
                v_desc = "Student attempted copying exam submission content outside workspace."
            else:
                v_title = "Unauthorized Copy-Paste Breach"
                v_desc = "Copied text from non-whitelisted source into workspace."

            formatted_log = (
                f"at time {src['time_str']} {src['char_count']} characters "
                f"were copied from {src['file_path']} to {file_path_dest}"
            )

            print(f"\n{'='*75}")
            print(f"🚨 [{v_title.upper()} — H4a]")
            print(f"   {formatted_log}")
            print(f"   Source App : [{src['proc']}] '{src['title']}'")
            print(f"   Source Path: {src['file_path']}")
            print(f"   Dest Path  : {file_path_dest}")
            print(f"   Chars/Words: {src['char_count']} chars, {src['word_count']} words")
            print(f"   Snippet    : '{src['snippet']}'")
            print(f"{'='*75}\n")

            json_record = {
                "timestamp": src["timestamp"],
                "time_str": src["time_str"],
                "violation_code": "H4a",
                "severity": "CRITICAL",
                "source_app": src["proc"],
                "source_title": src["title"],
                "source_file_path": src["file_path"],
                "dest_file_path": file_path_dest,
                "char_count": src["char_count"],
                "word_count": src["word_count"],
                "line_count": src["line_count"],
                "snippet": src["snippet"],
                "formatted_log": formatted_log
            }
            log_path = _write_clipboard_log_file(json_record)
            if log_path:
                print(f"📁 Forensic Log Saved → {log_path}\n")

            if self.auto_clear:
                self._clear_clipboard()

            if self.callback:
                try:
                    self.callback(
                        code="H4a",
                        title=v_title,
                        severity="CRITICAL",
                        description=v_desc,
                        detected_value=formatted_log
                    )
                except TypeError:
                    try:
                        self.callback("H4a", formatted_log)
                    except Exception:
                        pass

        self.pending_copy = None

    def _monitor_polling_loop(self):
        """Fallback polling thread: detects clipboard content changes."""
        while self.running:
            try:
                current_text = _get_clipboard_text()
                if current_text and current_text != self.last_clipboard_text:
                    self.last_clipboard_text = current_text
                    if not self.pending_copy:
                        self._on_copy_triggered()
            except Exception:
                pass
            time.sleep(0.4)
