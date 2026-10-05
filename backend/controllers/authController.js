import pool from '../db.js';
import bcrypt from 'bcryptjs';
import { getFileUrl } from '../middleware/upload.js';
import {
  expiredSessionCookie,
  issueSession,
  revokeAllUserSessions,
  revokeCurrentSession,
  sessionCookie,
} from '../middleware/sessionAuth.js';
import { auditSecurityEvent, clientIp, hashIdentifier } from '../middleware/security.js';

const ALLOWED_ROLES = new Set(['student', 'teacher', 'hod', 'coordinator', 'director', 'dec', 'admin']);
const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_FAILURE_LIMIT = 5;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('PROCTR-invalid-password-placeholder', 12);

async function recordLoginAttempt(identifierHash, ip, succeeded) {
  await pool.query(
    `INSERT INTO authentication_attempt (identifier_hash,ip_address,succeeded) VALUES ($1,$2,$3)`,
    [identifierHash, ip || 'unknown', succeeded]
  );
}

async function loginIsLocked(identifierHash, ip) {
  const result = await pool.query(`
    SELECT COUNT(*)::int AS failures
    FROM authentication_attempt
    WHERE identifier_hash=$1 AND ip_address=$2 AND succeeded=FALSE
      AND attempted_at > NOW() - ($3 * INTERVAL '1 minute')
  `, [identifierHash, ip || 'unknown', LOGIN_WINDOW_MINUTES]);
  return result.rows[0].failures >= LOGIN_FAILURE_LIMIT;
}

