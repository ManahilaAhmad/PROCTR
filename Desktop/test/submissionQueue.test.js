const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { SubmissionQueue, collectSnapshot } = require('../submissionQueue');

function setup(t, request) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proctr-queue-test-'));
  t.after(() => {
    assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('proctr-queue-test-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const workspace = path.join(root, 'work');
  fs.mkdirSync(path.join(workspace, 'Submissions', 'src'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'Submissions', 'src', 'answer.py'), 'print(42)');
  fs.writeFileSync(path.join(workspace, 'Submissions', 'empty.txt'), '');
  const opts = { directory: path.join(root, 'backups'), request, encodeToken: token => `encrypted:${token}`, decodeToken: token => token?.replace('encrypted:', ''), now: () => 1000 };
  const queue = new SubmissionQueue(opts);
  const input = { workspacePath: workspace, examId: 12, studentId: 3, apiBase: 'https://example.test/api', accessToken: 'credential', macAddress: '00:00:00:00:00:00' };
  return { root, queue, input, opts };
}
const missing = { ok: false, status: 404, body: {} };
const confirmed = id => ({ ok: true, status: 200, body: { status: 'success', request_id: id, submission_id: 9, receipt_state: 'complete', message: 'Cloud confirmed' } });

test('writes a durable independent copy before any upload and preserves nested/empty files', t => {
  let requests = 0;
  const { queue, input } = setup(t, () => requests++);
  const saved = queue.save(input);
  fs.writeFileSync(path.join(input.workspacePath, 'Submissions', 'src', 'answer.py'), 'edited later');
  const payload = JSON.parse(fs.readFileSync(saved.backupPath));
  assert.equal(Buffer.from(payload.body.files.find(file => file.relativePath === 'src/answer.py').contentBase64, 'base64').toString(), 'print(42)');
  assert.equal(payload.body.files.find(file => file.relativePath === 'empty.txt').contentBase64, '');
  assert.equal(payload.token, 'encrypted:credential');
  assert.equal(requests, 0);
});

test('rechecks receipt before upload and keeps backup after confirmation', async t => {
  const calls = [];
  const { queue, input } = setup(t, async (url, options) => { calls.push({ url, options }); return options.body ? confirmed(options.body.request_id) : missing; });
  const saved = queue.save(input);
  await queue.flush();
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /receipt/);
  assert.equal(queue.list()[0].state, 'synced');
  assert.ok(fs.existsSync(saved.backupPath));
  await queue.flush();
  assert.equal(calls.length, 2);
});

test('lost upload response recovers from receipt after process restart without resending files', async t => {
  let stored;
  const { queue, input, opts } = setup(t, async (_url, options) => {
    if (!options.body) return missing;
    stored = options.body.request_id;
    throw new Error('Connection dropped after commit');
  });
  queue.save(input); await queue.flush();
  assert.equal(queue.list()[0].state, 'pending');
  const restored = new SubmissionQueue({ ...opts, now: () => 100000, request: async (_url, options) => {
    assert.equal(options.body, undefined); return confirmed(stored);
  } });
  await restored.flush();
  assert.equal(restored.list()[0].state, 'synced');
});

test('repeated submit for unchanged files reuses the same ID', t => {
  const { queue, input } = setup(t, async () => missing);
  assert.equal(queue.save(input).requestId, queue.save(input).requestId);
  assert.equal(queue.list().length, 1);
});

test('unverified success cannot mark a job synced', async t => {
  const { queue, input } = setup(t, async () => ({ ok: true, status: 200, body: { status: 'success' } }));
  queue.save(input); await queue.flush();
  assert.equal(queue.list()[0].state, 'pending');
});

test('authentication failure retains backup and resumes only with renewed credentials', async t => {
  const { queue, input } = setup(t, async () => ({ ok: false, status: 401, body: { message: 'Sign in' } }));
  const saved = queue.save(input); await queue.flush();
  assert.equal(queue.list()[0].state, 'needs_attention');
  queue.refreshToken(999, input.apiBase, 'wrong-account');
  assert.equal(queue.list()[0].state, 'needs_attention');
  queue.refreshToken(input.studentId, input.apiBase, 'renewed');
  queue.request = async (_url, options) => { assert.equal(options.token, 'renewed'); return confirmed(saved.requestId); };
  await queue.flush(); assert.equal(queue.list()[0].state, 'synced');
});

test('failed older copy blocks a newer copy for the same exam', async t => {
  let calls = 0;
  const { queue, input } = setup(t, async () => { calls++; throw new Error('Network unavailable'); });
  queue.save(input);
  fs.writeFileSync(path.join(input.workspacePath, 'Submissions', 'src', 'answer.py'), 'new answer');
  queue.save(input);
  await queue.flush();
  assert.equal(calls, 1);
  assert.equal(queue.list().length, 2);
});

test('simultaneous flush calls do not upload a copy twice', async t => {
  let calls = 0;
  const { queue, input } = setup(t, async (_url, options) => { calls++; await new Promise(resolve => setTimeout(resolve, 10)); return options.body ? confirmed(options.body.request_id) : missing; });
  queue.save(input);
  await Promise.all([queue.flush(), queue.flush(), queue.flush()]);
  assert.equal(calls, 2);
});

test('crash between payload and metadata writes recovers saved copy', t => {
  const { queue, input, opts } = setup(t, async () => missing);
  const saved = queue.save(input);
  fs.unlinkSync(queue.metaPath(saved.requestId));
  const restored = new SubmissionQueue(opts);
  assert.equal(restored.list()[0].state, 'pending');
});

test('corrupted backup is retained and flagged instead of uploaded', t => {
  const { queue, input, opts } = setup(t, async () => { throw new Error('Must not upload'); });
  const saved = queue.save(input);
  const payload = JSON.parse(fs.readFileSync(saved.backupPath));
  payload.body.files[0].contentBase64 = 'YQ==';
  fs.writeFileSync(saved.backupPath, JSON.stringify(payload));
  const restored = new SubmissionQueue(opts);
  assert.equal(restored.list().length, 0);
  assert.equal(restored.recoveryErrors.length, 1);
  assert.ok(fs.existsSync(saved.backupPath));
});

test('missing work directory is an error, never a successful empty submission', t => {
  const { root } = setup(t, async () => missing);
  assert.throws(() => collectSnapshot(path.join(root, 'missing')), /missing/);
});

test('full disk cannot yield a saved receipt', t => {
  const { queue, input } = setup(t, async () => missing);
  t.mock.method(fs, 'writeFileSync', () => { throw Object.assign(new Error('Disk full'), { code: 'ENOSPC' }); });
  assert.throws(() => queue.save(input), /Disk full/);
  assert.equal(queue.list().length, 0);
});
