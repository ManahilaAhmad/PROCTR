import os
import sys

# Base exam storage directory on student PC (Option 1: C:\PROCTR_Exams\)
BASE_EXAM_DIR = r"C:\PROCTR_Exams" if sys.platform == "win32" else os.path.expanduser("~/PROCTR_Exams")

# Default permitted development software (Can be expanded dynamically by Teacher config)
DEFAULT_WHITELISTED_PROCESSES = {
    # IDEs & Code Editors
    "code.exe",             # VS Code
    "pycharm64.exe",        # PyCharm
    "devenv.exe",           # Visual Studio
    "codeblocks.exe",       # Code::Blocks
    "devcpp.exe",           # Dev-C++
    "notepad++.exe",        # Notepad++
    "sublime_text.exe",     # Sublime Text
    "eclipse.exe",          # Eclipse
    "idea64.exe",           # IntelliJ IDEA

    # Compilers, Runtimes & Interpreter Shells
    "python.exe",
    "pythonw.exe",
    "gcc.exe",
    "g++.exe",
    "javac.exe",
    "java.exe",
    "node.exe",
    "cmd.exe",
    "powershell.exe",

    # System & PROCTR Processes
    "proctr-desktop.exe",
    "electron.exe",
    "python_sensor.exe",
    "explorer.exe",
    "conhost.exe",
    "svchost.exe",
}

# Default permitted network/DNS web domains
DEFAULT_ALLOWED_DOMAINS = {
    "localhost",
    "127.0.0.1",
    "github.com",
    "raw.githubusercontent.com",
    "stackoverflow.com",
    "university.edu",
    "neon.tech",
    "aws.amazon.com",
    "cloudinary.com"
}

# Hard Violation Codes & Descriptions (H1 - H5)
VIOLATION_CODES = {
    "H1": {
        "code": "H1",
        "title": "USB Hardware Insertion Detected",
        "severity": "CRITICAL",
        "description": "Physical USB storage drive was connected during an active exam session."
    },
    "H2": {
        "code": "H2",
        "title": "Unauthorized Application Execution",
        "severity": "HIGH",
        "description": "Student launched or switched to a non-whitelisted application."
    },
    "H3": {
        "code": "H3",
        "title": "Window Focus Loss / Away Breach",
        "severity": "MEDIUM",
        "description": "Student moved focus away from the exam workspace for an extended duration."
    },
    "H4a": {
        "code": "H4a",
        "title": "Clipboard Buffer Violation",
        "severity": "HIGH",
        "description": "Large text block or code copied from an unapproved external application."
    },
    "H4b": {
        "code": "H4b",
        "title": "Workspace & Document Tampering",
        "severity": "HIGH",
        "description": "Unauthorized file modification or external document access detected outside workspace."
    },
    "H5": {
        "code": "H5",
        "title": "Unauthorized Domain / DNS Access",
        "severity": "CRITICAL",
        "description": "Network request to a non-whitelisted web domain or DNS lookup detected."
    }
}
