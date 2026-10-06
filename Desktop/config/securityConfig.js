module.exports = {
  DEFAULT_WHITELISTED_PROCESSES: [
    "code.exe",
    "pycharm64.exe",
    "devenv.exe",
    "codeblocks.exe",
    "devcpp.exe",
    "notepad++.exe",
    "sublime_text.exe",
    "eclipse.exe",
    "idea64.exe",
    "python.exe",
    "pythonw.exe",
    "gcc.exe",
    "g++.exe",
    "javac.exe",
    "java.exe",
    "node.exe",
    "cmd.exe",
    "powershell.exe",
    "proctr-desktop.exe",
    "electron.exe",
    "explorer.exe"
  ],
  HARD_VIOLATION_RULES: {
    H1: { code: "H1", title: "USB Hardware Insertion Detected", severity: "CRITICAL" },
    H2: { code: "H2", title: "Unauthorized Application Execution", severity: "HIGH" },
    H3: { code: "H3", title: "Window Focus Loss / Away Breach", severity: "MEDIUM" },
    H4a: { code: "H4a", title: "Clipboard Buffer Violation", severity: "HIGH" },
    H4b: { code: "H4b", title: "Workspace & Document Tampering", severity: "HIGH" }
  }
};
