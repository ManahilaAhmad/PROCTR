import os
import shutil
from python_sensors.config import BASE_EXAM_DIR

class WorkspaceController:
    """
    Controller handling Exam Workspace directory creation & starter files.
    """

    def __init__(self, exam_id, student_id):
        self.exam_id = str(exam_id)
        self.student_id = str(student_id)
        self.folder_name = f"Exam_{self.exam_id}_{self.student_id}"
        self.workspace_dir = os.path.join(BASE_EXAM_DIR, self.folder_name)
        self.submissions_dir = os.path.join(self.workspace_dir, "submissions")
        self.starter_dir = os.path.join(self.workspace_dir, "starter_code")

    def setup_workspace(self, starter_files=None):
        os.makedirs(self.workspace_dir, exist_ok=True)
        os.makedirs(self.submissions_dir, exist_ok=True)
        os.makedirs(self.starter_dir, exist_ok=True)

        copied = 0
        if starter_files and isinstance(starter_files, list):
            for file_path in starter_files:
                if os.path.exists(file_path):
                    filename = os.path.basename(file_path)
                    target = os.path.join(self.starter_dir, filename)
                    shutil.copy2(file_path, target)
                    sub_target = os.path.join(self.submissions_dir, filename)
                    if not os.path.exists(sub_target):
                        shutil.copy2(file_path, sub_target)
                    copied += 1

        return {
            "status": "success",
            "workspace_dir": self.workspace_dir,
            "submissions_dir": self.submissions_dir,
            "copied": copied
        }

    def get_workspace_path(self):
        return self.workspace_dir
