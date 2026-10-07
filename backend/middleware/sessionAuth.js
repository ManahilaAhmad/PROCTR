import crypto from 'node:crypto';
import pool from '../db.js';
import { auditSecurityEvent, clientIp } from './security.js';

const configuredLifetime = Number.parseInt(process.env.SESSION_LIFETIME_MINUTES || '480', 10);
const TOKEN_LIFETIME_SECONDS = Math.min(12 * 60 * 60, Math.max(15 * 60, (Number.isFinite(configuredLifetime) ? configuredLifetime : 480) * 60));
const developmentSecret = crypto.randomBytes(32).toString('hex');
const SESSION_COOKIE_PRODUCTION = '__Host-proctr_session';
const SESSION_COOKIE_DEVELOPMENT = 'proctr_session';

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

function tokenHash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function parseCookies(header = '') {
  return Object.fromEntries(String(header).split(';').map(part => {
    const index = part.indexOf('=');
    if (index < 0) return null;
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(Boolean));
}

export function getSessionCookieName() {
  return process.env.NODE_ENV === 'production' ? SESSION_COOKIE_PRODUCTION : SESSION_COOKIE_DEVELOPMENT;
}

export function sessionCookie(token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${getSessionCookieName()}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${TOKEN_LIFETIME_SECONDS}${secure}`;
}

export function expiredSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${getSessionCookieName()}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export function extractSessionToken(req) {
  const authorization = req.get?.('authorization') || '';
  if (authorization.startsWith('Bearer ')) return authorization.slice(7).trim();
  return parseCookies(req.headers?.cookie)[getSessionCookieName()] || '';
}

export function createSessionToken(user, sessionId) {
  const now = Math.floor(Date.now() / 1000);
  const payload = encode(JSON.stringify({
    sub: user.user_id,
    role: user.user_type,
    ver: Number(user.session_version || 0),
    sid: sessionId,
    iat: now,
    exp: now + TOKEN_LIFETIME_SECONDS,
  }));
  return `${payload}.${sign(payload)}`;
}

export async function issueSession(user, req, clientType = 'web') {
  const sessionId = crypto.randomUUID();
  const token = createSessionToken(user, sessionId);
  const ip = clientIp(req);
  await pool.query(`
    INSERT INTO security_session
      (session_id,user_id,token_hash,client_type,user_agent,created_ip,last_ip,expires_at)
    VALUES ($1,$2,$3,$4,$5,$6,$6,NOW() + ($7 * INTERVAL '1 second'))
  `, [
    sessionId,
    user.user_id,
    tokenHash(token),
    clientType === 'desktop' ? 'desktop' : 'web',
    String(req.get('user-agent') || '').slice(0, 500) || null,
    ip || null,
    TOKEN_LIFETIME_SECONDS,
  ]);
  return token;
}

function decodeAndVerifyToken(token) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) throw new Error('Missing token');
  const expected = sign(payload);
  const suppliedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    throw new Error('Invalid token');
  }
  const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!session.sub || !session.role || !session.sid || session.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('Expired token');
  }
  return session;
}

export async function validateSessionToken(token, requestContext = null) {
  const session = decodeAndVerifyToken(token);
  const result = await pool.query(`
    SELECT u.user_type,u.is_active,u.session_version,
           ss.revoked_at,ss.expires_at,ss.token_hash,ss.last_ip,ss.user_agent,ss.client_type
    FROM security_session ss
    JOIN users u ON u.user_id=ss.user_id
    WHERE ss.session_id=$1 AND ss.user_id=$2
  `, [session.sid, session.sub]);
  const current = result.rows[0];
  if (!current || current.revoked_at || new Date(current.expires_at).getTime() <= Date.now()
      || current.token_hash !== tokenHash(token) || !current.is_active
      || current.user_type !== session.role || Number(current.session_version) !== Number(session.ver || 0)) {
    throw new Error('Inactive session');
  }

  if (requestContext) {
    const ip = clientIp(requestContext);
    const currentUserAgent = String(requestContext.get?.('user-agent') || '').slice(0, 500) || null;
    // Electron's main-process submission queue uses Node's user-agent, not the
    // renderer user-agent captured at desktop login. The signed session token
    // still authenticates that request, so only browser sessions bind to UA.
    if (current.client_type !== 'desktop' && process.env.STRICT_SESSION_USER_AGENT !== 'false'
        && current.user_agent && currentUserAgent && current.user_agent !== currentUserAgent) {
      await pool.query(`UPDATE security_session SET revoked_at=NOW(),revoke_reason='USER_AGENT_CHANGED' WHERE session_id=$1`, [session.sid]);
      throw new Error('Session client changed');
    }
    if (process.env.STRICT_SESSION_IP === 'true' && current.last_ip && ip && current.last_ip !== ip) {
      await pool.query(`UPDATE security_session SET revoked_at=NOW(),revoke_reason='IP_CHANGED' WHERE session_id=$1`, [session.sid]);
      throw new Error('Session network changed');
    }
    await pool.query(`
      UPDATE security_session SET last_seen_at=NOW(),last_ip=$2
      WHERE session_id=$1 AND last_seen_at < NOW() - INTERVAL '1 minute'
    `, [session.sid, ip || null]).catch(() => {});
  }
  return session;
}

export async function requireSession(req, res, next) {
  try {
    const token = extractSessionToken(req);
    req.sessionUser = await validateSessionToken(token, req);
    req.sessionToken = token;
    next();
  } catch (error) {
    auditSecurityEvent(req, {
      eventType: 'AUTHENTICATION_REQUIRED',
      outcome: 'DENIED',
      metadata: { reason: error.message },
    }).catch(() => {});
    res.status(401).json({ status: 'error', message: 'A valid login session is required.' });
  }
}

export async function revokeCurrentSession(req) {
  if (!req.sessionUser?.sid) return;
  await pool.query(`UPDATE security_session SET revoked_at=NOW(),revoke_reason='LOGOUT' WHERE session_id=$1`, [req.sessionUser.sid]);
}

export async function revokeAllUserSessions(userId, reason = 'SECURITY_CHANGE') {
  await pool.query(`UPDATE security_session SET revoked_at=NOW(),revoke_reason=$2 WHERE user_id=$1 AND revoked_at IS NULL`, [userId, reason]);
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.sessionUser || !roles.includes(req.sessionUser.role)) {
      auditSecurityEvent(req, { eventType: 'ROLE_ACCESS_DENIED', outcome: 'DENIED', metadata: { requiredRoles: roles } }).catch(() => {});
      return res.status(403).json({ status: 'error', message: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

export function requireSelfParam(paramName = 'userId', ...bypassRoles) {
  return (req, res, next) => {
    if (bypassRoles.includes(req.sessionUser?.role) || String(req.params[paramName]) === String(req.sessionUser?.sub)) return next();
    auditSecurityEvent(req, { eventType: 'IDOR_ATTEMPT', outcome: 'DENIED', objectType: 'user', objectId: req.params[paramName] }).catch(() => {});
    return res.status(403).json({ status: 'error', message: 'You may only access your own account.' });
  };
}

export function requireSelfBody(fieldName = 'user_id', ...bypassRoles) {
  return (req, res, next) => {
    if (bypassRoles.includes(req.sessionUser?.role) || String(req.body?.[fieldName]) === String(req.sessionUser?.sub)) return next();
    auditSecurityEvent(req, { eventType: 'IDOR_ATTEMPT', outcome: 'DENIED', objectType: 'user', objectId: req.body?.[fieldName] }).catch(() => {});
    return res.status(403).json({ status: 'error', message: 'You may only change your own account.' });
  };
}

function requireOwnedProfile(tableName, idColumn, paramName, allowedRoles) {
  return async (req, res, next) => {
    try {
      if (req.sessionUser?.role === 'admin') return next();
      if (!allowedRoles.includes(req.sessionUser?.role)) return res.status(403).json({ status: 'error', message: 'You do not have permission to access this resource.' });
      const result = await pool.query(`SELECT 1 FROM ${tableName} WHERE ${idColumn}=$1 AND user_id=$2`, [req.params[paramName], req.sessionUser.sub]);
      if (!result.rowCount) {
        await auditSecurityEvent(req, { eventType: 'IDOR_ATTEMPT', outcome: 'DENIED', objectType: tableName, objectId: req.params[paramName] });
        return res.status(403).json({ status: 'error', message: 'This resource does not belong to your account.' });
      }
      return next();
    } catch (error) { return next(error); }
  };
}

export const requireOwnTeacherProfile = (paramName = 'teacherId') => requireOwnedProfile('teacher', 'teacher_id', paramName, ['teacher', 'hod', 'dec']);
export const requireOwnStudentProfile = (paramName = 'studentId') => requireOwnedProfile('student', 'student_id', paramName, ['student']);

function requireOwnedProfileBody(tableName, idColumn, fieldName, allowedRoles) {
  return async (req, res, next) => {
    try {
      if (req.sessionUser?.role === 'admin') return next();
      if (!allowedRoles.includes(req.sessionUser?.role)) return res.status(403).json({ status: 'error', message: 'You do not have permission to access this resource.' });
      const result = await pool.query(`SELECT 1 FROM ${tableName} WHERE ${idColumn}=$1 AND user_id=$2`, [req.body?.[fieldName], req.sessionUser.sub]);
      if (!result.rowCount) {
        await auditSecurityEvent(req, { eventType: 'IDOR_ATTEMPT', outcome: 'DENIED', objectType: tableName, objectId: req.body?.[fieldName] });
        return res.status(403).json({ status: 'error', message: 'This resource does not belong to your account.' });
      }
      return next();
    } catch (error) { return next(error); }
  };
}

export const requireOwnTeacherBodyProfile = (fieldName = 'teacher_id') => requireOwnedProfileBody('teacher', 'teacher_id', fieldName, ['teacher', 'hod', 'dec']);
export const requireOwnStudentBodyProfile = (fieldName = 'student_id') => requireOwnedProfileBody('student', 'student_id', fieldName, ['student']);
