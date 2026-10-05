import pool from '../db.js';

// Additive and safe for existing installations. File contents live only in
// Cloudinary; JSONB stores the relative paths, sizes, and cloud asset IDs.
export async function ensureSubmissionSchema() {
  await pool.query('ALTER TABLE student_submission ADD COLUMN IF NOT EXISTS submission_manifest JSONB');
  await pool.query('ALTER TABLE student_submission ADD COLUMN IF NOT EXISTS submission_attempt_id BIGINT');
  await pool.query(`CREATE TABLE IF NOT EXISTS submission_attempt (
    request_id UUID PRIMARY KEY, attempt_id BIGSERIAL UNIQUE NOT NULL,
    student_id INT NOT NULL REFERENCES student(student_id), exam_id INT NOT NULL REFERENCES exam(exam_id),
    content_hash TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','complete','superseded')),
    submission_id INT, manifest JSONB, received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), completed_at TIMESTAMPTZ
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS submission_access_session (
    token_hash TEXT PRIMARY KEY, user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
  )`);
}
