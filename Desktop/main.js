const { app, BrowserWindow, ipcMain, shell, dialog, safeStorage, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { SubmissionQueue } = require('./submissionQueue');
const { requestJson } = require('./apiClient');
const API_BASE = (process.env.PROCTR_API_BASE || 'http://localhost:5000/api').replace(/\/$/, '');
const http = require('http');
const https = require('https');
const AdmZip = require('adm-zip');
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
  const job = submissionQueue.save({
    ...activeSubmission,
    apiBase: API_BASE,
    // Desktop login responses use sessionToken. Keep accessToken compatibility
    // for previously stored sessions so queued submissions can retry in both
    // local and LAN runs.
    accessToken: signedInUser?.sessionToken || signedInUser?.accessToken,
    macAddress: getMacAddress(),
  });
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

function sessionTokenPath() {
  return path.join(app.getPath('userData'), 'secure-session.bin');
}

ipcMain.handle('store-session-token', (_event, token) => {
  if (!safeStorage.isEncryptionAvailable() || typeof token !== 'string' || !token) return false;
  fs.writeFileSync(sessionTokenPath(), safeStorage.encryptString(token), { mode: 0o600 });
  return true;
});

ipcMain.handle('get-session-token', () => {
  try {
    if (!safeStorage.isEncryptionAvailable() || !fs.existsSync(sessionTokenPath())) return null;
    return safeStorage.decryptString(fs.readFileSync(sessionTokenPath()));
  } catch {
    return null;
  }
});

ipcMain.handle('clear-session-token', () => {
  try { if (fs.existsSync(sessionTokenPath())) fs.rmSync(sessionTokenPath()); } catch {}
  return true;
});

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

  // The desktop renderer is a local application, so it must never be
  // navigated to content supplied by an exam file or database value.
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    if (!navigationUrl.startsWith('file:')) event.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // An active exam must be ended through the exam workflow before the window
  // can close. Keep this check in the main process so it also covers Alt+F4.
  examWindow.on('close', (e) => {
    if (examWindow.__allowClose) return;
    if (activeSubmissions.has(examWindow.webContents.id)) {
      e.preventDefault();
      if (!examWindow.__activeExamCloseNotice) {
        examWindow.__activeExamCloseNotice = true;
        void dialog.showMessageBox(examWindow, {
          type: 'warning',
          title: 'Exam in progress',
          message: 'PROCTR cannot close while your exam session is active.',
          detail: 'Wait for the invigilator to end the session, then submit your work and leave the exam environment.'
        }).finally(() => { examWindow.__activeExamCloseNotice = false; });
      }
      return;
    }
    if (quitting) return;
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

function startPythonSensors(examId, studentId, targetWebContents, securityPolicy = {}) {
  const pythonScriptPath = path.join(__dirname, 'python_sensors', 'main.py');
  
  // Use python executable from system path
  pythonProcess = spawn('python', [
    pythonScriptPath,
    '--exam_id', String(examId),
    '--student_id', String(studentId)
  ]);

  console.log('[Electron] Spawned Python Background Sensor Engine PID:', pythonProcess.pid);

  const policyCommand = {
    type: 'UPDATE_SECURITY_POLICY',
    allowed_subnet: securityPolicy.allowed_subnet,
    clipboard_threshold_chars: securityPolicy.clipboard_threshold_chars,
    focus_loss_seconds: securityPolicy.focus_loss_seconds,
  };
  pythonProcess.stdin.write(`${JSON.stringify(policyCommand)}\n`);

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
  const rootDir = getExamRoot();
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

// ─── HELPER: POST JSON to the backend (main process, no browser fetch needed) ──
function postJson(urlString, bodyObj, sessionToken = null) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlString);
      const body = Buffer.from(JSON.stringify(bodyObj), 'utf-8');
      const req = http.request({
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': body.length,
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {})
        },
        timeout: 30000
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let parsed = null;
          try { parsed = JSON.parse(data); } catch { parsed = { status: 'error', message: 'Invalid response from server.' }; }
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body: parsed });
        });
      });
      req.on('error', (err) => reject(err));
      req.on('timeout', () => { req.destroy(new Error('Request timed out')); });
      req.write(body);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

function getExamRoot() {
  return path.resolve(process.platform === 'win32' ? 'C:\\PROCTR_Exams' : path.join(os.homedir(), 'PROCTR_Exams'));
}

function requireExamWorkspace(candidatePath) {
  const root = getExamRoot();
  const resolved = path.resolve(String(candidatePath || ''));
  if (resolved === root || !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('The requested path is outside the PROCTR exam workspace.');
  }
  return resolved;
}

