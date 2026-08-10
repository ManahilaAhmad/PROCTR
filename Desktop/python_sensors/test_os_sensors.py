import sys
import os
import time
import json
import threading

# Ensure package import resolution
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from python_sensors.config import DEFAULT_WHITELISTED_PROCESSES, DEFAULT_ALLOWED_DOMAINS, VIOLATION_CODES
from python_sensors.sensors.windowSensor import WindowSensor
from python_sensors.sensors.clipboard_monitor import ClipboardMonitor
from python_sensors.sensors.dnsSensor import DNSSensor
from python_sensors.sensors.usb_detector import USBDetector
from python_sensors.sensors.fs_watcher import FileSystemWatcher

def print_banner():
    print("=" * 75)
    print("🛡️  PROCTR — OS SECURITY SENSORS & ENFORCEMENT TEST SUITE")
    print("=" * 75)
    print("Testing Live OS-Level Security & Violation Telemetry:")
    print(" 1. Copy-Paste Telemetry & Forensic File Path Tracking (H4a)")
    print(" 2. Active Window & Process Whitelisting (H2 & H3)")
    print(" 3. Active DNS Domain Whitelisting & Sinkhole Redirect (H5)")
    print(" 4. USB Hardware Insertion & Volume Metadata Detector (H1)")
    print(" 5. Full Multi-Sensor Engine Run (All OS Sensors Active)")
    print("=" * 75)

def sample_violation_callback(code, detected_value="", title="", severity="", description="", *args, **kwargs):
    v_info = VIOLATION_CODES.get(code, {"title": title or "Security Violation", "severity": severity or "HIGH"})
    val = detected_value or description or str(kwargs)
    print(f"\n🚨 [LIVE ALERT DETECTED] Code: {code} | Severity: {v_info['severity']}")
    print(f"   Title: {v_info['title']}")
    print(f"   Telemetry Details: {val}")
    print("   Timestamp:", time.strftime("%Y-%m-%d %H:%M:%S"))
    print("-" * 75)

def test_clipboard_monitor():
    print("\n--- [TEST 1] Forensic Copy-Paste Source & Destination File Path Tracker (H4a) ---")
    print("How this works:")
    print("  1. When you copy text, PROCTR resolves the SOURCE FILE PATH (e.g. D:\\cheat_notes\\cheating.txt)")
    print("  2. When you paste or switch to destination, PROCTR resolves the TARGET FILE PATH (e.g. C:\\Exam\\python.py)")
    print("  3. Logs the exact formatted line:")
    print("     'at time 10:55:27 879 characters were copied from D:\\cheating.txt to C:\\Exam\\python.py'")
    print()
    print("Instructions to Test:")
    print("  1. Open ANY file (e.g., cheating.txt or browser page) and COPY text.")
    print("  2. Open ANY target file (e.g., python.py in VS Code or Notepad) and PASTE text.")
    print("  3. Watch the terminal output and local JSON log file for the exact file path record!")
    print()
    print("🟢 [STATUS] Forensic Copy-Paste Path Engine is NOW ACTIVE.")
    print("👉 Go ahead: Copy text from one file/window, then switch and paste into another file.")
    print("👉 Press ENTER in this window when you are done testing.\n")
    
    cb_sensor = ClipboardMonitor(callback_on_violation=sample_violation_callback, max_paste_chars=300, auto_clear=False)
    cb_sensor.start()
    
    try:
        input("Press ENTER to stop clipboard monitoring...\n")
    except (KeyboardInterrupt, EOFError):
        pass
        
    cb_sensor.stop()
    print("✅ Clipboard Monitor Test Stopped.\n")

def test_active_window_whitelist():
    print("\n--- [TEST 2] Active Window Focus & Process Whitelist Tracker (H2 & H3) ---")
    print("Whitelisted Processes:", list(DEFAULT_WHITELISTED_PROCESSES)[:8], "... (and system tools)")
    print("Instructions: Switch foreground focus to an unauthorized app (e.g. Chrome, Discord, Notepad, Edge).")
    print("Press ENTER to stop active window monitoring...\n")

    win_sensor = WindowSensor(violation_callback=sample_violation_callback, away_threshold_sec=10)
    win_sensor.start()

    try:
        input("Press ENTER to stop window monitoring...\n")
    except (KeyboardInterrupt, EOFError):
        pass

    win_sensor.stop()
    print("\n✅ Active Window Whitelist Test Finished.\n")

def is_admin():
    """Checks if current process has Windows Administrator privileges."""
    try:
        import ctypes
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except Exception:
        return False

