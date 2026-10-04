import crypto from 'node:crypto';
import pool from '../db.js';

const TOKEN_LIFETIME_SECONDS = 8 * 60 * 60;
const developmentSecret = crypto.randomBytes(32).toString('hex');

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV !== 'production') return developmentSecret;
    throw new Error('SESSION_SECRET must be configured with at least 32 characters.');
  }
  return secret;
}

function encode(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(value) {
  return crypto.createHmac('sha256', getSecret()).update(value).digest('base64url');
}

export function createSessionToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = encode(JSON.stringify({
    sub: user.user_id,
    role: user.user_type,
    ver: Number(user.session_version || 0),
    iat: now,
    exp: now + TOKEN_LIFETIME_SECONDS,
  }));
  return `${payload}.${sign(payload)}`;
}

export async function requireSession(req, res, next) {
  try {
    const authorization = req.get('authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const [payload, signature] = token.split('.');
    if (!payload || !signature) throw new Error('Missing token');
    const expected = sign(payload);
    const validSignature = signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!validSignature) throw new Error('Invalid token');
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!session.sub || !session.role || session.exp <= Math.floor(Date.now() / 1000)) throw new Error('Expired token');
    const userResult = await pool.query('SELECT user_type,is_active,session_version FROM users WHERE user_id=$1', [session.sub]);
    const currentUser = userResult.rows[0];
    if (!currentUser || !currentUser.is_active || currentUser.user_type !== session.role || Number(currentUser.session_version) !== Number(session.ver || 0)) {
      throw new Error('Inactive session');
    }
    req.sessionUser = session;
    next();
  } catch {
    res.status(401).json({ status: 'error', message: 'A valid login session is required.' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.sessionUser || !roles.includes(req.sessionUser.role)) {
      return res.status(403).json({ status: 'error', message: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

export function requireSelfParam(paramName = 'userId', ...bypassRoles) {
  return (req, res, next) => {
    if (bypassRoles.includes(req.sessionUser?.role) || String(req.params[paramName]) === String(req.sessionUser?.sub)) {
      return next();
    }
    return res.status(403).json({ status: 'error', message: 'You may only access your own account.' });
  };
}

export function requireSelfBody(fieldName = 'user_id', ...bypassRoles) {
  return (req, res, next) => {
    const requestedUserId = req.body?.[fieldName];
    if (bypassRoles.includes(req.sessionUser?.role) || String(requestedUserId) === String(req.sessionUser?.sub)) {
      return next();
    }
    return res.status(403).json({ status: 'error', message: 'You may only change your own account.' });
  };
}

function requireOwnedProfile(tableName, idColumn, paramName, allowedRoles) {
  return async (req, res, next) => {
    try {
      if (req.sessionUser?.role === 'admin') return next();
      if (!allowedRoles.includes(req.sessionUser?.role)) {
        return res.status(403).json({ status: 'error', message: 'You do not have permission to access this resource.' });
      }
      const result = await pool.query(
        `SELECT 1 FROM ${tableName} WHERE ${idColumn}=$1 AND user_id=$2`,
        [req.params[paramName], req.sessionUser.sub],
      );
      if (!result.rowCount) {
        return res.status(403).json({ status: 'error', message: 'This resource does not belong to your account.' });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export const requireOwnTeacherProfile = (paramName = 'teacherId') =>
  requireOwnedProfile('teacher', 'teacher_id', paramName, ['teacher', 'hod', 'dec']);

export const requireOwnStudentProfile = (paramName = 'studentId') =>
  requireOwnedProfile('student', 'student_id', paramName, ['student']);

function requireOwnedProfileBody(tableName, idColumn, fieldName, allowedRoles) {
  return async (req, res, next) => {
    try {
      if (req.sessionUser?.role === 'admin') return next();
      if (!allowedRoles.includes(req.sessionUser?.role)) {
        return res.status(403).json({ status: 'error', message: 'You do not have permission to access this resource.' });
      }
      const result = await pool.query(
        `SELECT 1 FROM ${tableName} WHERE ${idColumn}=$1 AND user_id=$2`,
        [req.body?.[fieldName], req.sessionUser.sub],
      );
      if (!result.rowCount) {
        return res.status(403).json({ status: 'error', message: 'This resource does not belong to your account.' });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export const requireOwnTeacherBodyProfile = (fieldName = 'teacher_id') =>
  requireOwnedProfileBody('teacher', 'teacher_id', fieldName, ['teacher', 'hod', 'dec']);

export const requireOwnStudentBodyProfile = (fieldName = 'student_id') =>
  requireOwnedProfileBody('student', 'student_id', fieldName, ['student']);
