const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');

function fingerprintFor(body, apiBase) {
  return createHash('sha256').update(JSON.stringify([String(body.exam_id), String(body.student_id), apiBase, body.files])).digest('hex');
}

function atomicJson(file, value) {
  const temp = `${file}.${randomUUID()}.tmp`;
  const fd = fs.openSync(temp, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value)); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(temp, file);
  // Windows does not support opening directories for fsync this way.
  if (process.platform !== 'win32') {
    const dir = fs.openSync(path.dirname(file), 'r');
    try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
  }
}

function collectSnapshot(root) {
  if (!fs.existsSync(root)) throw new Error('The Submissions folder is missing. Your work has not been submitted.');
  const files = [];
  let bytes = 0;
  function visit(directory) {
    if (fs.lstatSync(directory).isSymbolicLink()) throw new Error('Submission folders cannot be symbolic links.');
    for (const name of fs.readdirSync(directory).sort()) {
      const full = path.join(directory, name);
      const before = fs.lstatSync(full);
      if (before.isSymbolicLink()) throw new Error('Submission files cannot be symbolic links.');
      if (before.isDirectory()) { visit(full); continue; }
      if (!before.isFile()) throw new Error('A submission entry is not a regular file.');
      if (files.length >= 500 || before.size > 10 * 1024 * 1024 || bytes + before.size > 40 * 1024 * 1024) {
        throw new Error('Submission limit: 500 files, 10 MB per file, 40 MB total. Your working files are unchanged.');
      }
      const buffer = fs.readFileSync(full);
      const after = fs.statSync(full);
      if (buffer.length !== before.size || before.mtimeMs !== after.mtimeMs || before.ino !== after.ino) {
        throw new Error('A file changed while saving the submission. Save your work and submit again.');
      }
      bytes += buffer.length;
      files.push({ relativePath: path.relative(root, full).split(path.sep).join('/'), contentBase64: buffer.toString('base64') });
    }
  }
  visit(root);
  return files;
}

class SubmissionQueue {
  constructor({ directory, request, encodeToken, decodeToken, onChange = () => {}, now = Date.now }) {
    this.directory = directory;
    this.request = request;
    this.encodeToken = encodeToken;
    this.decodeToken = decodeToken;
    this.onChange = onChange;
    this.now = now;
    this.jobs = new Map();
    this.running = null;
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.recoveryErrors = [];
    for (const name of fs.readdirSync(directory).filter(name => /^[a-f0-9-]{36}\.payload\.json$/.test(name))) {
      try {
        const payload = JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
        const id = name.replace('.payload.json', '');
        if (payload.body.request_id !== id) throw new Error('Invalid backup');
        if (fingerprintFor(payload.body, payload.apiBase) !== payload.fingerprint) throw new Error('Backup contents changed');
        let state;
        try { state = JSON.parse(fs.readFileSync(this.metaPath(id), 'utf8')); }
        catch { state = { state: 'pending', attempts: 0, nextRetry: 0 }; }
        this.jobs.set(id, { ...state, payload });
      } catch { this.recoveryErrors.push(name); }
    }
  }
  metaPath(id) { return path.join(this.directory, `${id}.json`); }
  persist(job) {
    const { payload, ...state } = job;
    atomicJson(this.metaPath(payload.body.request_id), state);
  }
  publicJob(job) {
    return {
      requestId: job.payload.body.request_id, studentId: job.payload.body.student_id,
      examId: job.payload.body.exam_id, state: job.state, message: job.message,
      savedAt: job.payload.savedAt, receipt: job.receipt,
      backupPath: path.join(this.directory, `${job.payload.body.request_id}.payload.json`)
    };
  }
  list() { return [...this.jobs.values()].map(job => this.publicJob(job)); }
  notify(job) { this.onChange(this.publicJob(job)); }
  hasPending() { return [...this.jobs.values()].some(job => job.state !== 'synced'); }

