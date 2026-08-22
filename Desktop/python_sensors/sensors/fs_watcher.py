import sys
import os
import json
import time
import shutil
import threading
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from python_sensors.config import VIOLATION_CODES

LOG_DIR = r"C:\PROCTR_Exams\offline_logs" if sys.platform == "win32" else os.path.expanduser("~/PROCTR_Exams/offline_logs")
BACKUP_DIR = r"C:\PROCTR_Exams\backups" if sys.platform == "win32" else os.path.expanduser("~/PROCTR_Exams/backups")

def _write_fs_log_file(record: dict):
    """Appends a file system violation record to daily log file."""
    try:
        os.makedirs(LOG_DIR, exist_ok=True)
        date_str = time.strftime("%Y-%m-%d")
        log_path = os.path.join(LOG_DIR, f"fs_log_{date_str}.json")
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
        print(f"[FSWatcher] Could not write log file: {e}")
        return None


def _backup_file(file_path):
    """Creates a shadow copy of approved submission/starter file in BACKUP_DIR."""
    try:
        os.makedirs(BACKUP_DIR, exist_ok=True)
        filename = os.path.basename(file_path)
        # Skip temporary Office files
        if filename.startswith("~$") or filename.startswith("~WRL") or filename.endswith(".tmp"):
            return None
        dest_backup = os.path.join(BACKUP_DIR, filename)
        if os.path.exists(file_path):
            time.sleep(0.02)
            shutil.copy2(file_path, dest_backup)
            return dest_backup
    except Exception as e:
        pass
    return None


def _restore_file_from_backup(file_path):
    """Restores deleted approved file back to workspace from shadow backup."""
    try:
        filename = os.path.basename(file_path)
        src_backup = os.path.join(BACKUP_DIR, filename)
        if os.path.exists(src_backup):
            time.sleep(0.05)
            shutil.copy2(src_backup, file_path)
            return True
    except Exception as e:
        print(f"[FSWatcher] File restoration failed for {file_path}: {e}")
    return False


def is_office_temp_file(filename):
    """Returns True if filename is an internal temporary Office swap file (~$doc.docx, ~WRL0001.tmp) or SQLite system file."""
    fn = filename.lower()
    if fn.startswith("~$") or fn.startswith("~wrl") or fn.startswith("~wrf") or fn.startswith("~wrd") or fn.endswith(".tmp"):
        return True
    if fn.endswith("-journal") or fn.endswith("-wal") or fn.endswith("-shm") or fn.endswith(".db"):
        return True
    return False


