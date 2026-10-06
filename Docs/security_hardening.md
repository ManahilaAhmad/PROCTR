# PROCTR security hardening

This implementation adds application-layer controls for the main realistic threats to the university exam system. It is defense in depth; production security also depends on HTTPS, operating-system patching, Neon/Cloudinary account security, backups, and restricted administrator access.

## Required setup

From `PROCTR/backend` run:

```powershell
npm run migrate-security
npm test
```

The migration creates revocable server sessions, the security audit log, persistent authentication/join-attempt records, and hashed live-exam passcode fields. Existing sessions created before the migration are intentionally invalid; every user must sign in again.

Set a different high-entropy `SESSION_SECRET` (at least 32 characters) in every production environment. Configure exact website origins with `FRONTEND_URL` and `ALLOWED_ORIGINS`. On another laptop or phone, include the LAN address, for example `http://192.168.18.184:5173`. Never commit `.env`.

Production must terminate TLS/HTTPS in front of both website and API. Set `NODE_ENV=production`, set `TRUST_PROXY=true` only when traffic actually passes through a trusted reverse proxy, and allow only the deployed HTTPS origin. Plain HTTP cannot protect a session or exam file from interception on the network.

## Implemented controls

| Threat | Controls now implemented |
|---|---|
| Stolen session/token | Opaque signed tokens tied to a server-side session row; 8-hour configurable expiry; immediate revocation on logout, password reset/change, account disable, or administrator action; user-agent binding; optional strict IP binding. Website token is an `HttpOnly`, `SameSite=Strict` cookie. Desktop token is encrypted through Electron `safeStorage`, not local storage. |
| Session hijacking/fixation | A cryptographically random session ID is issued only after login, stored hashed server-side, checked on every request and Socket.IO connection, and never accepted from a URL. WebSocket rooms verify the authenticated teacher owns or invigilates the exam. |
| Brute force / credential stuffing | Endpoint rate limits plus persistent per-account-and-IP login failure tracking. Five failures lock login for 15 minutes. Password recovery and exam passcode attempts have separate limits. Responses reduce account enumeration and nonexistent accounts perform a dummy password check. |
| URL/ID manipulation (IDOR) | User, teacher, student, exam, submission, live-session, whitelist, HOD, coordinator, and department ownership checks are performed server-side. Query-string teacher/student IDs no longer grant file access. Denied object access is audited. |
| Cross-site scripting | React rendering remains escaped; desktop database values are encoded before `innerHTML`; untrusted submitted HTML is shown as source and never executed; preview iframes are sandboxed; CSP is present in the website and Electron client; unsafe stored file URLs are rejected. |
| CSRF | Cookie-authenticated state changes require an approved `Origin`; cookies are `SameSite=Strict`; desktop bearer requests bypass browser-only CSRF checks. CORS accepts only configured origins and credentials. |
| SQL injection | Database values use parameterized PostgreSQL queries. Dynamic authorization table names are selected only from a fixed server-side role map. |
| Malicious uploads / archive traversal | File type and size limits; source-code allowlist; sanitized local names; Cloudinary HTTPS host allowlist; ZIP path traversal checks, file-count and expanded-size limits; submission path containment, strict Base64 validation, and per-file/total limits. |
| SSRF / unsafe redirects | Desktop starter-code download accepts HTTPS Cloudinary hosts only and revalidates every redirect. Database file links accept only the configured PROCTR backend or HTTPS Cloudinary. |
| Data/file leakage | Local `/uploads` now requires authentication; submission storage is never statically exposed; submission downloads re-check the logged-in student/teacher owner. Word papers are downloaded directly instead of sending the private URL to Microsoft Office's online viewer. |
| Privilege abuse / missing accountability | Admin-only security audit screen records logins, failures, rate limits, denied access, password events, session changes and major admin actions. Admin can revoke all sessions for a user. HOD, coordinator and DEC changes are department-scoped. |
| Clickjacking / MIME confusion | `X-Frame-Options: DENY`, CSP `frame-ancestors`, `X-Content-Type-Options: nosniff`, restrictive referrer and permissions policies, and production HSTS. |
| Denial of service | General/API-specific rate limits, bounded JSON bodies, upload limits, ZIP-bomb limits, bounded audit queries, and limited security-event result sizes. Infrastructure-level DDoS protection remains a deployment responsibility. |

## Operational recommendations

- Replace the testing administrator password (`admin`) before any demonstration on a shared network. Use a password manager and a unique password.
- Enable MFA on Neon, Cloudinary, Gmail, GitHub and hosting-provider accounts. Application MFA is recommended before production use.
- Rotate `SESSION_SECRET`, database credentials, SMTP App Password and Cloudinary keys if any value was ever committed or shared.
- Retain security audit logs according to university policy. Periodically remove expired `security_session`, old `authentication_attempt`, and old `exam_join_attempt` rows.
- Alert on repeated `LOGIN_LOCKED`, `IDOR_ATTEMPT`, `CSRF_ORIGIN_DENIED`, `CORS_ORIGIN_DENIED`, and `EXAM_OBJECT_ACCESS_DENIED` events.
- Back up Neon and test restoration. Restrict database roles so the runtime account has only the permissions it needs.
- Package/sign the Electron application for deployment and protect the `C:\PROCTR_Exams` directory with appropriate Windows permissions.

## Remaining deployment boundary

New and existing Cloudinary raw asset URLs currently depend on the Cloudinary account's delivery configuration. The application restricts where those URLs can be opened and when they are revealed, but a public Cloudinary URL remains usable by anyone who obtains it. Before production, configure Cloudinary authenticated/private delivery and return short-lived signed URLs from an ownership-checked backend endpoint. Do not rely on an unguessable Cloudinary URL as access control.

In-memory HTTP rate limits protect one backend process. If PROCTR is deployed with multiple instances, replace them with a shared Redis-backed limiter or equivalent gateway/WAF policy.
