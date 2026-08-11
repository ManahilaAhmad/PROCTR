import sys
import os
import time
import argparse
import atexit
import signal

# Insert Desktop/ folder (parent of python_sensors) so 'from python_sensors.x import y' works
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from python_sensors.controllers.sensorController import SensorController

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
            print("[PROCTR] Requesting Windows Administrator Elevation (UAC Prompt)...")
            import ctypes
            script_path = os.path.abspath(sys.argv[0])
            params = f'"{script_path}" ' + " ".join([f'"{a}"' for a in sys.argv[1:]])
            ret = ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, params, None, 1)
            if ret > 32:
                sys.exit(0)
        except Exception as e:
            print(f"[PROCTR Note] Auto-elevation note: {e}")

if __name__ == "__main__":
    ensure_admin_elevation()

    parser = argparse.ArgumentParser(description="PROCTR Background OS Sensor Engine (MVC Backend)")
    parser.add_argument("--exam_id", type=str, default="1", help="Exam ID")
    parser.add_argument("--student_id", type=str, default="101", help="Student ID")
    parser.add_argument("--whitelist", type=str, default="", help="Comma-separated whitelisted processes")

    args = parser.parse_args()

    custom_whitelist = [p.strip() for p in args.whitelist.split(",") if p.strip()] if args.whitelist else None

    controller = SensorController(
        exam_id=args.exam_id,
        student_id=args.student_id,
        custom_whitelist=custom_whitelist
    )

    def cleanup_on_exit(sig=None, frame=None):
        try:
            controller.stop()
        except Exception:
            pass

    atexit.register(cleanup_on_exit)
    try:
        signal.signal(signal.SIGINT, cleanup_on_exit)
        signal.signal(signal.SIGTERM, cleanup_on_exit)
        if hasattr(signal, "SIGBREAK"):
            signal.signal(signal.SIGBREAK, cleanup_on_exit)
    except Exception:
        pass

    controller.start()

    try:
        while True:
            time.sleep(1.0)
    except (KeyboardInterrupt, SystemExit):
        controller.stop()