class ExamFileEventHandler(FileSystemEventHandler):
    """
    Event handler for watchdog file system events.
    Rules:
    1. Editing and Saving Microsoft Word submission files is 100% PERMITTED (Office temp swap files handled seamlessly).
    2. Renaming pre-uploaded Submission File is PERMITTED (updates manifest dynamically & updates shadow backup).
    3. Deleting pre-uploaded Submission File or Starter Code is FORBIDDEN (AUTO-RESTORES file from backup & flags H4b).
    4. Creating or pasting NEW unauthorized files is FORBIDDEN (AUTO-DELETES file from disk & flags H4b).
    """

    def __init__(self, callback_on_violation, initial_manifest=None):
        super().__init__()
        self.callback = callback_on_violation
        self.initial_manifest = set(os.path.abspath(f).lower() for f in (initial_manifest or []))
        self.last_event_time = 0

    def on_created(self, event):
        if event.is_directory:
            return
        self._evaluate_file_event(event.src_path, "CREATED")

    def on_modified(self, event):
        if event.is_directory:
            return
        abs_p = os.path.abspath(event.src_path).lower()
        if abs_p in self.initial_manifest:
            # Re-backup updated submission content when student saves
            _backup_file(event.src_path)

    def on_deleted(self, event):
        if event.is_directory:
            return
        self._evaluate_file_event(event.src_path, "DELETED")

    def on_moved(self, event):
        if event.is_directory:
            return
        
        new_filename = os.path.basename(event.dest_path)
        if is_office_temp_file(new_filename) or is_office_temp_file(os.path.basename(event.src_path)):
            # Ignore Microsoft Word internal swap file renames (~WRL0001.tmp)
            return

        old_path = os.path.abspath(event.src_path).lower()
        new_path = os.path.abspath(event.dest_path).lower()
        
        # If student renames pre-uploaded submission file (e.g. Submission.docx -> Ali_2021-CS-105.docx)
        if old_path in self.initial_manifest:
            self.initial_manifest.remove(old_path)
            self.initial_manifest.add(new_path)
            
            # Create new shadow backup for renamed file
            _backup_file(event.dest_path)
            
            now_time = time.strftime("%H:%M:%S")
            old_name = os.path.basename(event.src_path)
            new_name = os.path.basename(event.dest_path)
            print(f"✏️ [FILE RENAME APPROVED] at time {now_time} Student renamed submission file '{old_name}' to '{new_name}'")
            return

        self._evaluate_file_event(event.dest_path, "MOVED")

    def _evaluate_file_event(self, file_path, action):
        filename = os.path.basename(file_path)
        
        # Ignore internal system & temporary Office swap files (~$doc.docx, ~WRL0001.tmp)
        if filename in ["proctr_local_events.db", "violations_backup.jsonl"] or filename.startswith("."):
            return
        if is_office_temp_file(filename):
            return

        # Throttle rapid duplicate events
        now = time.time()
        if now - self.last_event_time < 0.6:
            return
        self.last_event_time = now

        now_time = time.strftime("%H:%M:%S")
        full_date = time.strftime("%Y-%m-%d %H:%M:%S")
        abs_path = os.path.abspath(file_path).lower()

        # Check if file is in pre-uploaded safe manifest
        is_preapproved = abs_path in self.initial_manifest
        is_unauthorized_new_file = (action in ("CREATED", "MOVED") and not is_preapproved)
        is_unauthorized_deletion = (action == "DELETED" and is_preapproved)

        file_deleted_by_proctr = False
        file_restored_by_proctr = False

        if is_unauthorized_new_file:
            # Auto-delete unauthorized file created/pasted by student
            try:
                if os.path.exists(file_path):
                    time.sleep(0.05)
                    os.remove(file_path)
                    file_deleted_by_proctr = True
            except Exception as e:
                print(f"⚠️ Could not auto-delete unauthorized file {filename}: {e}")

            formatted_log = (
                f"at time {now_time} Unauthorized file '{filename}' was created/pasted "
                f"in workspace. Action Taken: {'AUTO-DELETED BY PROCTR & FLAGGED' if file_deleted_by_proctr else 'FLAGGED'}"
            )
            code = "H4b"
            title = "Unauthorized File Creation / Import"
            severity = "CRITICAL"

        elif is_unauthorized_deletion:
            # Auto-restore deleted approved submission file from shadow backup
            file_restored_by_proctr = _restore_file_from_backup(file_path)

            formatted_log = (
                f"at time {now_time} Student attempted unauthorized DELETION of approved "
                f"submission file '{filename}'. Action Taken: "
                f"{'AUTO-RESTORED FROM BACKUP BY PROCTR & FLAGGED' if file_restored_by_proctr else 'FLAGGED'}"
            )
            code = "H4b"
            title = "Unauthorized Submission File Deletion"
            severity = "CRITICAL"

        else:
            formatted_log = f"at time {now_time} Workspace File Event [{action}]: {filename}"
            code = "H4b"
            title = "Workspace File Activity"
            severity = "LOW" if is_preapproved else "MEDIUM"

        print(f"\n{'='*75}")
        print(f"🚨 [{title.upper()} — {code}]")
        print(f"   {formatted_log}")
        print(f"   File Path : {file_path}")
        print(f"   Approved  : {'YES (Pre-uploaded Submission/Starter File)' if is_preapproved else 'NO (Unauthorized File)'}")
        if file_restored_by_proctr:
            print(f"   ♻️ [PROCTR RESTORE] Approved submission file '{filename}' was automatically restored to workspace!")
        print(f"{'='*75}\n")

        json_record = {
            "timestamp": full_date,
            "time_str": now_time,
            "violation_code": code,
            "severity": severity,
            "filename": filename,
            "file_path": file_path,
            "is_preapproved": is_preapproved,
            "auto_deleted": file_deleted_by_proctr,
            "auto_restored": file_restored_by_proctr,
            "action": action,
            "formatted_log": formatted_log
        }
        log_path = _write_fs_log_file(json_record)
        if log_path:
            print(f"📁 Forensic Log Saved → {log_path}\n")

        if self.callback and (is_unauthorized_new_file or is_unauthorized_deletion):
            try:
                self.callback(
                    code=code,
                    title=title,
                    severity=severity,
                    description=formatted_log,
                    detected_value=formatted_log
                )
            except TypeError:
                try:
                    self.callback(code, formatted_log)
                except Exception:
                    pass


class FileSystemWatcher:
    """
    Sensor 4: Workspace Safe-Zone & File System Integrity Watcher (H4b Violation)
    
    Rules:
    - Pre-uploaded Word submission files & Teacher Starter Code are SAFE & SHADOW BACKED UP.
    - Editing and Saving Word submission files is PERMITTED & auto-backed up on save.
    - Renaming Submission file (e.g. Submission.docx -> Ali_2021-CS-105.docx) is PERMITTED.
    - Deleting Submission file or Starter Code is FORBIDDEN -> AUTO-RESTORES file from shadow backup & flags H4b!
    - Strict Zero-New-File Policy: Auto-deletes any unauthorized new file created or pasted in workspace.
    """

    def __init__(self, workspace_path, callback_on_violation=None):
        self.workspace_path = workspace_path
        self.callback = callback_on_violation
        self.observer = None
        self.running = False
        self.initial_manifest = set()

    def scan_initial_manifest(self):
        """Builds fingerprint & shadow backups of initial starter code and pre-uploaded Word submission files."""
        self.initial_manifest.clear()
        if os.path.exists(self.workspace_path):
            for root, _, files in os.walk(self.workspace_path):
                for f in files:
                    if not is_office_temp_file(f):
                        full_p = os.path.abspath(os.path.join(root, f))
                        self.initial_manifest.add(full_p)
                        # Create shadow backup of approved file
                        _backup_file(full_p)
        print(f"[FS Sensor] Pre-exam manifest scanned: {len(self.initial_manifest)} approved files recorded & backed up.")

    def start(self):
        """Starts watchdog observer on exam workspace directory."""
        if not os.path.exists(self.workspace_path):
            os.makedirs(self.workspace_path, exist_ok=True)

        self.scan_initial_manifest()

        event_handler = ExamFileEventHandler(self.callback, self.initial_manifest)
        self.observer = Observer()
        self.observer.schedule(event_handler, path=self.workspace_path, recursive=True)
        self.observer.start()
        self.running = True
        print(f"[FS Sensor] Monitoring workspace path: {self.workspace_path}")

    def stop(self):
        if self.observer and self.running:
            self.observer.stop()
            self.observer.join()
            self.running = False
