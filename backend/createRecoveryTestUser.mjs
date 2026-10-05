import bcrypt from 'bcryptjs';
import pool from './db.js';

const email = process.env.TEST_USER_EMAIL?.trim().toLowerCase();
const password = process.env.TEST_USER_PASSWORD;
const firstName = process.env.TEST_USER_FIRST_NAME?.trim() || 'Recovery';
const lastName = process.env.TEST_USER_LAST_NAME?.trim() || 'Test';
const departmentCode = process.env.TEST_DEPARTMENT_CODE?.trim();

if (!email || !password || password.length < 8) {
  console.error('Set TEST_USER_EMAIL and a TEST_USER_PASSWORD of at least 8 characters.');
  process.exitCode = 1;
} else {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT user_id,user_type FROM users WHERE LOWER(email)=$1', [email]);
    let userId;

    if (existing.rows.length) {
      if (existing.rows[0].user_type !== 'teacher') {
        throw new Error(`The email already belongs to a ${existing.rows[0].user_type} account.`);
      }
      userId = existing.rows[0].user_id;
      const passwordHash = await bcrypt.hash(password, 12);
      await client.query(
        `UPDATE users SET first_name=$1,last_name=$2,password_hash=$3,is_active=TRUE,
         password_changed_at=NOW(),session_version=session_version+1 WHERE user_id=$4`,
        [firstName, lastName, passwordHash, userId]
      );
    } else {
      const passwordHash = await bcrypt.hash(password, 12);
      const inserted = await client.query(
        `INSERT INTO users (first_name,last_name,email,password_hash,user_type,is_active)
         VALUES ($1,$2,$3,$4,'teacher',TRUE) RETURNING user_id`,
        [firstName, lastName, email, passwordHash]
      );
      userId = inserted.rows[0].user_id;
    }

    const department = departmentCode
      ? await client.query('SELECT department_id FROM department WHERE department_code=$1 LIMIT 1', [departmentCode])
      : await client.query('SELECT department_id FROM department ORDER BY department_id LIMIT 1');
    if (!department.rows.length) throw new Error('No department exists. Seed academic data before creating this test user.');

    const teacher = await client.query('SELECT teacher_id FROM teacher WHERE user_id=$1 LIMIT 1', [userId]);
    if (!teacher.rows.length) {
      await client.query(
        `INSERT INTO teacher (user_id,department_id,designation)
         VALUES ($1,$2,'Password Recovery Test User')`,
        [userId, department.rows[0].department_id]
      );
    }

    await client.query('COMMIT');
    console.log(`Recovery test teacher is ready: ${email}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Could not create the recovery test user:');
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}