function downloadBuffer(urlString, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(urlString);
      const hostname = parsedUrl.hostname.toLowerCase();
      const allowedCloudinaryHost = hostname === 'res.cloudinary.com' || hostname.endsWith('.cloudinary.com') || hostname.endsWith('.cloudinary.net');
      if (parsedUrl.protocol !== 'https:' || !allowedCloudinaryHost) throw new Error('Starter code must use an approved HTTPS Cloudinary URL.');
    } catch (error) {
      reject(error);
      return;
    }
    const request = https.get(parsedUrl, { timeout: 30000 }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location && redirectsLeft > 0) {
        response.resume();
        return resolve(downloadBuffer(new URL(response.headers.location, urlString).toString(), redirectsLeft - 1));
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        return reject(new Error(`Starter-code download failed (HTTP ${response.statusCode}).`));
      }
      const chunks = [];
      let total = 0;
      response.on('data', chunk => {
        total += chunk.length;
        if (total > 50 * 1024 * 1024) request.destroy(new Error('Starter-code package exceeds the 50 MB download limit.'));
        else chunks.push(chunk);
      });
      response.on('end', () => resolve(Buffer.concat(chunks)));
    });
    request.on('timeout', () => request.destroy(new Error('Starter-code download timed out.')));
    request.on('error', reject);
  });
}

// ─── HELPER: Recursively collect every file inside a folder.
// Optionally skip specific top-level subfolder names (by exact name match
// at the root level only, e.g. 'logs' — local sensor logs, not solution work).
// Whatever is on disk gets read and submitted exactly as-is — including
// empty files. No retries, no validation, no second-guessing content.
function collectFilesRecursive(rootDir, currentDir, out, skipTopLevelNames = []) {
  if (!fs.existsSync(currentDir)) return out;
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const isTopLevel = currentDir === rootDir;
    if (isTopLevel && entry.isDirectory() && skipTopLevelNames.includes(entry.name)) {
      continue;
    }
    if (entry.isDirectory()) {
      collectFilesRecursive(rootDir, fullPath, out, skipTopLevelNames);
    } else if (entry.isFile()) {
      if (out.length >= 2000) throw new Error('Submission contains too many files (maximum 2000).');
      const relativePath = path.relative(rootDir, fullPath).split(path.sep).join('/');
      const buffer = fs.readFileSync(fullPath);
      if (buffer.length > 10 * 1024 * 1024) throw new Error(`Submission file is larger than 10 MB: ${relativePath}`);
      const currentTotal = out.reduce((sum, file) => sum + file.size, 0);
      if (currentTotal + buffer.length > 20 * 1024 * 1024) throw new Error('Submission is larger than the 20 MB total limit.');
      out.push({
        relativePath,
        contentBase64: buffer.toString('base64'),
        size: buffer.length
      });
    }
  }
  return out;
}

// ─── HELPER: Get this machine's MAC address (schema.sql requires it,
// NOT NULL, on every student_submission row) ────────────────────────
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
  if (user?.studentId && (user?.accessToken || user?.sessionToken)) {
    submissionQueue.refreshToken(user.studentId, API_BASE, user.accessToken || user.sessionToken);
  }
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
    runRestoreDefaultsSync();
    return { status: 'stopped' };
  }
  runRestoreDefaultsSync();
  return { status: 'no_process' };
});

