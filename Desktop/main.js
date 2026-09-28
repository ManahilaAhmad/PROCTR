const { app, BrowserWindow, ipcMain, shell, dialog, safeStorage, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { SubmissionQueue } = require('./submissionQueue');
const { requestJson } = require('./apiClient');
const API_BASE = (process.env.PROCTR_API_BASE || 'http://localhost:5000/api').replace(/\/$/, '');
const { spawn } = require('child_process');

// Suppress harmless Chromium GPU cache warnings on Windows
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

let mainWindow;
let windowCounter = 0;
let pythonProcess = null;
let submissionQueue;
const activeSubmissions = new Map();
const signedInUsers = new Map();
let tray;
let quitting = false;
const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock) app.quit();
app.on('second-instance', () => {
  // A second launch is intentional in labs: it lets a teacher and a student
  // sign in on one PC without sharing browser storage or submission identity.
  if (app.isReady()) createWindow();
});

function backupActiveSubmission(webContentsId) {
  const activeSubmission = activeSubmissions.get(webContentsId);
  const signedInUser = signedInUsers.get(webContentsId);
  if (!activeSubmission) return null;
  const job = submissionQueue.save({ ...activeSubmission, apiBase: API_BASE, accessToken: signedInUser?.accessToken, macAddress: getMacAddress() });
  activeSubmission.requestId = job.requestId;
  return job;
}
function flushSubmissions() {
  return submissionQueue.flush().catch(() => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('submission-storage-error', 'Unable to process saved submissions. Ask the invigilator to check the backup folder.');
    }
  });
}
function stopSensors() {
  if (pythonProcess) { pythonProcess.kill(); pythonProcess = null; }
}
function showQueueStatus() {
  const pending = submissionQueue.list().filter(job => job.state !== 'synced');
  dialog.showMessageBox({ type: pending.length ? 'warning' : 'info', title: 'Submission backups',
    message: pending.length ? `${pending.length} submission(s) still need cloud confirmation. Keep this PC on.` : 'All saved submissions have cloud receipts.',
    detail: `Backup folder: ${submissionQueue.directory}` });
}

function createWindow() {
  const windowId = ++windowCounter;
  const examWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    title: "PROCTR Desktop — Secure Exam Environment",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      partition: `persist:proctr-window-${windowId}`,
      additionalArguments: [`--proctr-api-base=${API_BASE}`]
    }
  });

  // Default screen protection to FALSE on app launch (enabled only during active exam)
  mainWindow = examWindow;
  const webContentsId = examWindow.webContents.id;
  examWindow.setContentProtection(false);

  examWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Intercept window close to warn student
  examWindow.on('close', (e) => {
    if (quitting || examWindow.__allowClose) return;
    e.preventDefault();
    try { backupActiveSubmission(examWindow.webContents.id); }
    catch (error) { dialog.showErrorBox('Submission was not saved', error.message); return; }
    stopSensors();
    if (submissionQueue.hasPending()) {
      examWindow.hide();
      showQueueStatus();
      void flushSubmissions();
    } else { examWindow.__allowClose = true; examWindow.close(); }
  });
  examWindow.on('closed', () => {
    activeSubmissions.delete(webContentsId);
    signedInUsers.delete(webContentsId);
    if (mainWindow === examWindow) mainWindow = BrowserWindow.getAllWindows().at(-1) || null;
  });

  // DO NOT spawn Python sensors on app launch.
  // Sensors are spawned ONLY when a student actively joins an exam workspace via start-exam-workspace.
}

function startPythonSensors(examId, studentId, targetWebContents) {
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

        if (targetWebContents && !targetWebContents.isDestroyed()) {
          targetWebContents.send('sensor-event', jsonPayload);
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
  submissionQueue = new SubmissionQueue({
    directory: path.join(app.getPath('userData'), 'submission-backups'), request: requestJson,
    encodeToken: token => {
      if (!token) return null;
      if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure credential storage is unavailable. Contact the invigilator.');
      return safeStorage.encryptString(token).toString('base64');
    },
    decodeToken: value => value ? safeStorage.decryptString(Buffer.from(value, 'base64')) : null,
    onChange: job => {
      for (const window of BrowserWindow.getAllWindows()) window.webContents.send('submission-state', job);
      if (tray) tray.setToolTip(submissionQueue.hasPending() ? 'PROCTR: submissions waiting to upload' : 'PROCTR: submissions confirmed');
    }
  });
  createWindow();
  const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('PROCTR submission backups');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open PROCTR', click: () => mainWindow.show() },
    { label: 'Submission status', click: showQueueStatus },
    { label: 'Open backup folder', click: () => shell.openPath(submissionQueue.directory) },
    { label: 'Retry saved submissions', click: () => { for (const job of submissionQueue.jobs.values()) job.nextRetry = 0; void flushSubmissions(); } },
    { label: 'Quit', click: async () => {
      try {
        for (const webContentsId of activeSubmissions.keys()) backupActiveSubmission(webContentsId);
      } catch (error) { dialog.showErrorBox('Submission was not saved', error.message); return; }
      if (submissionQueue.hasPending()) {
        const answer = await dialog.showMessageBox({ type: 'warning', buttons: ['Keep uploading', 'Quit with backup saved'], defaultId: 0, cancelId: 0,
          message: 'Submissions are still waiting for cloud confirmation.', detail: 'Quitting stops retries. Saved copies remain on this PC and resume when PROCTR is reopened. Notify the invigilator before leaving.' });
        if (answer.response !== 1) return;
      }
      quitting = true; app.quit();
    } }
  ]));
  if (submissionQueue.recoveryErrors.length) dialog.showErrorBox('Submission backup needs attention', 'Some saved backup files could not be read. They have not been deleted. Contact the invigilator.');
  setInterval(() => void flushSubmissions(), 15000).unref();
  void flushSubmissions();

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