  save({ workspacePath, examId, studentId, apiBase, accessToken, macAddress }) {
    const files = collectSnapshot(path.join(workspacePath, 'Submissions'));
    const fingerprint = fingerprintFor({ exam_id: examId, student_id: studentId, files }, apiBase);
    const existing = [...this.jobs.values()].reverse().find(job => job.payload.fingerprint === fingerprint);
    if (existing) {
      this.refreshToken(studentId, apiBase, accessToken);
      existing.nextRetry = 0;
      this.persist(existing);
      return this.publicJob(existing);
    }
    const id = randomUUID();
    const payload = {
      savedAt: new Date(this.now()).toISOString(), fingerprint, apiBase,
      token: this.encodeToken(accessToken),
      body: { request_id: id, exam_id: examId, student_id: studentId, mac_address: macAddress, files }
    };
    // The immutable file bytes land on disk before networking or a success UI.
    atomicJson(path.join(this.directory, `${id}.payload.json`), payload);
    const job = { payload, state: 'pending', attempts: 0, nextRetry: 0, message: 'Backup saved on this PC. Waiting for cloud confirmation.' };
    this.jobs.set(id, job);
    this.persist(job);
    this.notify(job);
    return this.publicJob(job);
  }

  refreshToken(studentId, apiBase, token) {
    if (!token) return;
    for (const job of this.jobs.values()) {
      if (String(job.payload.body.student_id) !== String(studentId) || job.payload.apiBase !== apiBase || job.state === 'synced') continue;
      job.tokenOverride = this.encodeToken(token);
      if (job.authRequired) { job.state = 'pending'; job.authRequired = false; job.nextRetry = 0; }
      this.persist(job);
    }
  }

  async flush() {
    if (this.running) return this.running;
    this.running = this.run();
    try { await this.running; } finally { this.running = null; }
  }
  async run() {
    // Send older saved copies first. A failed older job blocks newer jobs for
    // that same student/exam, but never blocks unrelated students.
    const blocked = new Set();
    const jobs = [...this.jobs.values()].sort((a, b) => a.payload.savedAt.localeCompare(b.payload.savedAt));
    for (const job of jobs) {
      if (job.state === 'synced') continue;
      const owner = `${job.payload.apiBase}:${job.payload.body.student_id}:${job.payload.body.exam_id}`;
      if (blocked.has(owner)) continue;
      blocked.add(owner);
      if (job.state === 'needs_attention' || job.nextRetry > this.now()) continue;
      try {
        if (fingerprintFor(job.payload.body, job.payload.apiBase) !== job.payload.fingerprint) {
          throw Object.assign(new Error('Backup integrity check failed. Original copy retained for recovery.'), { status: 422 });
        }
        const token = this.decodeToken(job.tokenOverride || job.payload.token);
        if (!token) throw Object.assign(new Error('Sign in again to upload your saved copy.'), { status: 401 });
        const { apiBase, body } = job.payload;
        let result = await this.request(`${apiBase}/submission/receipt/${body.request_id}`, { token });
        if (result.status === 404 || result.status === 202) {
          result = await this.request(`${apiBase}/submission/upload`, { token, body });
        }
        if (!result.ok || result.body?.status !== 'success' || result.body.request_id !== body.request_id ||
            !['complete', 'superseded'].includes(result.body.receipt_state) || !result.body.submission_id) {
          throw Object.assign(new Error(result.body?.message || 'Cloud confirmation is not available yet.'), { status: result.status });
        }
        job.state = 'synced';
        job.receipt = result.body;
        job.message = result.body.message;
        job.confirmedAt = new Date(this.now()).toISOString();
        this.persist(job);
        blocked.delete(owner);
      } catch (error) {
        job.attempts++;
        job.authRequired = error.status === 401;
        job.state = [400, 401, 403, 409, 413, 422].includes(error.status) ? 'needs_attention' : 'pending';
        job.nextRetry = this.now() + Math.min(300000, 5000 * 2 ** Math.min(job.attempts, 6));
        job.message = `${error.message} Backup retained on this PC.${job.state === 'pending' ? ' Automatic retry is enabled.' : ' Please ask the invigilator for help.'}`;
        try { this.persist(job); } catch { job.message = 'Cannot update the backup receipt on disk. The saved copy has been retained; ask the invigilator for help.'; }
      }
      this.notify(job);
    }
  }
}

module.exports = { SubmissionQueue, collectSnapshot, atomicJson };
