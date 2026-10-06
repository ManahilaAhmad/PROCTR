import crypto from 'node:crypto';
import pool from '../db.js';

const buckets = new Map();

export function clientIp(req) {
  // Express only applies X-Forwarded-For to req.ip when `trust proxy` is
  // explicitly enabled. Reading the header directly would let a client forge
  // the address used by rate limits and security audits.
  const raw = req.ip || req.socket?.remoteAddress || '';
  return String(raw).replace(/^::ffff:/, '').trim().slice(0, 45);
}

export function verifyRequestOrigin(allowedOrigins) {
  const allowed = new Set(allowedOrigins);
  return (req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

    // Desktop/API clients use bearer authentication and are not susceptible
    // to browser cookie CSRF. Cookie-authenticated mutations must come from an
    // explicitly allowed website origin.
    const hasBearerToken = String(req.get?.('authorization') || '').startsWith('Bearer ');
    const hasSessionCookie = /(?:^|;\s*)(?:__Host-proctr_session|proctr_session)=/.test(String(req.headers?.cookie || ''));
    if (hasBearerToken || !hasSessionCookie) return next();

    const origin = req.get?.('origin');
    if (origin && allowed.has(origin)) return next();

    auditSecurityEvent(req, { eventType: 'CSRF_ORIGIN_DENIED', outcome: 'DENIED' }).catch(() => {});
    return res.status(403).json({ status: 'error', message: 'This request did not come from an approved application origin.' });
  };
}

export function securityHeaders(req, res, next) {
  const connectSources = ["'self'"];
  const configuredApi = process.env.PUBLIC_API_ORIGIN?.trim();
  if (configuredApi) connectSources.push(configuredApi);

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Content-Security-Policy', [
    "default-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `connect-src ${connectSources.join(' ')}`,
  ].join('; '));
  res.setHeader('Cache-Control', req.path.startsWith('/api/auth') ? 'no-store' : 'private, no-cache');

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

export function createRateLimiter({ windowMs, limit, key = (req) => clientIp(req), message = 'Too many requests. Please try again later.' }) {
  return (req, res, next) => {
    const now = Date.now();
    const bucketKey = `${req.baseUrl}:${req.path}:${key(req)}`;
    const current = buckets.get(bucketKey);
    const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    entry.count += 1;
    buckets.set(bucketKey, entry);

    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, limit - entry.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > limit) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      auditSecurityEvent(req, {
        eventType: 'RATE_LIMIT_EXCEEDED',
        outcome: 'DENIED',
        metadata: { bucket: req.path },
      }).catch(() => {});
      return res.status(429).json({ status: 'error', message });
    }

    if (buckets.size > 10000) {
      for (const [storedKey, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(storedKey);
      }
    }
    next();
  };
}

function safeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  const blocked = /password|passcode|token|secret|authorization|cookie/i;
  return Object.fromEntries(Object.entries(metadata)
    .filter(([key]) => !blocked.test(key))
    .slice(0, 30));
}

export async function auditSecurityEvent(req, {
  eventType,
  outcome = 'INFO',
  userId = req?.sessionUser?.sub || null,
  sessionId = req?.sessionUser?.sid || null,
  objectType = null,
  objectId = null,
  metadata = {},
}) {
  if (process.env.NODE_ENV === 'test') return;
  try {
    await pool.query(`
      INSERT INTO security_audit_log
        (user_id,session_id,event_type,outcome,ip_address,user_agent,method,request_path,object_type,object_id,metadata)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
    `, [
      userId,
      sessionId,
      String(eventType).slice(0, 80),
      outcome,
      req ? clientIp(req) : null,
      String(req?.get?.('user-agent') || '').slice(0, 500) || null,
      String(req?.method || '').slice(0, 10) || null,
      String(req?.originalUrl || req?.url || '').slice(0, 1000) || null,
      objectType ? String(objectType).slice(0, 80) : null,
      objectId == null ? null : String(objectId).slice(0, 255),
      JSON.stringify(safeMetadata(metadata)),
    ]);
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') console.warn('[Security Audit]', error.message);
  }
}

export function hashIdentifier(value) {
  return crypto.createHash('sha256').update(String(value || '').trim().toLowerCase()).digest('hex');
}

export function requireJson(req, res, next) {
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('application/json')) {
    return res.status(415).json({ status: 'error', message: 'Content-Type application/json is required.' });
  }
  next();
}

export function requirePositiveInteger(source, field) {
  return (req, res, next) => {
    const value = req[source]?.[field];
    if (!/^\d+$/.test(String(value || '')) || Number(value) < 1) {
      return res.status(400).json({ status: 'error', message: `${field} must be a positive integer.` });
    }
    next();
  };
}
