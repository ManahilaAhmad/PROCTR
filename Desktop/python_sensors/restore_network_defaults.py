import sys
import os

def is_admin():
    try:
        import ctypes
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except Exception:
        return False

def ensure_admin():
    if sys.platform == "win32" and not is_admin():
        try:
            import ctypes
            script_path = os.path.abspath(sys.argv[0])
            params = f'"{script_path}"'
            ret = ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, params, None, 1)
            if ret > 32:
                sys.exit(0)
        except Exception as e:
            print(f"UAC Note: {e}")

def restore_all():
    ensure_admin()

    print("=" * 65)
    print("🔓 PROCTR — NETWORK & SYSTEM DEFAULTS RESTORATION TOOL")
    print("=" * 65)

    # 1. Restore OS Hosts File
    hosts_path = r"C:\Windows\System32\drivers\etc\hosts" if sys.platform == "win32" else "/etc/hosts"
    if os.path.exists(hosts_path):
        try:
            with open(hosts_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

            if "# PROCTR_DNS_SINKHOLE_START" in content:
                parts = content.split("# PROCTR_DNS_SINKHOLE_START")
                header = parts[0]
                footer = parts[1].split("# PROCTR_DNS_SINKHOLE_END")[-1] if "# PROCTR_DNS_SINKHOLE_END" in parts[1] else ""
                restored = (header + footer).strip() + "\n"
                with open(hosts_path, "w", encoding="utf-8") as f:
                    f.write(restored)
                print("✅ OS Hosts File restored to normal (PROCTR Sinkhole Rules Removed).")
            else:
                print("ℹ️ OS Hosts File is already clean.")
        except Exception as e:
            print(f"⚠️ Could not write to hosts file: {e}")

    # 2. Flush DNS Cache
    if sys.platform == "win32":
        os.system("ipconfig /flushdns >NUL 2>&1")
        print("✅ Windows DNS Cache flushed.")

    # 3. Restore USBSTOR Registry Key
    if sys.platform == "win32":
        try:
            import winreg
            key_path = r"SYSTEM\CurrentControlSet\Services\USBSTOR"
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, key_path, 0, winreg.KEY_SET_VALUE) as key:
                winreg.SetValueEx(key, "Start", 0, winreg.REG_DWORD, 3)  # 3 = Enabled
            print("✅ USB Storage Driver restored in Windows Registry.")
        except Exception as e:
            print(f"⚠️ USBSTOR Registry note: {e}")

    print("=" * 65)
    print("🎉 ALL LAPTOP NETWORK & SYSTEM SETTINGS RESTORED TO NORMAL!")
    print("=" * 65)

if __name__ == "__main__":
    restore_all()
