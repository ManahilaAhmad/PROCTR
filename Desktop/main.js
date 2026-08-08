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

  // Start Background Python Sensor Engine (Person 1 Core)
  startPythonSensors(1, 101);
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

app.on('window-all-closed', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handler to stop sensors manually if needed
ipcMain.handle('stop-sensors', () => {
  if (pythonProcess) {
    pythonProcess.kill();
    return { status: 'stopped' };
  }
  return { status: 'no_process' };
});

// IPC Handler to Start Exam & Create Course Folder in C:\PROCTR_Exams\
ipcMain.handle('start-exam-workspace', async (event, { examId, studentId, courseCode }) => {
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

    // Restart Python sensor engine targeted at this workspace
    if (pythonProcess) {
      pythonProcess.kill();
    }
    startPythonSensors(examId || 1, studentId || 101);

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


