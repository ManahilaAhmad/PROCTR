import sys
import os
import json
import time
import socket
import threading
import psutil
from http.server import HTTPServer, BaseHTTPRequestHandler
from python_sensors.config import DEFAULT_ALLOWED_DOMAINS, VIOLATION_CODES

LOG_DIR = r"C:\PROCTR_Exams\offline_logs" if sys.platform == "win32" else os.path.expanduser("~/PROCTR_Exams/offline_logs")

def _write_dns_log_file(record: dict):
    """Appends a DNS violation record to daily log file."""
    try:
        os.makedirs(LOG_DIR, exist_ok=True)
        date_str = time.strftime("%Y-%m-%d")
        log_path = os.path.join(LOG_DIR, f"dns_log_{date_str}.json")
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
        print(f"[DNSSensor] Could not write log file: {e}")
        return None


class ProctrBlockPageHandler(BaseHTTPRequestHandler):
    """Serves custom 403 Access Denied HTML page when blocked sites are opened."""

    def do_GET(self):
        self.send_response(403)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        html = """<!DOCTYPE html>
<html>
<head>
  <title>PROCTR — 403 Access Denied</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #1e293b; padding: 40px; border-radius: 12px; border: 2px solid #ef4444; max-width: 480px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
    .badge { background: #7f1d1d; color: #fecaca; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: bold; letter-spacing: 1px; display: inline-block; margin-bottom: 20px; }
    h1 { color: #ef4444; margin-bottom: 12px; font-size: 26px; font-weight: 700; }
    p { color: #94a3b8; font-size: 15px; line-height: 1.6; margin-bottom: 8px; }
    .footer { margin-top: 24px; font-size: 12px; color: #64748b; border-top: 1px solid #334155; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">PROCTR EXAM SECURITY POLICY</div>
    <h1>🚫 403 ACCESS DENIED</h1>
    <p>This web domain is <strong>non-whitelisted</strong> and blocked by active exam security rules.</p>
    <p>Your access attempt has been logged as an <strong>H5 Security Violation</strong>.</p>
    <div class="footer">PROCTR Lab Exam Protection Engine &copy; 2026</div>
  </div>
</body>
</html>"""
        self.wfile.write(html.encode("utf-8"))

    def log_message(self, format, *args):
        pass  # Suppress HTTP server console logs


