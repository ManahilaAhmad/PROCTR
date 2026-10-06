import os
import shutil
from python_sensors.config import BASE_EXAM_DIR

class WorkspaceManager:
    """
    Handles student exam workspace initialization on local PC:
    - Creates C:\\PROCTR_Exams\\Exam_<ExamID>_<StudentID>\\
    - Copies in starter code, templates, and question materials
    - Initializes clean submission folders
    """

    def __init__(self, exam_id, student_id):
        self.exam_id = str(exam_id)
        self.student_id = str(student_id)
        self.folder_name = f"Exam_{self.exam_id}_{self.student_id}"
        self.workspace_dir = os.path.join(BASE_EXAM_DIR, self.folder_name)
        
        self.submissions_dir = os.path.join(self.workspace_dir, "submissions")
        self.starter_dir = os.path.join(self.workspace_dir, "starter_code")
        self.logs_dir = os.path.join(self.workspace_dir, "logs")

    def initialize_workspace(self, starter_files=None):
        """Creates the directory tree and copies starter files."""
        os.makedirs(self.workspace_dir, exist_ok=True)
        os.makedirs(self.submissions_dir, exist_ok=True)
        os.makedirs(self.starter_dir, exist_ok=True)
        os.makedirs(self.logs_dir, exist_ok=True)

        copied_count = 0
        if starter_files and isinstance(starter_files, list):
            for file_path in starter_files:
                if os.path.exists(file_path):
                    filename = os.path.basename(file_path)
                    target_path = os.path.join(self.starter_dir, filename)
                    shutil.copy2(file_path, target_path)
                    
                    # Also put a copy in submissions directory for student to start editing
                    sub_target = os.path.join(self.submissions_dir, filename)
                    if not os.path.exists(sub_target):
                        shutil.copy2(file_path, sub_target)
                        
                    copied_count += 1

        return {
            "status": "success",
            "workspace_dir": self.workspace_dir,
            "submissions_dir": self.submissions_dir,
            "starter_dir": self.starter_dir,
            "copied_starter_files": copied_count
        }

    def get_workspace_path(self):
        return self.workspace_dir

    def get_submissions_path(self):
        return self.submissions_dir