// Identify the machine in the submitted receipt.
function getMacAddress() {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
          return iface.mac;
        }
      }
    }
  } catch {}
  return '00:00:00:00:00:00';
}

app.on('before-quit', () => {
  for (const webContentsId of activeSubmissions.keys()) {
    try { backupActiveSubmission(webContentsId); } catch { /* Normal close reports errors; forced shutdown cannot be blocked reliably. */ }
  }
  stopSensors();
});
ipcMain.handle('set-submission-user', (event, user) => {
  if (user) signedInUsers.set(event.sender.id, user);
  else signedInUsers.delete(event.sender.id);
  if (user?.studentId && user?.accessToken) submissionQueue.refreshToken(user.studentId, API_BASE, user.accessToken);
  void flushSubmissions();
});
ipcMain.handle('submission-backups', event => {
  const user = signedInUsers.get(event.sender.id);
  return submissionQueue.list().filter(job => String(job.studentId) === String(user?.studentId));
});
ipcMain.handle('finish-exam-work', event => {
  try {
    const job = backupActiveSubmission(event.sender.id); activeSubmissions.delete(event.sender.id); stopSensors();
    void flushSubmissions();
    return { status: 'success', pending: job && job.state !== 'synced' };
  } catch (error) { return { status: 'error', message: error.message }; }
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
ipcMain.handle('start-exam-workspace', async (event, { examId, studentId, courseCode, sessionCode, isStudent }) => {
  const rootDir = process.platform === 'win32' ? 'C:\\PROCTR_Exams' : path.join(require('os').homedir(), 'PROCTR_Exams');
  
  // Ensure Root directory exists
  if (!fs.existsSync(rootDir)) {
    fs.mkdirSync(rootDir, { recursive: true });
  }

  // Course-named folder e.g. C:\PROCTR_Exams\CS601_LAB or BSCS_DSA_LAB
  const cleanCode = (courseCode || examId || 'EXAM').toString().replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase();
  const courseFolderName = cleanCode.includes('LAB') ? cleanCode : `${cleanCode}_LAB`;
  const cleanId = value => String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const workspacePath = path.join(rootDir, `student_${cleanId(studentId)}`, `exam_${cleanId(examId)}_${cleanId(sessionCode)}`, courseFolderName);

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
      startPythonSensors(examId || 1, studentId || 101, event.sender);
    }

    if (isStudent !== false) activeSubmissions.set(event.sender.id, { workspacePath, examId, studentId });
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
  const sourceWindow = BrowserWindow.fromWebContents(event.sender);
  if (sourceWindow) {
    sourceWindow.setContentProtection(Boolean(enable));
    console.log(`[Electron] Window Screen Protection set to: ${enable}`);
    return { status: 'success', protected: Boolean(enable) };
  }
  return { status: 'error' };
});


// IPC Handler to Minimize App Window on Screenshot Attempt
ipcMain.handle('minimize-window', async () => {
  const sourceWindow = BrowserWindow.getFocusedWindow();
  if (sourceWindow) {
    sourceWindow.minimize();
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

// IPC Handler — Submit a student's exam work.
// Reads every file inside <workspacePath>/Submissions/ from disk (the
// student's own PC — this is why it happens in the main process, which has
// real filesystem access) and uploads it to the backend, which stores the
// final submission and security log report in Cloudinary. The local folder
// remains the student's editable workspace, not the dashboard's storage.
// Called both automatically (session end / timer
// expiry) and manually (Submit button) — the backend safely overwrites
// on re-submission rather than duplicating.
ipcMain.handle('submit-exam-work', async (event, { examId, studentId, workspacePath }) => {
  try {
    const activeSubmission = activeSubmissions.get(event.sender.id);
    if (!activeSubmission || activeSubmission.workspacePath !== workspacePath ||
        String(activeSubmission.examId) !== String(examId) || String(activeSubmission.studentId) !== String(studentId)) {
      throw new Error('The active exam workspace does not match this submission.');
    }
    const saved = backupActiveSubmission(event.sender.id);
    if (!saved?.requestId) throw new Error('The backup record could not be created. Your working files remain unchanged.');
    await flushSubmissions();
    const job = submissionQueue.list().find(item => item.requestId === saved.requestId);
    if (!job) throw new Error('The saved backup could not be found. Your working files remain unchanged.');
    return job.state === 'synced' ? { ...job.receipt, backupPath: job.backupPath }
      : { status: 'pending', message: job.message, request_id: job.requestId, backupPath: job.backupPath };
  } catch (error) {
    return { status: 'error', message: `Submission could not be saved: ${error.message}` };
  }
});