class DNSSensor:
    """
    Sensor 5: Strict OS DNS & Domain Whitelist Filtering Sensor (H5 Violation)
    
    Policy: DEFAULT DENY (Strict Allowlist)
    - EVERYTHING is BLOCKED by default (ChatGPT, Claude, Gemini, YouTube, Reddit, Discord, etc.).
    - ONLY domains explicitly added to the Whitelist (e.g., instagram.com, university.edu) are ALLOWED.
    - Active Hosts Sinkhole Engine: Redirects non-whitelisted hostnames to 127.0.0.1 loopback on Windows.
    - Serves 403 Forbidden PROCTR Access Denied Block Page.
    """

    def __init__(self, violation_callback=None, custom_domains=None, active_blocking=True):
        self.callback = violation_callback
        initial_domains = custom_domains or {"instagram.com", "university.edu", "neon.tech", "cloudinary.com"}
        self.allowed_domains = set(d.lower().strip() for d in initial_domains)
        self.allowed_domains.update({"localhost", "127.0.0.1", "0.0.0.0", "::1"})
        
        self.active_blocking = active_blocking
        self.flagged_hosts = set()
        self.running = False
        self.thread = None
        self.http_server = None
        self.hosts_path = r"C:\Windows\System32\drivers\etc\hosts" if sys.platform == "win32" else "/etc/hosts"
        self.hosts_backup = None

        import atexit
        import signal
        atexit.register(self._restore_hosts_file)

        def signal_cleaner(sig, frame):
            self._restore_hosts_file()
            sys.exit(0)

        try:
            signal.signal(signal.SIGINT, signal_cleaner)
            signal.signal(signal.SIGTERM, signal_cleaner)
            if hasattr(signal, "SIGBREAK"):
                signal.signal(signal.SIGBREAK, signal_cleaner)
        except Exception:
            pass

    def update_allowed_domains(self, domain_list):
        """Dynamically update allowed domains from Teacher exam options in real-time."""
        self.allowed_domains = set(d.lower().strip() for d in domain_list)
        self.allowed_domains.update({"localhost", "127.0.0.1", "0.0.0.0", "::1"})
        if self.active_blocking:
            self._restore_hosts_file()
            self._apply_hosts_sinkhole()
        print(f"🔄 [DNSSensor] Policy updated live. Allowed domains: {list(self.allowed_domains)}")

    def validate_domain(self, target_domain_or_url):
        """Returns True ONLY if target domain is explicitly in Whitelist (DEFAULT DENY)."""
        if not target_domain_or_url:
            return False

        clean_target = target_domain_or_url.lower().replace("https://", "").replace("http://", "").split("/")[0].split(":")[0].strip()
        
        if clean_target in ("localhost", "127.0.0.1", "0.0.0.0", "::1"):
            return True

        for allowed in self.allowed_domains:
            if clean_target == allowed or clean_target.endswith("." + allowed):
                return True
        return False

    def start(self):
        self.running = True

        # Start 403 Block Page HTTP Server on port 80 (or fallback 8080)
        self._start_http_block_server()

        if self.active_blocking:
            self._apply_hosts_sinkhole()

        self.thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.thread.start()
        print(f"[DNSSensor] Strict Allowlist DNS Filter active. Permitted Domains: {list(self.allowed_domains)}")

    def stop(self):
        self.running = False
        if self.http_server:
            try:
                self.http_server.shutdown()
            except Exception:
                pass
        if self.active_blocking:
            self._restore_hosts_file()

    def _start_http_block_server(self):
        """Runs local 403 Forbidden HTTP server on loopback to display PROCTR Block Page."""
        def run_server():
            for port in [80, 8080, 8888]:
                try:
                    server = HTTPServer(("127.0.0.1", port), ProctrBlockPageHandler)
                    self.http_server = server
                    server.serve_forever()
                    break
                except Exception:
                    continue
        t = threading.Thread(target=run_server, daemon=True)
        t.start()

    def _apply_hosts_sinkhole(self):
        """Maps blocked test domains to 127.0.0.1 loopback sinkhole in OS hosts file."""
        if not os.path.exists(self.hosts_path):
            return
        try:
            with open(self.hosts_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

            COMMON_SINKHOLE_DOMAINS = [
                "chatgpt.com", "www.chatgpt.com", "chat.openai.com", "openai.com",
                "claude.ai", "gemini.google.com", "youtube.com", "www.youtube.com",
                "facebook.com", "reddit.com", "discord.com"
            ]

            if "# PROCTR_DNS_SINKHOLE_START" not in content:
                self.hosts_backup = content
                sinkhole_lines = ["\n# PROCTR_DNS_SINKHOLE_START"]
                for domain in COMMON_SINKHOLE_DOMAINS:
                    if not self.validate_domain(domain):
                        sinkhole_lines.append(f"127.0.0.1 {domain}")
                sinkhole_lines.append("# PROCTR_DNS_SINKHOLE_END\n")

                new_content = content + "\n" + "\n".join(sinkhole_lines)
                with open(self.hosts_path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                
                # Flush Windows DNS Cache so pre-cached resolutions in Chrome/OS RAM are purged
                if sys.platform == "win32":
                    os.system("ipconfig /flushdns >NUL 2>&1")

                print("🔒 [DNSSensor Engine] OS Hosts Sinkhole Active — Blocked domains redirected to 127.0.0.1.")
                print("🧹 [DNSSensor Engine] OS DNS Cache flushed.")
        except Exception as e:
            print(f"⚠️ [DNSSensor Note] Could not write to OS hosts file (Requires Admin privileges): {e}")

    def _restore_hosts_file(self):
        """Restores original OS hosts file."""
        if not os.path.exists(self.hosts_path):
            return
        try:
            with open(self.hosts_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

            if "# PROCTR_DNS_SINKHOLE_START" in content:
                parts = content.split("# PROCTR_DNS_SINKHOLE_START")
                header = parts[0]
                footer = parts[1].split("# PROCTR_DNS_SINKHOLE_END")[-1] if "# PROCTR_DNS_SINKHOLE_END" in parts[1] else ""
                restored = (header + footer).strip() + "\n"
                
                with open(self.hosts_path, "w", encoding="utf-8") as f:
                    f.write(restored)

                if sys.platform == "win32":
                    os.system("ipconfig /flushdns >NUL 2>&1")

                print("🔓 [DNSSensor Engine] OS Hosts file restored to normal.")
        except Exception as e:
            print(f"⚠️ [DNSSensor Note] Could not restore hosts file: {e}")

    def _resolve_ip(self, ip_address):
        """Attempts reverse DNS lookup for remote IP address."""
        try:
            return socket.gethostbyaddr(ip_address)[0].lower()
        except Exception:
            return ip_address

    def _monitor_loop(self):
        while self.running:
            try:
                # Inspect active remote TCP connections
                connections = psutil.net_connections(kind="tcp")
                for conn in connections:
                    if conn.status == psutil.CONN_ESTABLISHED and conn.raddr:
                        remote_ip = conn.raddr.ip
                        if remote_ip in ("127.0.0.1", "0.0.0.0", "::1") or remote_ip.startswith("10.") or remote_ip.startswith("192.168.") or remote_ip.startswith("172."):
                            continue

                        # Identify process PID
                        proc_name = "unknown"
                        if conn.pid:
                            try:
                                proc_name = psutil.Process(conn.pid).name().lower()
                            except Exception:
                                pass

                        SYSTEM_NET_EXEMPTIONS = {
                            "svchost.exe", "system", "idle", "phoneexperiencehost.exe",
                            "antigravity ide.exe", "language_server_windows_x64.exe",
                            "node.exe", "electron.exe", "proctr-desktop.exe",
                            "python.exe", "pythonw.exe", "git.exe", "conhost.exe"
                        }
                        if proc_name in SYSTEM_NET_EXEMPTIONS:
                            continue

                        domain_name = self._resolve_ip(remote_ip)
                        connection_key = domain_name
                        if domain_name and domain_name not in self.flagged_hosts:
                            if not self.validate_domain(domain_name):
                                self.flagged_hosts.add(domain_name)
                                now_time = time.strftime("%H:%M:%S")
                                full_date = time.strftime("%Y-%m-%d %H:%M:%S")

                                formatted_log = (
                                    f"at time {now_time} App '{proc_name}' attempted connection to "
                                    f"non-whitelisted domain '{domain_name}' ({remote_ip})"
                                )

                                print(f"\n{'='*75}")
                                print(f"🚨 [UNAUTHORIZED DOMAIN / DNS ACCESS — H5]")
                                print(f"   {formatted_log}")
                                print(f"   Domain Name : {domain_name}")
                                print(f"   Remote IP   : {remote_ip}")
                                print(f"   Process Name: {proc_name}")
                                print(f"   Policy      : STRICT ALLOWLIST (Default Deny)")
                                print(f"{'='*75}\n")

                                json_record = {
                                    "timestamp": full_date,
                                    "time_str": now_time,
                                    "violation_code": "H5",
                                    "severity": "CRITICAL",
                                    "domain_name": domain_name,
                                    "remote_ip": remote_ip,
                                    "process_name": proc_name,
                                    "formatted_log": formatted_log
                                }
                                log_path = _write_dns_log_file(json_record)
                                if log_path:
                                    print(f"📁 Forensic Log Saved → {log_path}\n")

                                if self.callback:
                                    v_info = VIOLATION_CODES.get("H5", {
                                        "title": "Unauthorized Domain / DNS Access",
                                        "severity": "CRITICAL",
                                        "description": "Network request to non-whitelisted domain."
                                    })
                                    try:
                                        self.callback(
                                            code="H5",
                                            title=v_info["title"],
                                            severity=v_info["severity"],
                                            description=f"App '{proc_name}' connected to unauthorized domain '{domain_name}'.",
                                            detected_value=formatted_log,
                                            event_key=connection_key
                                        )
                                    except TypeError:
                                        try:
                                            self.callback("H5", formatted_log)
                                        except Exception:
                                            pass
            except Exception:
                pass
            time.sleep(1.5)