def ensure_admin_elevation():
    """Prompts Windows UAC to automatically re-launch script as Administrator if needed."""
    if sys.platform == "win32" and not is_admin():
        try:
            print("\n🔒 [PROCTR] Requesting Windows Administrator Elevation (UAC Prompt)...")
            import ctypes
            script_path = os.path.abspath(sys.argv[0])
            params = f'"{script_path}"'
            ret = ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, params, None, 1)
            if ret > 32:
                print("✅ Elevated process launched. Closing non-admin window...")
                sys.exit(0)
        except Exception as e:
            print(f"⚠️ Elevation prompt failed: {e}")

def test_dns_domain_whitelist():
    print("\n--- [TEST 3] Strict DNS Domain Allowlist Sensor & Sinkhole (H5) ---")
    print("Policy: DEFAULT DENY (Strict Whitelist)")
    print("  -> EVERYTHING is BLOCKED by default (ChatGPT, Claude, Gemini, YouTube, Discord, Reddit, etc.)")
    print("  -> ONLY explicitly whitelisted domains (e.g. instagram.com, university.edu) are ALLOWED!\n")

    if not is_admin():
        ensure_admin_elevation()

    dns_sensor = DNSSensor(
        violation_callback=sample_violation_callback,
        custom_domains={"instagram.com", "university.edu", "neon.tech"},
        active_blocking=True
    )

    test_domains = [
        "instagram.com",
        "university.edu",
        "chatgpt.com",
        "claude.ai",
        "gemini.google.com",
        "youtube.com",
        "discord.com",
        "reddit.com"
    ]

    print("1. Domain Allowlist Validation Table:")
    print("Explicitly Whitelisted Domains:", list(dns_sensor.allowed_domains))
    print("-" * 65)

    for dom in test_domains:
        is_safe = dns_sensor.validate_domain(dom)
        status = "✅ ALLOWED (Whitelisted)" if is_safe else "❌ BLOCKED (Default Deny H5 Violation)"
        print(f"  Domain: {dom:<25} -> {status}")

    print("-" * 65)
    print("\n2. Starting live connection monitoring & DNS sinkhole...")
    print("👉 Open chatgpt.com, claude.ai, or youtube.com in browser -> BLOCKED & LOGGED!")
    print("👉 Open instagram.com in browser -> ALLOWED!")
    print("👉 Press ENTER in this window when done testing.\n")

    dns_sensor.start()
    try:
        input("Press ENTER to stop DNS monitoring...\n")
    except (KeyboardInterrupt, EOFError):
        pass
    dns_sensor.stop()
    print("\n✅ DNS Domain Allowlist Test Finished.\n")

def test_usb_detector():
    print("\n--- [TEST 4] USB Hardware Insertion, Lockout & Metadata Detector (H1) ---")
    print("Features:")
    print("  1. Active USB Volume Lockout: Locks and unmounts inserted USB drives (FSCTL_LOCK_VOLUME).")
    print("  2. Access Denial: Student cannot open drive in File Explorer ('Access is denied').")
    print("  3. Mobile Cable Detection: Catches Mobile Phones (MTP) connected via USB cable.")
    print("  4. Forensic Telemetry: Drive Letter, Volume Label, Serial Number, Timestamp.\n")

    if not is_admin():
        ensure_admin_elevation()

    print("Instructions to Test:")
    print("  👉 Plug in any USB flash drive or Mobile Phone USB charging cable now.")
    print("  👉 Try opening the USB drive in File Explorer -> ACCESS DENIED!")
    print("  👉 Press ENTER in this window when done testing.\n")
    
    usb_sensor = USBDetector(callback_on_violation=sample_violation_callback, active_locking=True)
    usb_sensor.start()
    
    try:
        input("Press ENTER to stop USB monitoring...\n")
    except (KeyboardInterrupt, EOFError):
        pass

    usb_sensor.stop()
    print("\n✅ USB Hardware Detector & Lockout Test Finished.\n")

def test_full_orchestrator():
    print("\n--- [TEST 5] Full Multi-Sensor Suite (All OS Sensors Active) ---")
    print("Starting USB, Clipboard, Active Window & DNS Sensors...")
    print("Press ENTER in this window to stop all sensors.\n")
    
    cb_sensor = ClipboardMonitor(callback_on_violation=sample_violation_callback, max_paste_chars=300, auto_clear=False)
    win_sensor = WindowSensor(violation_callback=sample_violation_callback, away_threshold_sec=10)
    dns_sensor = DNSSensor(violation_callback=sample_violation_callback, active_blocking=True)
    usb_sensor = USBDetector(callback_on_violation=sample_violation_callback)
    
    cb_sensor.start()
    win_sensor.start()
    dns_sensor.start()
    usb_sensor.start()
    
    try:
        input("Press ENTER to stop all sensors...\n")
    except (KeyboardInterrupt, EOFError):
        pass

    cb_sensor.stop()
    win_sensor.stop()
    dns_sensor.stop()
    usb_sensor.stop()
    print("\n✅ Full Multi-Sensor Suite Test Finished.\n")

