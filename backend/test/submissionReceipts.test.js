import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

let state;
const client = {
  async query(sql, params) {
    state.sql.push(sql);
    if (/SELECT \* FROM submission_attempt/.test(sql)) return { rows: [state.attempt] };
    if (/SELECT submission_id/.test(sql)) return { rows: state.current ? [state.current] : [] };
    if (/INSERT INTO student_submission/.test(sql)) {
      if (state.writeError) throw new Error('Write failed');
      return { rows: [{ submission_id: 7 }] };
    }
    if (/UPDATE submission_attempt/.test(sql)) return { rows: [{ ...state.attempt, state: params[1], submission_id: params[2], manifest: JSON.parse(params[3]) }] };
    if (sql === 'COMMIT' && state.commitError) throw new Error('Connection lost during commit');
    return { rows: [] };
  },
  release() { state.released = true; }
};
mock.module('../db.js', { defaultExport: {
  connect: async () => client,
  async query(sql) {
    state.sql.push(sql);
    return { rows: /SELECT/.test(sql) ? [state.attempt] : [] };
  }
} });
const { submissionDigest, beginSubmissionAttempt, commitSubmissionAttempt, receiptResponse, getSubmissionReceipt } = await import('../service/submissionReceipts.js');
const files = [{ relative_path: 'main.py', buffer: Buffer.from('print(42)') }];
const manifest = { provider: 'cloudinary', folder: 'attempt', files: [{ relative_path: 'main.py', file_size: 9 }] };
beforeEach(() => {
  state = { sql: [], attempt: { request_id: '5914f48a-80b3-4dc0-97b8-912e48179081', attempt_id: '12', student_id: 1, exam_id: 2, state: 'pending', content_hash: submissionDigest(files) } };
});

test('digest is order-independent and detects filename and content changes', () => {
  const a = { relative_path: 'a', buffer: Buffer.from('same') };
  const b = { relative_path: 'b', buffer: Buffer.from('different') };
  assert.equal(submissionDigest([a, b]), submissionDigest([b, a]));
  assert.notEqual(submissionDigest([a]), submissionDigest([{ ...a, relative_path: 'b' }]));
  assert.notEqual(submissionDigest([a]), submissionDigest([{ ...a, buffer: Buffer.from('new') }]));
});
test('retries reuse their registered attempt', async () => {
  assert.equal((await beginSubmissionAttempt(state.attempt.request_id, 1, 2, files)).attempt_id, '12');
  assert.match(state.sql[0], /ON CONFLICT.*DO NOTHING/);
});
test('same request ID cannot be reused for another file copy or owner', async () => {
  await assert.rejects(beginSubmissionAttempt(state.attempt.request_id, 3, 2, files), { status: 409 });
  await assert.rejects(beginSubmissionAttempt(state.attempt.request_id, 1, 2, []), { status: 409 });
});
test('invalid request IDs fail before database writes', async () => {
  await assert.rejects(beginSubmissionAttempt('bad', 1, 2, files), { status: 400 });
  assert.equal(state.sql.length, 0);
});
test('receipt and latest submission are committed together', async () => {
  const result = await commitSubmissionAttempt(state.attempt, manifest, '127.0.0.1', '00:00:00:00:00:00');
  assert.equal(result.receipt.receipt_state, 'complete');
  assert.equal(result.discardNew, false);
  assert.ok(state.sql.find(sql => sql.includes('pg_advisory_xact_lock')));
  assert.equal(state.sql.at(-1), 'COMMIT');
  assert.equal(state.released, true);
});
test('concurrent duplicate uses existing receipt without replacing files', async () => {
  state.attempt.state = 'complete'; state.attempt.submission_id = 8; state.attempt.manifest = manifest;
  const result = await commitSubmissionAttempt(state.attempt, manifest, '', '');
  assert.equal(result.discardNew, true);
  assert.equal(result.receipt.submission_id, 8);
  assert.ok(!state.sql.some(sql => sql.includes('INSERT INTO student_submission')));
});
test('late older attempt retains cloud backup without replacing newer submitted work', async () => {
  state.current = { submission_id: 8, submission_attempt_id: '13' };
  const result = await commitSubmissionAttempt(state.attempt, manifest, '', '');
  assert.equal(result.receipt.receipt_state, 'superseded');
  assert.equal(result.discardNew, false);
  assert.ok(!state.sql.some(sql => sql.includes('INSERT INTO student_submission')));
});
test('failed database write rolls back and releases connection', async () => {
  state.writeError = true;
  await assert.rejects(commitSubmissionAttempt(state.attempt, manifest, '', ''), /Write failed/);
  assert.equal(state.sql.at(-1), 'ROLLBACK'); assert.ok(state.released);
});
test('uncertain commit protects possibly referenced cloud files', async () => {
  state.commitError = true;
  await assert.rejects(commitSubmissionAttempt(state.attempt, manifest, '', ''), error => error.retainAssets === true);
  assert.ok(state.released);
});
test('pending receipt is not a success confirmation', async () => {
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await getSubmissionReceipt({ params: { requestId: state.attempt.request_id }, auth: { student_id: 1 } }, res);
  assert.equal(res.code, 202); assert.equal(res.body.status, 'pending');
});
test('public receipts never expose cloud identifiers or credential data', () => {
  const response = receiptResponse({ ...state.attempt, state: 'complete', submission_id: 7, manifest });
  assert.equal(response.request_id, state.attempt.request_id);
  assert.equal(response.manifest, undefined);
  assert.equal(response.content_hash, undefined);
});
