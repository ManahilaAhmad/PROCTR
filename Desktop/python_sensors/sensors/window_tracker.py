import sys
import os
import json
import time
import threading
import psutil
from python_sensors.config import DEFAULT_WHITELISTED_PROCESSES, VIOLATION_CODES

LOG_DIR = r"C:\PROCTR_Exams\offline_logs" if sys.platform == "win32" else os.path.expanduser("~/PROCTR_Exams/offline_logs")

def _write_window_log_file(record: dict):
    """Appends a window/process violation record to daily log file."""
    try:
        os.makedirs(LOG_DIR, exist_ok=True)
        date_str = time.strftime("%Y-%m-%d")
        log_path = os.path.join(LOG_DIR, f"window_log_{date_str}.json")
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
        print(f"[WindowTracker] Could not write log file: {e}")
        return None


def parse_active_site_or_doc(proc_name, window_title):
    """
    Parses active website (ChatGPT, Claude, YouTube, GitHub, Stack Overflow) or document title.
    """
    proc_lower = (proc_name or "").lower()
    title_lower = (window_title or "").lower()

    is_browser = any(b in proc_lower for b in ["chrome.exe", "msedge.exe", "firefox.exe", "brave.exe", "opera.exe", "iexplore.exe"])

    site_category = "Software Application"
    clean_title = window_title or "Untitled Window"

    if is_browser:
        if "chatgpt" in title_lower or "openai" in title_lower:
            site_category = "🤖 ChatGPT / OpenAI"
        elif "claude" in title_lower:
            site_category = "🧠 Claude AI"
        elif "youtube" in title_lower:
            site_category = "🎥 YouTube"
        elif "github" in title_lower:
            site_category = "🐙 GitHub"
        elif "stackoverflow" in title_lower or "stack overflow" in title_lower:
            site_category = "💻 Stack Overflow"
        elif "gemini" in title_lower:
            site_category = "♊ Google Gemini"
        elif "discord" in title_lower:
            site_category = "💬 Discord"
        elif "google search" in title_lower or "search" in title_lower:
            site_category = "🔍 Google Search"
        else:
            site_category = "🌐 Web Browser"

        # Strip browser suffixes for clean site title
        for suffix in [" - Google Chrome", " - Microsoft Edge", " — Mozilla Firefox", " - Brave", " - Opera", " - Internet Explorer"]:
            if clean_title.endswith(suffix):
                clean_title = clean_title[:-len(suffix)].strip()

    return site_category, clean_title


