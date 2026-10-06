import { createHash } from 'node:crypto';
import pool from '../db.js';

export function submissionDigest(files) {
  const hash = createHash('sha256');
  for (const file of [...files].sort((a, b) => a.relative_path.localeCompare(b.relative_path))) {
    hash.update(JSON.stringify([file.relative_path, file.buffer.length]));
    hash.update(file.buffer);
  }
  return hash.digest('hex');
}

export function receiptResponse(attempt) {
  return {
    status: 'success', request_id: attempt.request_id,
    submission_id: attempt.submission_id, receipt_state: attempt.state,
    file_count: attempt.manifest?.files?.length || 0,
    message: attempt.state === 'superseded'
      ? 'This copy is backed up in the cloud. A newer submission is already saved.'
      : 'Submission confirmed in Cloudinary and the database. Your backup copy is also retained.'
  };
}

export async function beginSubmissionAttempt(requestId, studentId, examId, files) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    throw Object.assign(new Error('A valid submission request ID is required.'), { status: 400 });
  }
  const digest = submissionDigest(files);
  await pool.query(`INSERT INTO submission_attempt (request_id, student_id, exam_id, content_hash)
    VALUES ($1,$2,$3,$4) ON CONFLICT (request_id) DO NOTHING`, [requestId, studentId, examId, digest]);
  const { rows } = await pool.query('SELECT * FROM submission_attempt WHERE request_id = $1', [requestId]);
  const attempt = rows[0];
  if (!attempt || String(attempt.student_id) !== String(studentId) || String(attempt.exam_id) !== String(examId) || attempt.content_hash !== digest) {
    throw Object.assign(new Error('This request ID belongs to a different submission copy.'), { status: 409 });
  }
  return attempt;
}

export async function getSubmissionReceipt(req, res) {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.requestId)) return res.status(400).json({ status: 'error', message: 'Invalid request ID.' });
  try {
    const isAdmin = req.sessionUser?.role === 'admin';
    const { rows } = await pool.query(`
      SELECT sa.*
      FROM submission_attempt sa
      JOIN student s ON s.student_id=sa.student_id
      WHERE sa.request_id=$1 AND ($2::boolean OR s.user_id=$3)
    `, [req.params.requestId, isAdmin, req.sessionUser?.sub || null]);
    if (!rows.length) return res.status(404).json({ status: 'error', message: 'Receipt not found.' });
    if (rows[0].state === 'pending') return res.status(202).json({ status: 'pending', request_id: req.params.requestId });
    res.json(receiptResponse(rows[0]));
  } catch {
    res.status(503).json({ status: 'error', message: 'Unable to check receipt. Your saved copy should be retried.' });
  }
}

export async function commitSubmissionAttempt(attempt, manifest, ipAddress, macAddress) {
  const client = await pool.connect();
  let commitAttempted = false;
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`submission:${attempt.student_id}:${attempt.exam_id}`]);
    const locked = await client.query('SELECT * FROM submission_attempt WHERE request_id = $1 FOR UPDATE', [attempt.request_id]);
    if (locked.rows[0].state !== 'pending') {
      await client.query('ROLLBACK');
      return { receipt: receiptResponse(locked.rows[0]), discardNew: true };
    }
    const current = await client.query(`SELECT submission_id, submission_attempt_id FROM student_submission
      WHERE student_id = $1 AND exam_id = $2 FOR UPDATE`, [attempt.student_id, attempt.exam_id]);
    const superseded = current.rows[0]?.submission_attempt_id && BigInt(current.rows[0].submission_attempt_id) > BigInt(attempt.attempt_id);
    let submissionId = current.rows[0]?.submission_id;
    if (!superseded) {
      const saved = await client.query(`INSERT INTO student_submission
        (student_id,exam_id,submission_path,ip_address,mac_address,submission_manifest,submission_attempt_id,submitted_at)
        VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,NOW())
        ON CONFLICT (student_id,exam_id) DO UPDATE SET submission_path=EXCLUDED.submission_path,
          ip_address=EXCLUDED.ip_address,mac_address=EXCLUDED.mac_address,submission_manifest=EXCLUDED.submission_manifest,
          submission_attempt_id=EXCLUDED.submission_attempt_id,submitted_at=NOW() RETURNING submission_id`,
      [attempt.student_id, attempt.exam_id, `cloudinary://${manifest.folder}`, ipAddress, macAddress, JSON.stringify(manifest), attempt.attempt_id]);
      submissionId = saved.rows[0].submission_id;
    }
    const updated = await client.query(`UPDATE submission_attempt SET state=$2, submission_id=$3,
      manifest=$4::jsonb, completed_at=NOW() WHERE request_id=$1 RETURNING *`,
    [attempt.request_id, superseded ? 'superseded' : 'complete', submissionId, JSON.stringify(manifest)]);
    commitAttempted = true;
    await client.query('COMMIT');
    // Each revision keeps its own cloud copy in the receipt history.
    return { receipt: receiptResponse(updated.rows[0]), discardNew: false };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (commitAttempted) error.retainAssets = true;
    throw error;
  } finally {
    client.release();
  }
}
