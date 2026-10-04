const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const https = require('https');
const AdmZip = require('adm-zip');
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

function startPythonSensors(examId, studentId, securityPolicy = {}) {
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

function downloadBuffer(urlString, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const client = String(urlString).startsWith('https:') ? https : http;
    const request = client.get(urlString, { timeout: 30000 }, response => {
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
      const relativePath = path.relative(rootDir, fullPath).split(path.sep).join('/');
      const buffer = fs.readFileSync(fullPath);
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

let currentApiBase = 'http://localhost:5000/api';

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
ipcMain.handle('start-exam-workspace', async (event, { examId, studentId, courseCode, isStudent, securityPolicy }) => {
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
      startPythonSensors(examId || 1, studentId || 101, securityPolicy || {});
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

// Downloads the released Cloudinary starter package only after the backend
// reports that the invigilator has revealed the exam materials.
ipcMain.handle('install-starter-code', async (event, { workspacePath, fileUrl, originalName }) => {
  try {
    if (!workspacePath || !fileUrl) return { status: 'error', message: 'Starter-code location is missing.' };
    const starterRoot = path.resolve(workspacePath, 'starter_code');
    fs.mkdirSync(starterRoot, { recursive: true });
    const buffer = await downloadBuffer(fileUrl);
    const requestedName = path.basename(originalName || new URL(fileUrl).pathname || 'starter_code');

    if (requestedName.toLowerCase().endsWith('.zip')) {
      const archive = new AdmZip(buffer);
      for (const entry of archive.getEntries()) {
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

// IPC Handler — Submit a student's exam work.
// Reads every file inside <workspacePath>/Submissions/ from disk (the
// student's own PC — this is why it happens in the main process, which has
// real filesystem access) and uploads it to the backend, which files it
// under the right teacher/lab/roll-number folder and generates the
// security log report. Called both automatically (session end / timer
// expiry) and manually (Submit button) — the backend safely overwrites
// on re-submission rather than duplicating.
ipcMain.handle('submit-exam-work', async (event, { examId, studentId, sessionCode, workspacePath, submissionType, apiBase, sessionToken }) => {
  try {
    if (!workspacePath) {
      return { status: 'error', message: 'No active exam workspace to submit from.' };
    }
    if (!examId || !studentId) {
      return { status: 'error', message: 'Missing exam or student identity — cannot submit.' };
    }

    // Only the contents of the Submissions folder are collected — that's
    // the folder students are expected to place their final work in.
    // Everything else in the workspace (starter_code, logs) is ignored.
    const submissionsFolder = path.join(workspacePath, 'Submissions');
    const files = collectFilesRecursive(submissionsFolder, submissionsFolder, []);

    console.log(`[Electron] Submit triggered (${submissionType || 'MANUAL'}). Scanning: ${submissionsFolder}`);
    console.log(`[Electron] Found ${files.length} file(s):`, files.map(f => f.relativePath));

    const base = apiBase || currentApiBase;
    const result = await postJson(`${base}/submission/upload`, {
      exam_id: examId,
      student_id: studentId,
      mac_address: getMacAddress(),
      files
    }, sessionToken);

    if (!result.ok) {
      console.error(`[Electron] Upload failed (HTTP ${result.status}):`, result.body?.message);
      return { status: 'error', message: result.body?.message || `Upload failed (HTTP ${result.status}).` };
    }

    console.log(`[Electron] Submission uploaded: ${files.length} file(s) for student ${studentId}, exam ${examId}`);
    return {
      status: 'success',
      message: result.body.message,
      file_count: result.body.file_count,
      submission_id: result.body.submission_id
    };
  } catch (err) {
    console.error('[Electron] Error submitting exam work:', err.message);
    return { status: 'error', message: `Could not reach the backend server to submit: ${err.message}` };
  }
});
