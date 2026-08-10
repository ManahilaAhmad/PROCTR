import sys
import os
import json
import time
import threading
from python_sensors.config import VIOLATION_CODES

LOG_DIR = r"C:\PROCTR_Exams\offline_logs" if sys.platform == "win32" else os.path.expanduser("~/PROCTR_Exams/offline_logs")

def _write_usb_log_file(record: dict):
    """Appends a USB hardware violation record to the daily log file."""
    try:
        os.makedirs(LOG_DIR, exist_ok=True)
        date_str = time.strftime("%Y-%m-%d")
        log_path = os.path.join(LOG_DIR, f"usb_log_{date_str}.json")
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
        print(f"[USBDetector] Could not write log file: {e}")
        return None


def set_usbstor_policy(disable=True):
    """Disables Windows USB Mass Storage driver in Registry (Requires Admin)."""
    if sys.platform != "win32":
        return
    try:
        import winreg
        key_path = r"SYSTEM\CurrentControlSet\Services\USBSTOR"
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, key_path, 0, winreg.KEY_SET_VALUE) as key:
            # 4 = Disabled, 3 = Enabled
            winreg.SetValueEx(key, "Start", 0, winreg.REG_DWORD, 4 if disable else 3)
        print(f"🔒 [USB REGISTRY POLICY] USB Storage Driver {'DISABLED' if disable else 'RESTORED'}.")
    except Exception as e:
        pass


def block_and_lock_usb_drive(drive_letter):
    r"""
    Actively locks and unmounts removable USB volume so Windows File Explorer displays:
    'E:\ is not accessible. Access is denied.'
    """
    if sys.platform != "win32":
        return False

    try:
        import win32file
        import win32con
        import winioctlcon

        drive_clean = drive_letter.rstrip('\\').rstrip(':')
        volume_path = f"\\\\.\\{drive_clean}:"

        h_volume = win32file.CreateFile(
            volume_path,
            win32con.GENERIC_READ | win32con.GENERIC_WRITE,
            win32con.FILE_SHARE_READ | win32con.FILE_SHARE_WRITE,
            None,
            win32con.OPEN_EXISTING,
            0,
            None
        )

        if h_volume != win32file.INVALID_HANDLE_VALUE:
            win32file.DeviceIoControl(h_volume, winioctlcon.FSCTL_LOCK_VOLUME, None, None)
            win32file.DeviceIoControl(h_volume, winioctlcon.FSCTL_DISMOUNT_VOLUME, None, None)
            print(f"🔒 [USB LOCK ENFORCEMENT] Drive {drive_letter} locked & unmounted. Access denied to student!")
            return True
    except Exception as e:
        print(f"⚠️ Could not lock USB volume {drive_letter}: {e}")
    return False


def get_drive_details(drive_letter):
    """Extracts volume label and serial number for USB drive letters."""
    if sys.platform != "win32":
        return {"drive": drive_letter, "label": "USB Drive", "serial": "N/A", "filesystem": "N/A"}

    try:
        import win32api
        vol_name, vol_serial, max_comp, flags, fs_name = win32api.GetVolumeInformation(drive_letter)
        serial_hex = hex(vol_serial & 0xFFFFFFFF)[2:].upper()
        return {
            "drive": drive_letter,
            "label": vol_name or "Removable USB Disk",
            "serial": serial_hex,
            "filesystem": fs_name or "FAT32/NTFS"
        }
    except Exception:
        return {
            "drive": drive_letter,
            "label": "Removable USB Disk",
            "serial": "N/A",
            "filesystem": "N/A"
        }


def get_connected_usb_pnp_devices():
    """
    Scans Windows PnP hardware tree for USB devices and Mobile Phones (MTP / WPD).
    Catches Mobile Phones connected via USB charging/data cables even without drive letters.
    """
    devices = {}
    if sys.platform != "win32":
        return devices

    try:
        import win32com.client
        wmi = win32com.client.GetObject("winmgmts:")
        
        query = "SELECT Name, DeviceID, PNPClass FROM Win32_PnPEntity WHERE DeviceID LIKE 'USB%' OR PNPClass = 'WPD' OR PNPClass = 'DiskDrive'"
        results = wmi.ExecQuery(query)

        IGNORE_KEYWORDS = [
            "root", "hub", "host controller", "composite device",
            "mouse", "keyboard", "bluetooth", "webcam", "camera", "realtek"
        ]

        for dev in results:
            name = dev.Name or ""
            dev_id = dev.DeviceID or ""
            pnp_class = dev.PNPClass or ""
            name_lower = name.lower()

            if not name or any(ign in name_lower for ign in IGNORE_KEYWORDS):
                continue

            is_mobile = pnp_class == "WPD" or "mtp" in name_lower or "phone" in name_lower or "android" in name_lower or "apple" in name_lower or "iphone" in name_lower
            dev_type = "📱 Mobile Phone / MTP Device" if is_mobile else "💾 USB Mass Storage"

            key = dev_id
            devices[key] = {
                "name": name,
                "device_id": dev_id,
                "class": pnp_class,
                "type": dev_type
            }

    except Exception:
        pass

    return devices


