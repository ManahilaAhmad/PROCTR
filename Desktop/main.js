const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Suppress harmless Chromium GPU cache warnings on Windows
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

let mainWindow;
let pythonProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    title: "PROCTR Desktop — Secure Exam Environment",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Default screen protection to FALSE on app launch (enabled only during active exam)
  mainWindow.setContentProtection(false);

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Intercept window close to warn student
  mainWindow.on('close', (e) => {
    // Send close warning event to renderer
    mainWindow.webContents.send('app-close-warning');
  });

  // DO NOT spawn Python sensors on app launch.
  // Sensors are spawned ONLY when a student actively joins an exam workspace via start-exam-workspace.
}

function startPythonSensors(examId, studentId) {
  const pythonScriptPath = path.join(__dirname, 'python_sensors', 'main.py');
  
  // Use python executable from system path
  pythonProcess = spawn('python', [
    pythonScriptPath,
    '--exam_id', String(examId),
    '--student_id', String(studentId)
  ]);

  console.log('[Electron] Spawned Python Background Sensor Engine PID:', pythonProcess.pid);

  // Listen to JSON lines printed by Python sensors
  pythonProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      try {
        const jsonPayload = JSON.parse(line);
        console.log('[Sensor Event Payload]:', jsonPayload);

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sensor-event', jsonPayload);
        }
      } catch (err) {
        console.log('[Python Raw Output]:', line);
      }
    }
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error('[Python Sensor Error]:', data.toString());
  });

  pythonProcess.on('close', (code) => {
    console.log(`[Electron] Python Sensor Process exited with code ${code}`);
  });
}

// ─── ENSURE ROOT EXAMS DIRECTORY ON APP STARTUP ────────────────────
function ensureRootExamsDirectory() {
  const rootDir = process.platform === 'win32' ? 'C:\\PROCTR_Exams' : path.join(require('os').homedir(), 'PROCTR_Exams');
  try {
    if (!fs.existsSync(rootDir)) {
      fs.mkdirSync(rootDir, { recursive: true });
      console.log(`[PROCTR] Created Root Exams Directory: ${rootDir}`);
    }
  } catch (err) {
    console.error('[PROCTR] Error creating root exams directory:', err.message);
  }
}

app.whenReady().then(() => {
  ensureRootExamsDirectory();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

function runRestoreDefaultsSync() {
  const restoreScript = path.join(__dirname, 'python_sensors', 'restore_network_defaults.py');
  try {
    const { execSync } = require('child_process');
    execSync(`python "${restoreScript}"`, { stdio: 'ignore', timeout: 5000 });
    console.log('[Electron] Guaranteed OS System Settings Restored to Default.');
  } catch (err) {
    console.log('[Electron Cleanup Note]:', err.message);
  }
}

app.on('window-all-closed', () => {
  if (pythonProcess) {
    try { pythonProcess.kill(); } catch (e) {}
  }
  runRestoreDefaultsSync();
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (pythonProcess) {
    try { pythonProcess.kill(); } catch (e) {}
  }
  runRestoreDefaultsSync();
});

// IPC Handler to stop sensors manually if needed
ipcMain.handle('stop-sensors', () => {
  if (pythonProcess) {
    console.log('[Electron] Stopping Python Sensor Process PID:', pythonProcess.pid);
    pythonProcess.kill();
    pythonProcess = null;
    return { status: 'stopped' };
  }
  return { status: 'no_process' };
});

// IPC Handler to Start Exam & Create Course Folder in C:\PROCTR_Exams\
ipcMain.handle('start-exam-workspace', async (event, { examId, studentId, courseCode, isStudent }) => {
  const rootDir = process.platform === 'win32' ? 'C:\\PROCTR_Exams' : path.join(require('os').homedir(), 'PROCTR_Exams');
  
  // Ensure Root directory exists
  if (!fs.existsSync(rootDir)) {
    fs.mkdirSync(rootDir, { recursive: true });
  }

  // Course-named folder e.g. C:\PROCTR_Exams\CS601_LAB or BSCS_DSA_LAB
  const cleanCode = (courseCode || examId || 'EXAM').toString().replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase();
  const courseFolderName = cleanCode.includes('LAB') ? cleanCode : `${cleanCode}_LAB`;
  const workspacePath = path.join(rootDir, courseFolderName);

  try {
    // Create course workspace directory tree and Submissions folder
    const submissionsPath = path.join(workspacePath, 'Submissions');
    const starterPath = path.join(workspacePath, 'starter_code');
    const logsPath = path.join(workspacePath, 'logs');

    fs.mkdirSync(workspacePath, { recursive: true });
    fs.mkdirSync(submissionsPath, { recursive: true });
    fs.mkdirSync(starterPath, { recursive: true });
    fs.mkdirSync(logsPath, { recursive: true });

    // Restart Python sensor engine ONLY for Student sessions
    if (isStudent !== false) {
      if (pythonProcess) {
        pythonProcess.kill();
      }
      startPythonSensors(examId || 1, studentId || 101);
    }

    return {
      status: 'success',
      workspacePath: workspacePath,
      submissionsPath: submissionsPath,
      message: `Course exam folder created at ${workspacePath}`
    };
  } catch (err) {
    console.error('Error creating course exam workspace:', err);
    return { status: 'error', message: err.message };
  }
});

// IPC Handler to Open Exam Workspace Folder in Windows Explorer
ipcMain.handle('open-workspace-folder', async (event, folderPath) => {
  if (!folderPath) return { status: 'error', message: 'No folder path provided' };
  try {
    await shell.openPath(folderPath);
    return { status: 'success' };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
});

// IPC Handler to Dynamically Enable/Disable Screen Protection (Anti-Screenshot)
ipcMain.handle('set-screen-protection', async (event, enable) => {
  if (mainWindow) {
    mainWindow.setContentProtection(Boolean(enable));
    console.log(`[Electron] Window Screen Protection set to: ${enable}`);
    return { status: 'success', protected: Boolean(enable) };
  }
  return { status: 'error' };
});


// IPC Handler to Minimize App Window on Screenshot Attempt
ipcMain.handle('minimize-window', async () => {
  if (mainWindow) {
    mainWindow.minimize();
    console.log('[Electron] Window minimized due to screenshot attempt during active exam.');
    return { status: 'success' };
  }
  return { status: 'error' };
});

// IPC Handler — Write local log file (offline-first storage)
// Logs are always written locally, even when backend is unreachable
ipcMain.handle('write-local-log', async (event, { endpoint, payload, timestamp }) => {
  try {
    const rootDir = process.platform === 'win32' ? 'C:\\PROCTR_Exams' : path.join(require('os').homedir(), 'PROCTR_Exams');
    const logsDir = path.join(rootDir, 'offline_logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const logFile = path.join(logsDir, `offline_log_${date}.json`);

    // Read existing log file
    let logs = [];
    if (fs.existsSync(logFile)) {
      try { logs = JSON.parse(fs.readFileSync(logFile, 'utf8')); } catch { logs = []; }
    }

    logs.push({ endpoint, payload, timestamp, written_at: new Date().toISOString() });

    // Keep last 2000 entries per file
    if (logs.length > 2000) logs = logs.slice(-2000);

    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2), 'utf8');
    return { status: 'success', path: logFile };
  } catch (err) {
    console.error('[Electron] Failed to write local log:', err.message);
    return { status: 'error', message: err.message };
  }
});
