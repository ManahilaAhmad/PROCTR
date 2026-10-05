import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
let account, queries;
mock.module('../db.js', { defaultExport: { async query(sql, params) {
  queries.push({ sql, params });
  return { rows: sql.includes('desktop_exam_session') ? [{ present: 1 }] : account ? [account] : [] };
} } });
const { authenticateSubmission, checkSubmissionOwner, issueSubmissionToken } = await import('../middleware/submissionAuth.js');
beforeEach(() => { account = { user_id: 1, user_type: 'student', student_id: 12 }; queries = []; });
function res() { return { status(code) { this.code = code; return this; }, json(body) { this.body = body; } }; }
const request = (extra = {}) => ({ headers: { authorization: `Bearer ${'a'.repeat(64)}` }, path: '/file/1', query: {}, body: {}, ...extra });
test('missing credential fails without trusting a claimed student ID', async () => {
  const response = res(); await authenticateSubmission(request({ headers: {}, query: { studentId: 12 } }), response, () => assert.fail());
  assert.equal(response.code, 401); assert.equal(queries.length, 0);
});
test('download ownership is replaced with authenticated identity', async () => {
  const req = request({ query: { studentId: 999, teacherId: 999 } }); let next = false;
  await authenticateSubmission(req, res(), () => { next = true; });
  assert.ok(next); assert.deepEqual(req.query, { studentId: '12' });
});
test('student cannot access teacher routes or submit another student work', async () => {
  for (const req of [request({ path: '/teacher/1/labs' }), request({ path: '/upload', body: { student_id: 99 } })]) {
    const response = res(); await authenticateSubmission(req, response, () => assert.fail()); assert.equal(response.code, 403);
  }
});
test('expired session requires sign-in again', async () => {
  account = null; const response = res(); await authenticateSubmission(request(), response, () => assert.fail()); assert.equal(response.code, 401);
});
test('route owner must match signed-in account', () => {
  const response = res(); checkSubmissionOwner({ auth: { teacher_id: 3 }, path: '/teacher/4/labs' }, response, () => assert.fail(), '4', 'teacherId');
  assert.equal(response.code, 403);
});
test('teacher can request a student within their own lab route', () => {
  let next = false; checkSubmissionOwner({ auth: { teacher_id: 3 }, path: '/teacher/3/lab/1/student/4/files' }, res(), () => { next = true; }, '4', 'studentId');
  assert.ok(next);
});
test('access tokens are random and only their hashes are stored', async () => {
  const one = await issueSubmissionToken(1), two = await issueSubmissionToken(1);
  assert.match(one, /^[a-f0-9]{64}$/); assert.notEqual(one, two); assert.notEqual(queries[0].params[0], one);
});