/* ===========================================================
   LOGIN
=========================================================== */
export const login = async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user_type = String(req.body?.user_type || '').trim().toLowerCase();
  const identifierHash = hashIdentifier(`${user_type}:${email}`);
  const ip = clientIp(req);
  try {
    if (!email || !password || !ALLOWED_ROLES.has(user_type) || email.length > 255 || password.length > 128) {
      return res.status(400).json({ status: 'error', message: 'All fields are required.' });
    }

    if (await loginIsLocked(identifierHash, ip)) {
      await auditSecurityEvent(req, { eventType: 'LOGIN_LOCKED', outcome: 'DENIED', metadata: { role: user_type } });
      return res.status(429).json({ status: 'error', message: 'Too many unsuccessful login attempts. Please wait 15 minutes and try again.' });
    }

    let result;
    if (user_type === 'student') {
      result = await pool.query(
        `SELECT u.user_id, u.first_name, u.last_name, u.email, u.password_hash, u.user_type, u.is_active, u.profile_picture_url, u.session_version
         FROM users u 
         LEFT JOIN student s ON u.user_id = s.user_id 
         WHERE (u.email = $1 OR s.registration_no = $1) AND u.user_type = $2`,
        [email, user_type]
      );
    } else {
      result = await pool.query(
        'SELECT user_id, first_name, last_name, email, password_hash, user_type, is_active, profile_picture_url, session_version FROM users WHERE email = $1 AND user_type = $2',
        [email, user_type]
      );
    }

    if (result.rows.length === 0) {
      // Keep the response timing close to a real account lookup so attackers
      // cannot reliably enumerate registered email addresses.
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      await recordLoginAttempt(identifierHash, ip, false);
      await auditSecurityEvent(req, { eventType: 'LOGIN_FAILED', outcome: 'DENIED', metadata: { role: user_type } });
      return res.status(401).json({ status: 'error', message: 'Invalid credentials or user role.' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      await recordLoginAttempt(identifierHash, ip, false);
      await auditSecurityEvent(req, { eventType: 'LOGIN_DISABLED_ACCOUNT', outcome: 'DENIED', userId: user.user_id });
      return res.status(403).json({ status: 'error', message: 'Invalid credentials or account unavailable.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      await recordLoginAttempt(identifierHash, ip, false);
      await auditSecurityEvent(req, { eventType: 'LOGIN_FAILED', outcome: 'DENIED', userId: user.user_id, metadata: { role: user_type } });
      return res.status(401).json({ status: 'error', message: 'Invalid credentials or user role.' });
    }

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE user_id = $1', [user.user_id]);

    let extra = {};

    if (user_type === 'teacher') {
      const r = await pool.query(
        `SELECT t.teacher_id, d.department_name, d.department_code, t.designation
         FROM teacher t
         JOIN department d ON t.department_id = d.department_id
         WHERE t.user_id = $1`, [user.user_id]
      );
      if (r.rows.length) {
        extra = {
          teacherId: r.rows[0].teacher_id,
          departmentName: r.rows[0].department_name,
          departmentCode: r.rows[0].department_code,
          designation: r.rows[0].designation,
        };
      }
    }

    if (user_type === 'student') {
      const r = await pool.query(
        `SELECT s.student_id, s.registration_no, s.current_semester, s.status,
                b.batch_name, p.program_name, d.department_name
         FROM student s
         JOIN batch b ON s.batch_id = b.batch_id
         JOIN program p ON b.program_id = p.program_id
         JOIN department d ON p.department_id = d.department_id
         WHERE s.user_id = $1`, [user.user_id]
      );
      if (r.rows.length) {
        extra = {
          studentId: r.rows[0].student_id,
          rollNo: r.rows[0].registration_no,
          currentSemester: r.rows[0].current_semester,
          batchName: r.rows[0].batch_name,
          programName: r.rows[0].program_name,
          departmentName: r.rows[0].department_name,
        };
      }
    }

    if (user_type === 'hod') {
      const r = await pool.query(
        `SELECT h.hod_id, d.department_name, d.department_code
         FROM hod h
         JOIN department d ON h.department_id = d.department_id
         WHERE h.user_id = $1`, [user.user_id]
      );
      if (r.rows.length) {
        extra = {
          hodId: r.rows[0].hod_id,
          departmentName: r.rows[0].department_name,
          departmentCode: r.rows[0].department_code,
        };
      }
    }

    if (user_type === 'coordinator') {
      const r = await pool.query(
        `SELECT c.coordinator_id, d.department_name, d.department_code
         FROM coordinator c
         JOIN department d ON c.department_id = d.department_id
         WHERE c.user_id = $1`, [user.user_id]
      );
      if (r.rows.length) {
        extra = {
          coordinatorId: r.rows[0].coordinator_id,
          departmentName: r.rows[0].department_name,
          departmentCode: r.rows[0].department_code,
        };
      }
    }

    if (user_type === 'dec') {
      const r = await pool.query(
        `SELECT dm.dec_member_id, dm.role, d.department_name, d.department_code
         FROM dec_member dm
         JOIN department d ON dm.department_id = d.department_id
         WHERE dm.user_id = $1`, [user.user_id]
      );
      if (r.rows.length) {
        extra = {
          decMemberId: r.rows[0].dec_member_id,
          decRole: r.rows[0].role,
          departmentName: r.rows[0].department_name,
          departmentCode: r.rows[0].department_code,
        };
      }
    }

    if (user_type === 'director') {
      const r = await pool.query(
        'SELECT director_id, designation FROM director WHERE user_id = $1', [user.user_id]
      );
      if (r.rows.length) {
        extra = {
          directorId: r.rows[0].director_id,
          designation: r.rows[0].designation,
        };
      }
    }

    const clientType = req.get('x-proctr-client') === 'desktop' ? 'desktop' : 'web';
    let sessionToken;
    try {
      sessionToken = await issueSession(user, req, clientType);
    } catch (tokenError) {
      console.error('Could not issue security session:', tokenError.message);
      return res.status(503).json({ status: 'error', message: 'Secure login is unavailable. Run the security migration and check the server session configuration.' });
    }

    await recordLoginAttempt(identifierHash, ip, true);
    await auditSecurityEvent(req, { eventType: 'LOGIN_SUCCEEDED', outcome: 'SUCCESS', userId: user.user_id, metadata: { role: user_type, clientType } });
    if (clientType === 'web') res.setHeader('Set-Cookie', sessionCookie(sessionToken));

    res.status(200).json({
      status: 'success',
      user: {
        userId: user.user_id,
        firstName: user.first_name,
        lastName: user.last_name,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        userType: user.user_type,
        profilePictureUrl: user.profile_picture_url,
        sessionToken: clientType === 'desktop' ? sessionToken : undefined,
        ...extra,
      }
    });
  } catch (error) {
    console.error('Login API error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

/* ===========================================================
   CHANGE PASSWORD
=========================================================== */
export const changePassword = async (req, res) => {
  const { user_id, current_password, new_password } = req.body;
  try {
    if (!user_id || !current_password || !new_password) {
      return res.status(400).json({ status: 'error', message: 'All fields are required.' });
    }
    if (new_password.length < 8 || new_password.length > 128) {
      return res.status(400).json({ status: 'error', message: 'New password must be between 8 and 128 characters.' });
    }
    const userResult = await pool.query('SELECT password_hash FROM users WHERE user_id = $1', [user_id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }
    const isMatch = await bcrypt.compare(current_password, userResult.rows[0].password_hash);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Current password is incorrect.' });
    }
    const newHash = await bcrypt.hash(new_password, 12);
    await pool.query(
      'UPDATE users SET password_hash=$1,password_changed_at=NOW(),session_version=session_version+1 WHERE user_id=$2',
      [newHash, user_id]
    );
    await revokeAllUserSessions(user_id, 'PASSWORD_CHANGED');
    await auditSecurityEvent(req, { eventType: 'PASSWORD_CHANGED', outcome: 'SUCCESS', userId: user_id });
    res.setHeader('Set-Cookie', expiredSessionCookie());
    res.status(200).json({ status: 'success', message: 'Password updated successfully. Please sign in again.', requiresReauthentication: true });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update password.' });
  }
};

export const logout = async (req, res) => {
  try {
    await revokeCurrentSession(req);
    await auditSecurityEvent(req, { eventType: 'LOGOUT', outcome: 'SUCCESS' });
    res.setHeader('Set-Cookie', expiredSessionCookie());
    return res.status(200).json({ status: 'success', message: 'Signed out securely.' });
  } catch (error) {
    console.error('Logout failed:', error);
    return res.status(500).json({ status: 'error', message: 'Could not complete logout.' });
  }
};

export const sessionStatus = async (req, res) => {
  res.status(200).json({
    status: 'success',
    session: {
      userId: Number(req.sessionUser.sub),
      userType: req.sessionUser.role,
      expiresAt: new Date(req.sessionUser.exp * 1000).toISOString(),
    },
  });
};

/* ===========================================================
   UPDATE PROFILE PICTURE (Multer Image Upload)
=========================================================== */
export const updateProfilePicture = async (req, res) => {
  const user_id = req.sessionUser?.sub;
  try {
    if (!user_id) {
      return res.status(400).json({ status: 'error', message: 'user_id is required.' });
    }
    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'No file uploaded.' });
    }

    const fileUrl = getFileUrl(req, req.file);

    // Ensure profile_picture_url column exists on users table
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url TEXT NULL');

    await pool.query('UPDATE users SET profile_picture_url = $1 WHERE user_id = $2', [fileUrl, user_id]);

    res.status(200).json({
      status: 'success',
      message: 'Profile picture updated successfully.',
      profilePictureUrl: fileUrl,
    });
  } catch (error) {
    console.error('Error updating profile picture:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update profile picture.' });
  }
};
