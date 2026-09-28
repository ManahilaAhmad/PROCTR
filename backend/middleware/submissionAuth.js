import { createHash, randomBytes } from 'node:crypto';
import pool from '../db.js';

const digest = token => createHash('sha256').update(token).digest('hex');

export async function issueSubmissionToken(userId) {
  const token = randomBytes(32).toString('hex');
  await pool.query(`INSERT INTO submission_access_session (token_hash, user_id, expires_at)
    VALUES ($1, $2, NOW() + INTERVAL '30 days')`, [digest(token), userId]);
  return token;
}

export async function authenticateSubmission(req, res, next) {
  const token = req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/i)?.[1];
  if (!token) return res.status(401).json({ status: 'error', message: 'Please sign in again to access submissions.' });
  try {
    const { rows } = await pool.query(`SELECT u.user_id, u.user_type, s.student_id, t.teacher_id
      FROM submission_access_session a JOIN users u ON u.user_id = a.user_id
      LEFT JOIN student s ON s.user_id = u.user_id LEFT JOIN teacher t ON t.user_id = u.user_id
      WHERE a.token_hash = $1 AND a.expires_at > NOW() AND u.is_active = TRUE`, [digest(token)]);
    if (!rows.length) return res.status(401).json({ status: 'error', message: 'Session expired. Sign in again; your backup is retained.' });
    req.auth = rows[0];
    const teacher = req.auth.user_type === 'teacher' && req.auth.teacher_id;
    const student = req.auth.user_type === 'student' && req.auth.student_id;
    if ((!teacher && !student) || (req.path.startsWith('/teacher/') && !teacher) ||
        ((req.path.startsWith('/student/') || req.path.startsWith('/receipt/') || req.path === '/upload') && !student)) {
      return res.status(403).json({ status: 'error', message: 'You do not have access to these submissions.' });
    }
    if (req.path === '/upload' && String(req.body.student_id) !== String(student)) {
      return res.status(403).json({ status: 'error', message: 'Submission does not belong to the signed-in student.' });
    }
    if (req.path === '/upload') {
      if (!req.body.request_id) return res.status(400).json({ status: 'error', message: 'Please update the desktop app: a submission request ID is required.' });
      const joined = await pool.query('SELECT 1 FROM desktop_exam_session WHERE student_id = $1 AND exam_id = $2 LIMIT 1', [student, req.body.exam_id]);
      if (!joined.rows.length) return res.status(403).json({ status: 'error', message: 'You have not joined this exam.' });
    }
    // Download ownership comes from the authenticated account, never query IDs.
    delete req.query.studentId;
    delete req.query.teacherId;
    if (student) req.query.studentId = String(student);
    if (teacher) req.query.teacherId = String(teacher);
    next();
  } catch {
    res.status(503).json({ status: 'error', message: 'Unable to verify your account. Please retry.' });
  }
}

export function checkSubmissionOwner(req, res, next, value, name) {
  const expected = name === 'teacherId' ? req.auth.teacher_id : req.auth.student_id;
  // A teacher's student detail route intentionally names a different account.
  if (name === 'studentId' && req.path.startsWith('/teacher/')) return next();
  if (String(value) !== String(expected)) return res.status(403).json({ status: 'error', message: 'Access denied.' });
  next();
}
