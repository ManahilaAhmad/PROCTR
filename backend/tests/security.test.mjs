import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SESSION_SECRET = 'test-only-session-secret-that-is-long-enough';
process.env.NODE_ENV = 'test';

const { createRateLimiter, securityHeaders, verifyRequestOrigin } = await import('../middleware/security.js');
const { createSessionToken, sessionCookie } = await import('../middleware/sessionAuth.js');

function mockResponse() {
  return {
    headers: new Map(),
    statusCode: 200,
    body: null,
    setHeader(name, value) { this.headers.set(name.toLowerCase(), String(value)); },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test('security headers deny framing and MIME sniffing', () => {
  const response = mockResponse();
  securityHeaders({ path: '/api/health' }, response, () => {});
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
});

test('cookie mutations accept approved origins', () => {
  const middleware = verifyRequestOrigin(['http://localhost:5173']);
  let continued = false;
  const request = {
    method: 'POST',
    headers: { cookie: 'proctr_session=example' },
    get(name) { return name.toLowerCase() === 'origin' ? 'http://localhost:5173' : ''; },
  };
  middleware(request, mockResponse(), () => { continued = true; });
  assert.equal(continued, true);
});

test('bearer API clients are not subjected to browser CSRF origin checks', () => {
  const middleware = verifyRequestOrigin([]);
  let continued = false;
  const request = {
    method: 'PATCH',
    headers: {},
    get(name) { return name.toLowerCase() === 'authorization' ? 'Bearer signed-token' : ''; },
  };
  middleware(request, mockResponse(), () => { continued = true; });
  assert.equal(continued, true);
});

test('rate limiter returns 429 after its configured threshold', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, limit: 2 });
  const request = { baseUrl: '/test', path: `/limit-${Date.now()}`, ip: '127.0.0.1' };
  limiter(request, mockResponse(), () => {});
  limiter(request, mockResponse(), () => {});
  const denied = mockResponse();
  limiter(request, denied, () => assert.fail('third request must not continue'));
  assert.equal(denied.statusCode, 429);
});

test('signed sessions include an opaque session id and HttpOnly cookie flags', () => {
  const token = createSessionToken({ user_id: 7, user_type: 'student', session_version: 2 }, '47bc05ec-b64e-4f20-b766-79f0f3390277');
  assert.equal(token.split('.').length, 2);
  const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
  assert.equal(payload.sid, '47bc05ec-b64e-4f20-b766-79f0f3390277');
  assert.equal(payload.ver, 2);
  assert.match(sessionCookie(token), /HttpOnly/);
  assert.match(sessionCookie(token), /SameSite=Strict/);
});