class WindowTracker:
    """
    Sensor 3: Active Window Focus & Website Tracker (H2 & H3 Violations)
    - H2 Violation: Detects non-whitelisted app & exact website being viewed (ChatGPT, Claude, YouTube, etc.).
    - H3 Violation: Window focus lost for an extended period (> away_threshold_sec seconds).
    """

    def __init__(self, callback_on_violation=None, custom_whitelist=None, away_threshold_sec=10, violation_callback=None):
        self.callback = callback_on_violation or violation_callback
        self.whitelist = set(custom_whitelist) if custom_whitelist else DEFAULT_WHITELISTED_PROCESSES
        # Ensure system & core launcher tools are whitelisted
        self.whitelist.update({"explorer.exe", "proctr-desktop.exe", "electron.exe", "python.exe", "pythonw.exe", "cmd.exe", "conhost.exe"})
        self.away_threshold_sec = away_threshold_sec
        
        self.running = False
        self.thread = None
        self.last_away_time = None
        self.away_logged = False
        self.last_flagged_title = None

    def update_whitelist(self, new_whitelist):
        """Allows dynamic whitelist updating from Teacher exam options."""
        self.whitelist = set(new_whitelist).union({"explorer.exe", "proctr-desktop.exe", "electron.exe", "python.exe", "pythonw.exe", "cmd.exe", "conhost.exe"})

    def start(self):
        """Starts window and process focus tracking thread."""
        self.running = True
        self.thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.thread.start()
        print("[Window Tracker] Active Window & Website Monitoring initialized.")

    def stop(self):
        self.running = False

    def _monitor_loop(self):
        while self.running:
            try:
                active_process, window_title, exe_path = self._get_active_window_info()
                
                if active_process:
                    active_process_lower = active_process.lower()
                    
                    # 1. Antigravity IDE & Essential Developer Tools Protection
                    is_antigravity = "antigravity" in active_process_lower
                    is_whitelisted = is_antigravity or any(active_process_lower == w.lower() for w in self.whitelist)
                    
                    title_lower = (window_title or "").lower()
                    is_ai_breach = any(ai_kw in title_lower for ai_kw in ["chatgpt", "openai", "claude", "gemini", "bard", "perplexity"]) or ("copilot" in title_lower and "microsoft edge" not in title_lower)
                    now_time = time.strftime("%H:%M:%S")
                    full_date = time.strftime("%Y-%m-%d %H:%M:%S")

                    # Protected system & IDE prefixes — NEVER CLOSE OR KILL THESE!
                    PROTECTED_KEYWORDS = [
                        "antigravity", "proctr", "electron", "python", "explorer",
                        "code", "node", "powershell", "cmd", "conhost", "windowsterminal",
                        "chrome", "msedge", "firefox", "brave", "opera",
                        "system", "svchost", "csrss", "smss", "services", "lsass", "wininit", "winlogon", "taskhostw", "dwm"
                    ]
                    is_protected = any(kw in active_process_lower for kw in PROTECTED_KEYWORDS)

                    if not is_whitelisted or is_ai_breach:
                        # ── ACTIVE OS ENFORCEMENT: Safe Lockdown ────────────────────────────────
                        if is_ai_breach:
                            # Close AI tab cleanly using native Windows API keyboard events
                            try:
                                import ctypes
                                VK_CONTROL = 0x11
                                VK_W = 0x57
                                KEYEVENTF_KEYUP = 0x0002
                                user32 = ctypes.windll.user32
                                user32.keybd_event(VK_CONTROL, 0, 0, 0)
                                user32.keybd_event(VK_W, 0, 0, 0)
                                time.sleep(0.05)
                                user32.keybd_event(VK_W, 0, KEYEVENTF_KEYUP, 0)
                                user32.keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0)
                                print(f"[PROCTR Lockdown Enforced] Closed AI website tab in {active_process}")
                            except Exception as err:
                                print(f"[PROCTR Lockdown] Tab closure error: {err}")
                        elif not is_protected:
                            # Safely close non-whitelisted standalone windows (e.g. VLC, Local LLMs, Discord)
                            try:
                                import win32gui
                                hwnd = win32gui.GetForegroundWindow()
                                if hwnd:
                                    win32gui.PostMessage(hwnd, 0x0010, 0, 0)
                                    print(f"[PROCTR Lockdown Enforced] Closed unauthorized window: {active_process}")
                            except Exception as err:
                                print(f"[PROCTR Lockdown] Window closure error: {err}")

                        # ── H2 VIOLATION LOGGING: Record Alert Once Per Title Key ─────────────────
                        current_title_key = f"{active_process_lower}:{window_title}"
                        if self.last_flagged_title != current_title_key:
                            self.last_flagged_title = current_title_key
                            
                            site_category, clean_title = parse_active_site_or_doc(active_process, window_title)
                            
                            formatted_log = (
                                f"at time {now_time} Student opened '{site_category}' "
                                f"('{clean_title}') in {active_process}"
                            )

                            try:
                                print(f"\n{'='*75}")
                                print(f"[UNAUTHORIZED APP / WEBSITE OPENED - H2]")
                                print(f"   {formatted_log}")
                                print(f"   Category / Site : {site_category}")
                                print(f"   Page / Tab Title: {clean_title}")
                                print(f"   Process Name    : {active_process}")
                                print(f"   Executable Path : {exe_path}")
                                print(f"{'='*75}\n")
                            except Exception:
                                pass

                            json_record = {
                                "timestamp": full_date,
                                "time_str": now_time,
                                "violation_code": "H2",
                                "severity": "HIGH",
                                "site_category": site_category,
                                "clean_title": clean_title,
                                "process_name": active_process,
                                "window_title": window_title,
                                "exe_path": exe_path,
                                "formatted_log": formatted_log
                            }
                            log_path = _write_window_log_file(json_record)
                            if log_path:
                                try:
                                    print(f"Forensic Log Saved -> {log_path}\n")
                                except Exception:
                                    pass

                            if self.callback:
                                v_info = VIOLATION_CODES.get("H2", {"title": "Unauthorized Application Execution", "severity": "HIGH"})
                                try:
                                    self.callback(
                                        code="H2",
                                        title=v_info["title"],
                                        severity=v_info["severity"],
                                        description=f"Opened '{site_category}' ({clean_title}) in {active_process}",
                                        detected_value=formatted_log
                                    )
                                except TypeError:
                                    try:
                                        self.callback("H2", formatted_log)
                                    except Exception:
                                        pass

                        # ── H3 VIOLATION: Extended Focus Loss Timer ───────────
                        if self.last_away_time is None:
                            self.last_away_time = time.time()
                        else:
                            away_duration = int(time.time() - self.last_away_time)
                            if away_duration >= self.away_threshold_sec and not self.away_logged:
                                self.away_logged = True
                                site_category, clean_title = parse_active_site_or_doc(active_process, window_title)
                                formatted_h3 = (
                                    f"at time {now_time} Student has been away from exam workspace "
                                    f"for {away_duration} seconds (Viewing '{site_category}': {clean_title})"
                                )

                                print(f"\n{'='*75}")
                                print(f"🚨 [EXTENDED WINDOW FOCUS LOSS — H3]")
                                print(f"   {formatted_h3}")
                                print(f"   Away Duration: {away_duration} seconds")
                                print(f"   Active Site  : {site_category} ('{clean_title}')")
                                print(f"{'='*75}\n")

                                json_record = {
                                    "timestamp": full_date,
                                    "time_str": now_time,
                                    "violation_code": "H3",
                                    "severity": "MEDIUM",
                                    "away_duration_sec": away_duration,
                                    "site_category": site_category,
                                    "clean_title": clean_title,
                                    "process_name": active_process,
                                    "formatted_log": formatted_h3
                                }
                                log_path = _write_window_log_file(json_record)
                                if log_path:
                                    print(f"📁 Forensic Log Saved → {log_path}\n")

                                if self.callback:
                                    v3_info = VIOLATION_CODES.get("H3", {"title": "Window Focus Loss / Away Breach", "severity": "MEDIUM"})
                                    try:
                                        self.callback(
                                            code="H3",
                                            title=v3_info["title"],
                                            severity=v3_info["severity"],
                                            description=f"Student focused away for {away_duration} seconds.",
                                            detected_value=formatted_h3
                                        )
                                    except TypeError:
                                        try:
                                            self.callback("H3", formatted_h3)
                                        except Exception:
                                            pass
                    else:
                        # Student is back in whitelisted exam workspace
                        self.last_away_time = None
                        self.away_logged = False
                        self.last_flagged_title = None

            except Exception:
                pass
                
            time.sleep(1.0)

    def _get_active_window_info(self):
        """Returns (process_name, window_title, exe_path) of current foreground window."""
        if sys.platform == "win32":
            try:
                import win32gui
                import win32process
                
                hwnd = win32gui.GetForegroundWindow()
                if not hwnd:
                    return None, "", ""
                    
                window_title = win32gui.GetWindowText(hwnd)
                _, pid = win32process.GetWindowThreadProcessId(hwnd)
                
                try:
                    proc = psutil.Process(pid)
                    return proc.name(), window_title, proc.exe()
                except Exception:
                    return None, window_title, ""
            except Exception:
                return None, "", ""
        return None, "", ""
