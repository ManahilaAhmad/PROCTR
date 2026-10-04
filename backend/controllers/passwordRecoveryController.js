import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { sendPasswordChangedEmail, sendPasswordResetEmail } from '../service/emailService.js';

const GENERIC_RESPONSE = 'If an active account matches that information, a password reset link has been sent.';
const IP_WINDOW_MS = 15 * 60 * 1000;
const IP_LIMIT = 10;
const ipRequests = new Map();

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function requestIp(req) {
  return String(req.ip || req.socket?.remoteAddress || '').slice(0, 45);
}

function isIpAllowed(ip) {
  const now = Date.now();
  const recent = (ipRequests.get(ip) || []).filter((time) => now - time < IP_WINDOW_MS);
  const allowed = recent.length < IP_LIMIT;
  if (allowed) recent.push(now);
  ipRequests.set(ip, recent);

  if (ipRequests.size > 1000) {
    for (const [key, values] of ipRequests) {
      if (!values.some((time) => now - time < IP_WINDOW_MS)) ipRequests.delete(key);
    }
  }
  return allowed;
}

async function waitForMinimumDuration(startedAt) {
  const remaining = 450 - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

async function audit(client, { userId = null, action, ip, metadata = {} }) {
  await client.query(
    `INSERT INTO password_recovery_audit (user_id,action,ip_address,metadata)
     VALUES ($1,$2,$3,$4::jsonb)`,
    [userId, action, ip || null, JSON.stringify(metadata)]
  );
}

export async function requestPasswordReset(req, res) {
  const startedAt = Date.now();
  const identifier = String(req.body?.identifier || '').trim().toLowerCase().slice(0, 255);
  const ip = requestIp(req);

  try {
    if (!identifier || !isIpAllowed(ip)) {
      await waitForMinimumDuration(startedAt);
      return res.status(200).json({ status: 'success', message: GENERIC_RESPONSE });
    }

    const userResult = await pool.query(
      `SELECT DISTINCT u.user_id,u.first_name,u.email,u.is_active
       FROM users u
       LEFT JOIN student s ON s.user_id=u.user_id
       WHERE LOWER(u.email)=$1 OR LOWER(s.registration_no)=$1
       LIMIT 1`,
      [identifier]
    );
    const user = userResult.rows[0];

    if (user?.is_active) {
      const recentResult = await pool.query(
        `SELECT COUNT(*)::int AS count FROM password_reset_token
         WHERE user_id=$1 AND created_at > NOW() - INTERVAL '15 minutes'`,
        [user.user_id]
      );

      if (recentResult.rows[0].count < 3) {
        const token = crypto.randomBytes(32).toString('hex');
        const hash = tokenHash(token);
        const configuredMinutes = Number(process.env.PASSWORD_RESET_MINUTES || 20);
        const expiresInMinutes = Number.isFinite(configuredMinutes)
          ? Math.min(Math.max(configuredMinutes, 5), 60)
          : 20;
        const client = await pool.connect();

        try {
          await client.query('BEGIN');
          await client.query(
            `UPDATE password_reset_token SET used_at=NOW()
             WHERE user_id=$1 AND used_at IS NULL`,
            [user.user_id]
          );
          await client.query(
            `INSERT INTO password_reset_token (user_id,token_hash,requested_ip,expires_at)
             VALUES ($1,$2,$3,NOW() + ($4 * INTERVAL '1 minute'))`,
            [user.user_id, hash, ip || null, expiresInMinutes]
          );
          await audit(client, { userId: user.user_id, action: 'RESET_REQUESTED', ip });
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }

        try {
          await sendPasswordResetEmail({
            to: user.email,
            firstName: user.first_name,
            token,
            expiresInMinutes,
          });
          await audit(pool, { userId: user.user_id, action: 'RESET_EMAIL_SENT', ip });
        } catch (emailError) {
          console.error('Password reset email delivery failed:', emailError.message);
          await audit(pool, {
            userId: user.user_id,
            action: 'RESET_EMAIL_FAILED',
            ip,
            metadata: { reason: emailError.code || 'delivery_error' },
          }).catch(() => {});
        }
      }
    }

    await waitForMinimumDuration(startedAt);
    return res.status(200).json({ status: 'success', message: GENERIC_RESPONSE });
  } catch (error) {
    console.error('Password reset request failed:', error);
    await waitForMinimumDuration(startedAt);
    return res.status(200).json({ status: 'success', message: GENERIC_RESPONSE });
  }
}

export async function validatePasswordResetToken(req, res) {
  const token = String(req.query?.token || '');
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(400).json({ status: 'error', valid: false, message: 'This password reset link is invalid or has expired.' });
  }

  try {
    const result = await pool.query(
      `SELECT 1
       FROM password_reset_token prt
       JOIN users u ON u.user_id=prt.user_id
       WHERE prt.token_hash=$1 AND prt.used_at IS NULL
         AND prt.expires_at > NOW() AND u.is_active=TRUE`,
      [tokenHash(token)]
    );
    if (!result.rows.length) {
      return res.status(400).json({ status: 'error', valid: false, message: 'This password reset link is invalid or has expired.' });
    }
    return res.status(200).json({ status: 'success', valid: true });
  } catch (error) {
    console.error('Password reset token validation failed:', error);
    return res.status(500).json({ status: 'error', valid: false, message: 'The reset link could not be checked right now.' });
  }
}

export async function resetPassword(req, res) {
  const token = String(req.body?.token || '');
  const newPassword = String(req.body?.new_password || '');
  const confirmPassword = String(req.body?.confirm_password || '');
  const ip = requestIp(req);

  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(400).json({ status: 'error', message: 'This password reset link is invalid or has expired.' });
  }
  if (newPassword.length < 8 || newPassword.length > 128) {
    return res.status(400).json({ status: 'error', message: 'Password must be between 8 and 128 characters.' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ status: 'error', message: 'The password confirmation does not match.' });
  }

  const client = await pool.connect();
  let user;
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT prt.reset_id,prt.user_id,u.email,u.first_name
       FROM password_reset_token prt
       JOIN users u ON u.user_id=prt.user_id
       WHERE prt.token_hash=$1 AND prt.used_at IS NULL
         AND prt.expires_at > NOW() AND u.is_active=TRUE
       FOR UPDATE OF prt`,
      [tokenHash(token)]
    );

    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ status: 'error', message: 'This password reset link is invalid or has expired.' });
    }

    user = result.rows[0];
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await client.query(
      `UPDATE users SET password_hash=$1,password_changed_at=NOW(),session_version=session_version+1
       WHERE user_id=$2`,
      [passwordHash, user.user_id]
    );
    await client.query(
      `UPDATE password_reset_token SET used_at=NOW()
       WHERE user_id=$1 AND used_at IS NULL`,
      [user.user_id]
    );
    await audit(client, { userId: user.user_id, action: 'RESET_COMPLETED', ip });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Password reset failed:', error);
    return res.status(500).json({ status: 'error', message: 'Password could not be reset right now.' });
  } finally {
    client.release();
  }

  sendPasswordChangedEmail({ to: user.email, firstName: user.first_name }).catch((error) => {
    console.error('Password change confirmation email failed:', error.message);
  });

  return res.status(200).json({ status: 'success', message: 'Your password has been reset. You can now sign in.' });
}
