import bcrypt from 'bcryptjs';
import pool from './db.js';

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const firstName = process.env.ADMIN_FIRST_NAME?.trim() || 'System';
const lastName = process.env.ADMIN_LAST_NAME?.trim() || 'Admin';
const allowWeakPassword = process.env.ADMIN_ALLOW_WEAK_PASSWORD === 'true';
const minimumPasswordLength = allowWeakPassword ? 1 : 12;

if (!email || !password || password.length < minimumPasswordLength) {
  console.error(`Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least ${minimumPasswordLength} characters before running this command.`);
  process.exitCode = 1;
} else {
  if (allowWeakPassword) console.warn('WARNING: Weak Admin password protection is disabled for this testing run.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const passwordHash = await bcrypt.hash(password, 12);
    const userResult = await client.query(`
      INSERT INTO users (first_name,last_name,email,password_hash,user_type,is_active)
      VALUES ($1,$2,$3,$4,'admin',TRUE)
      ON CONFLICT (email) DO UPDATE SET first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,
        password_hash=EXCLUDED.password_hash,user_type='admin',is_active=TRUE
      RETURNING user_id,email
    `, [firstName, lastName, email, passwordHash]);
    await client.query(`INSERT INTO admin (user_id,is_super_admin) VALUES ($1,TRUE) ON CONFLICT (user_id) DO UPDATE SET is_super_admin=TRUE`, [userResult.rows[0].user_id]);
    await client.query('COMMIT');
    console.log(`Admin account is ready: ${userResult.rows[0].email}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Could not create Admin. Run Database/migrations/001_admin_foundation.sql first.');
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}