// IPC Handler to Start Exam & Create Course Folder in C:\PROCTR_Exams\
ipcMain.handle('start-exam-workspace', async (event, { examId, studentId, submissionStudentId, courseCode, sessionCode, isStudent, securityPolicy }) => {
  const rootDir = getExamRoot();
  
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
      startPythonSensors(examId || 1, submissionStudentId || studentId || 101, event.sender, securityPolicy || {});
    }

    if (isStudent !== false) activeSubmissions.set(event.sender.id, { workspacePath, examId, studentId: submissionStudentId || studentId });
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

// Downloads the released Cloudinary starter package only after the backend
// reports that the invigilator has revealed the exam materials.
ipcMain.handle('install-starter-code', async (event, { workspacePath, fileUrl, originalName }) => {
  try {
    if (!workspacePath || !fileUrl) return { status: 'error', message: 'Starter-code location is missing.' };
    const starterRoot = path.resolve(requireExamWorkspace(workspacePath), 'starter_code');
    fs.mkdirSync(starterRoot, { recursive: true });
    const buffer = await downloadBuffer(fileUrl);
    const requestedName = path.basename(originalName || new URL(fileUrl).pathname || 'starter_code');

    if (requestedName.toLowerCase().endsWith('.zip')) {
      const archive = new AdmZip(buffer);
      const entries = archive.getEntries();
      if (entries.length > 2000) throw new Error('Starter-code archive contains too many files.');
      const expandedBytes = entries.reduce((sum, entry) => sum + Number(entry.header?.size || 0), 0);
      if (expandedBytes > 200 * 1024 * 1024) throw new Error('Starter-code archive expands beyond the 200 MB limit.');
      for (const entry of entries) {
        const destination = path.resolve(starterRoot, entry.entryName);
        if (destination !== starterRoot && !destination.startsWith(`${starterRoot}${path.sep}`)) {
          throw new Error('Unsafe path detected in starter-code archive.');
        }
        if (entry.isDirectory) fs.mkdirSync(destination, { recursive: true });
        else {
          fs.mkdirSync(path.dirname(destination), { recursive: true });
          fs.writeFileSync(destination, entry.getData());
        }
      }
    } else {
      const safeName = requestedName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'starter_code.txt';
      fs.writeFileSync(path.join(starterRoot, safeName), buffer);
    }

    return { status: 'success', starterPath: starterRoot };
  } catch (error) {
    console.error('[StarterCode] Installation failed:', error.message);
    return { status: 'error', message: error.message };
  }
});

// Renderer PDF fetches can be blocked by a restrictive CSP or institutional
// browser policy. Keep the same trusted Cloudinary-only rule as starter code
// and return the bytes to the renderer for its read-only document viewer.
ipcMain.handle('download-exam-paper', async (_event, fileUrl) => {
  try {
    const buffer = await downloadBuffer(fileUrl);
    return { status: 'success', contentBase64: buffer.toString('base64') };
  } catch (error) {
    console.error('[ExamPaper] Download failed:', error.message);
    return { status: 'error', message: error.message };
  }
});

// IPC Handler to Open Exam Workspace Folder in Windows Explorer
ipcMain.handle('open-workspace-folder', async (event, folderPath) => {
  if (!folderPath) return { status: 'error', message: 'No folder path provided' };
  try {
    await shell.openPath(requireExamWorkspace(folderPath));
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
ipcMain.handle('submit-exam-work', async (event, { examId, studentId, sessionCode, workspacePath, submissionType, apiBase, sessionToken }) => {
  try {
    const activeSubmission = activeSubmissions.get(event.sender.id);
    if (!activeSubmission) throw new Error('No active exam workspace is registered for this window. Rejoin the exam before submitting.');
    if (!activeSubmission.examId || !activeSubmission.studentId) {
      throw new Error('The active exam workspace is missing its exam or student identity. Rejoin the exam before submitting.');
    }
    if (activeSubmission.workspacePath !== workspacePath ||
        String(activeSubmission.examId) !== String(examId) || String(activeSubmission.studentId) !== String(studentId)) {
      console.warn('[Electron] Submission UI state differed from the active workspace; using canonical main-process values.');
    }
    workspacePath = requireExamWorkspace(activeSubmission.workspacePath);
    const submissionExamId = activeSubmission.examId;
    const submissionStudentId = activeSubmission.studentId;
    // Only the contents of the Submissions folder are collected — that's
    // the folder students are expected to place their final work in.
    // Everything else in the workspace (starter_code, logs) is ignored.
    const submissionsFolder = path.join(requireExamWorkspace(workspacePath), 'Submissions');
    const files = collectFilesRecursive(submissionsFolder, submissionsFolder, []);

    console.log(`[Electron] Submit triggered (${submissionType || 'MANUAL'}). Scanning: ${submissionsFolder}`);
    console.log(`[Electron] Found ${files.length} file(s):`, files.map(f => f.relativePath));

    const base = apiBase || currentApiBase;
    const parsedBase = new URL(base);
    if (!['localhost', '127.0.0.1'].includes(parsedBase.hostname) || parsedBase.protocol !== 'http:' || parsedBase.pathname.replace(/\/$/, '') !== '/api') {
      throw new Error('The submission API address is not trusted.');
    }
    // Use the durable queue for manual submissions too. This creates the
    // encrypted local backup before contacting the backend and keeps retrying
    // until Cloudinary returns a database-backed receipt.
    const job = submissionQueue.save({
      workspacePath,
      examId: submissionExamId,
      studentId: submissionStudentId,
      apiBase: base,
      accessToken: sessionToken,
      macAddress: getMacAddress()
    });
    await submissionQueue.flush();
    const completedJob = submissionQueue.jobs.get(job.requestId);

    if (completedJob?.state !== 'synced') {
      const message = completedJob?.message || 'Your submission was backed up on this PC and is waiting for Cloudinary confirmation.';
      console.warn(`[Electron] Submission ${job.requestId} is pending cloud confirmation:`, message);
      return { status: 'error', message };
    }

    const receipt = completedJob.receipt || {};
    console.log(`[Electron] Submission confirmed in Cloudinary: ${files.length} file(s) for student ${submissionStudentId}, exam ${submissionExamId}`);
    return {
      status: 'success',
      message: receipt.message || 'Submission saved to Cloudinary successfully.',
      file_count: receipt.file_count ?? files.length,
      submission_id: receipt.submission_id,
      request_id: job.requestId
    };
  } catch (err) {
    console.error('[Electron] Error submitting exam work:', err.message);
    return { status: 'error', message: `Submission could not be completed: ${err.message}` };
  }
});