class USBDetector:
    """
    Sensor 1: Universal USB Hardware & Mobile Phone Connection Sensor & Lockout (H1 Violation)

    Features:
    - Active Storage Lockout: Locks and unmounts removable USB volumes so Windows File Explorer denies access.
    - Registry Policy: Option to disable USBSTOR drivers.
    - Mass Storage Detection: Removable USB Flash Drives & External HDDs.
    - Mobile Phone Cable Detection: Catches Mobile Phones connected via USB cable.
    """

    def __init__(self, callback_on_violation=None, active_locking=True):
        self.callback = callback_on_violation
        self.active_locking = active_locking
        self.running = False
        self.thread = None

    def start(self):
        """Starts USB hardware monitoring thread & applies lockout policies."""
        self.running = True
        if self.active_locking:
            set_usbstor_policy(disable=True)

        self.thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.thread.start()
        print("[USBDetector] Universal USB Storage & Mobile Cable Sensor + Lockout active.")

    def stop(self):
        self.running = False
        if self.active_locking:
            set_usbstor_policy(disable=False)

    def _monitor_loop(self):
        """Monitors USB drive arrival + USB Mobile Cable arrival."""
        known_drives = self._get_removable_drives()
        known_pnp = get_connected_usb_pnp_devices()

        while self.running:
            try:
                # ── 1. USB DRIVE LETTER CHECK ────────────────────────────────
                current_drives = self._get_removable_drives()
                new_drives = current_drives - known_drives
                removed_drives = known_drives - current_drives

                if new_drives:
                    for drive in new_drives:
                        details = get_drive_details(drive)
                        now_time = time.strftime("%H:%M:%S")
                        full_date = time.strftime("%Y-%m-%d %H:%M:%S")

                        # Actively lock & unmount drive volume so access is denied in Explorer
                        if self.active_locking:
                            block_and_lock_usb_drive(drive)

                        formatted_log = (
                            f"at time {now_time} USB Storage Device '{details['label']} ({drive})' "
                            f"[Serial: {details['serial']}] was inserted and BLOCKED"
                        )

                        self._report_violation(
                            dev_name=f"{details['label']} ({drive})",
                            dev_type="💾 USB Mass Storage Drive (BLOCKED)",
                            formatted_log=formatted_log,
                            full_date=full_date,
                            now_time=now_time
                        )

                    known_drives = current_drives

                elif removed_drives:
                    for drive in removed_drives:
                        print(f"ℹ️  [USB Event] Drive {drive} disconnected at time {time.strftime('%H:%M:%S')}.")
                    known_drives = current_drives

                # ── 2. MOBILE PHONE / MTP USB CABLE CHECK ────────────────────
                current_pnp = get_connected_usb_pnp_devices()
                new_pnp_keys = set(current_pnp.keys()) - set(known_pnp.keys())
                removed_pnp_keys = set(known_pnp.keys()) - set(current_pnp.keys())

                if new_pnp_keys:
                    for key in new_pnp_keys:
                        dev = current_pnp[key]
                        now_time = time.strftime("%H:%M:%S")
                        full_date = time.strftime("%Y-%m-%d %H:%M:%S")

                        formatted_log = (
                            f"at time {now_time} Hardware Device '{dev['name']}' "
                            f"({dev['type']}) was connected via USB cable"
                        )

                        self._report_violation(
                            dev_name=dev['name'],
                            dev_type=dev['type'],
                            formatted_log=formatted_log,
                            full_date=full_date,
                            now_time=now_time
                        )

                    known_pnp = current_pnp

                elif removed_pnp_keys:
                    for key in removed_pnp_keys:
                        dev_name = known_pnp[key]['name'] if key in known_pnp else "USB Device"
                        print(f"ℹ️  [USB Event] Mobile/USB Device '{dev_name}' disconnected at time {time.strftime('%H:%M:%S')}.")
                    known_pnp = current_pnp

            except Exception:
                pass

            time.sleep(1.5)

    def _report_violation(self, dev_name, dev_type, formatted_log, full_date, now_time):
        """Prints terminal logs, writes JSON log, and triggers violation callback."""
        print(f"\n{'='*75}")
        print(f"🚨 [USB / HARDWARE DEVICE INSERTION — H1]")
        print(f"   {formatted_log}")
        print(f"   Device Name : {dev_name}")
        print(f"   Device Type : {dev_type}")
        print(f"   Action Taken: BLOCKED & ACCESS DENIED")
        print(f"{'='*75}\n")

        json_record = {
            "timestamp": full_date,
            "time_str": now_time,
            "violation_code": "H1",
            "severity": "CRITICAL",
            "device_name": dev_name,
            "device_type": dev_type,
            "formatted_log": formatted_log
        }
        log_path = _write_usb_log_file(json_record)
        if log_path:
            print(f"📁 Forensic Log Saved → {log_path}\n")

        if self.callback:
            v_info = VIOLATION_CODES.get("H1", {
                "title": "USB Hardware Insertion Detected",
                "severity": "CRITICAL",
                "description": "Physical USB hardware connected."
            })
            try:
                self.callback(
                    code="H1",
                    title=v_info["title"],
                    severity=v_info["severity"],
                    description=f"USB device connected & blocked: {dev_name}",
                    detected_value=formatted_log
                )
            except TypeError:
                try:
                    self.callback("H1", formatted_log)
                except Exception:
                    pass

    def _get_removable_drives(self):
        """Returns set of current removable drive letters (e.g. {'E:', 'F:'})."""
        drives = set()
        if sys.platform != "win32":
            return drives

        try:
            import win32file
            drive_strings = win32file.GetLogicalDriveStrings()
            raw_drives = [d.rstrip('\\') for d in drive_strings.split('\0') if d]

            for drv in raw_drives:
                try:
                    # win32file.DRIVE_REMOVABLE = 2
                    if win32file.GetDriveType(drv + '\\') == win32file.DRIVE_REMOVABLE:
                        drives.add(drv)
                except Exception:
                    pass
        except Exception:
            pass

        return drives