import zipfile

def create_valid_docx(file_path):
    """Creates a 100% valid Microsoft Word .docx file so Word opens it with 0 errors."""
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        '</Types>'
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        '</Relationships>'
    )
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:body>'
        '<w:p><w:r><w:t>PROCTR Lab Exam Submission Document — Official Answer Sheet</w:t></w:r></w:p>'
        '</w:body>'
        '</w:document>'
    )
    try:
        with zipfile.ZipFile(file_path, 'w', zipfile.ZIP_DEFLATED) as z:
            z.writestr('[Content_Types].xml', content_types)
            z.writestr('_rels/.rels', rels)
            z.writestr('word/document.xml', document_xml)
    except Exception as e:
        print(f"⚠️ Could not create docx: {e}")

def test_workspace_file_protection():
    print("\n--- [TEST 6] Workspace Submission File Protection & Auto-Deletion (H4b) ---")
    test_dir = r"C:\PROCTR_Exams\Test_Submission"
    os.makedirs(test_dir, exist_ok=True)
    
    # Create valid pre-uploaded submission document if not exists
    sample_doc = os.path.join(test_dir, "Submission_Document.docx")
    if not os.path.exists(sample_doc) or os.path.getsize(sample_doc) < 100:
        create_valid_docx(sample_doc)

    print(f"Test Workspace Directory: {test_dir}")
    print(f"Pre-approved Submission File: Submission_Document.docx")
    print("-" * 75)
    print("How to Test Real-Time File Rules:")
    print("  1. RENAME TEST: Open File Explorer -> Rename 'Submission_Document.docx' to 'Ali_Submission.docx'")
    print("     👉 Output: ✏️ [FILE RENAME APPROVED] (Allowed & Manifest Updated)")
    print()
    print("  2. FILE CREATION / PASTE TEST: Create 'cheat.txt' or paste any file inside 'Test_Submission'")
    print("     👉 Output: 🚨 [UNAUTHORIZED FILE CREATION — H4b] -> AUTO-DELETED BY PROCTR!")
    print()
    print("  3. DELETION TEST: Try deleting 'Ali_Submission.docx'")
    print("     👉 Output: 🚨 [UNAUTHORIZED SUBMISSION FILE DELETION — H4b] -> FLAGGED!")
    print("-" * 75)
    print("\nStarting File System Watcher...\n")

    fs_watcher = FileSystemWatcher(workspace_path=test_dir, callback_on_violation=sample_violation_callback)
    fs_watcher.start()

    try:
        input("Press ENTER in this window when done testing...\n")
    except (KeyboardInterrupt, EOFError):
        pass

    fs_watcher.stop()
    print("\n✅ Workspace File Protection Test Finished.\n")

def main():
    while True:
        print_banner()
        print("Select Test Option:")
        print(" [1] Test Copy-Paste Telemetry & Forensic File Path Tracker (H4a)")
        print(" [2] Test Active Window & Process Whitelisting (H2 & H3)")
        print(" [3] Test Active DNS / Domain Whitelisting & Sinkhole (H5)")
        print(" [4] Test USB Hardware Insertion & Volume Metadata Detector (H1)")
        print(" [5] Test Full Multi-Sensor Engine (All Sensors)")
        print(" [6] Test Workspace Submission File Protection & Auto-Deletion (H4b)")
        print(" [0] Exit Test Runner\n")
        
        try:
            choice = input("Enter choice (0-6): ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nExiting.")
            break
            
        if choice == "1":
            test_clipboard_monitor()
        elif choice == "2":
            test_active_window_whitelist()
        elif choice == "3":
            test_dns_domain_whitelist()
        elif choice == "4":
            test_usb_detector()
        elif choice == "5":
            test_full_orchestrator()
        elif choice == "6":
            test_workspace_file_protection()
        elif choice == "0":
            print("\nExiting Test Suite. Goodbye!")
            break
        else:
            print("\nInvalid choice. Try again.\n")

if __name__ == "__main__":
    main()
