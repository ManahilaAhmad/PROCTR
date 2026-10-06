import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { securityHeaders, createRateLimiter, auditSecurityEvent, verifyRequestOrigin } from './middleware/security.js';
import { extractSessionToken, validateSessionToken, requireRole, requireSelfBody, requireSession } from './middleware/sessionAuth.js';
import { userHasExamAccess } from './middleware/examAuthorization.js';

// Route files (namespaced)
import authRoutes from './routes/authRoutes.js';
import teacherRoutes from './routes/teacherRoutes.js';
import examRoutes from './routes/examRoutes.js';
import hodRoutes from './routes/hodRoutes.js';
import decRoutes from './routes/decRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import coordinatorRoutes from './routes/coordinatorRoutes.js';
import notificationsRoutes from './routes/notificationsRoutes.js';
import desktopRoutes from './routes/desktopRoutes.js';
import networkRoutes from './routes/networkRoutes.js';
import proctoringRoutes from './routes/proctoringRoutes.js';
import submissionRoutes from './routes/submissionRoutes.js';
import { setIO } from './socketRegistry.js';
import { ensureSubmissionSchema } from './service/submissionSchema.js';
import adminRoutes from './routes/adminRoutes.js';
import examFileRoutes from './routes/examFileRoutes.js';
import whitelistRoutes from './routes/whitelistRoutes.js';

// Controllers (for legacy flat-path aliases)
import { listTeachers, getSharedPapers } from './controllers/teacherController.js';
import { assignInvigilator, createSwapRequest, listSwapRequests, reviewSwapRequest } from './controllers/decController.js';
import { getSchedule as coordGetSchedule, getLabs } from './controllers/coordinatorController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
app.set('trust proxy', process.env.TRUST_PROXY === 'true');

const configuredOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ...(process.env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean),
].map(value => value.replace(/\/$/, '')));

const corsOptions = {
  credentials: true,
  origin(origin, callback) {
    if (!origin || configuredOrigins.has(origin.replace(/\/$/, ''))) return callback(null, true);
    return callback(new Error('Origin is not allowed by PROCTR CORS policy.'));
  },
  allowedHeaders: ['Content-Type', 'Authorization', 'X-PROCTR-Client'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
};

// Packaged Electron windows load from file:// and send the opaque "null"
// origin. Accept it only when the request identifies itself as the desktop
// client; normal browser origins still use the explicit website allowlist.
const corsOptionsForRequest = (req, callback) => {
  const requestedHeaders = (req.get('access-control-request-headers') || '')
    .toLowerCase().split(',').map(header => header.trim());
  const isDesktopRequest = req.get('x-proctr-client') === 'desktop'
    || (req.method === 'OPTIONS' && requestedHeaders.includes('x-proctr-client'));
  if (req.get('origin') === 'null' && isDesktopRequest) {
    return callback(null, { ...corsOptions, origin: 'null' });
  }
  callback(null, corsOptions);
};

// ── Core Middleware ─────────────────────────────────────────
app.use(securityHeaders);
app.use(cors(corsOptionsForRequest));
app.use(verifyRequestOrigin(configuredOrigins));
// Desktop sends base64 files in JSON (40 MB decoded total plus encoding).
app.use('/api/submission/upload', express.json({ limit: '64mb' }));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '25mb', strict: true }));
app.use(createRateLimiter({ windowMs: 15 * 60 * 1000, limit: 600 }));

// Serve uploaded exam papers statically
app.use('/uploads', (req, res, next) => {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(req.path).replace(/\\/g, '/');
  } catch {
    return res.sendStatus(400);
  }
  // Match the path that static serving resolves, including encoded separators
  // and Windows aliases such as "submissions." or "submissions ".
  const normalizedPath = path.posix.normalize(decodedPath);
  const firstSegment = normalizedPath.split('/').find(Boolean) || '';
  if (firstSegment.replace(/[. ]+$/g, '').toLowerCase() === 'submissions') {
    return res.sendStatus(404);
  }
  next();
});
// Local fallback files also require a valid account. Cloudinary deployments
// should use authenticated/private delivery for equivalent protection.
app.use('/uploads', requireSession, express.static(path.join(__dirname, 'uploads')));

// ── Health & DB Check ───────────────────────────────────────
import pool from './db.js';

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'PROCTR Backend is healthy and running.' });
});

app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.status(200).json({
      status: 'success',
      message: 'Connected to PostgreSQL.',
      time: result.rows[0].now
    });
  } catch (error) {
    console.error('DB connection test failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to connect to Neon PostgreSQL.'
    });
  }
});

// Auto-enforce unique course offering per section constraint on database startup
pool.query(`
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'unique_section_course_offering'
    ) THEN
      ALTER TABLE course_offering 
      ADD CONSTRAINT unique_section_course_offering 
      UNIQUE (section_id, course_id, term_id, offering_type);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'unique_exam_schedule_exam'
    ) THEN
      ALTER TABLE exam_schedule 
      ADD CONSTRAINT unique_exam_schedule_exam 
      UNIQUE (exam_id);
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'user_notification_notification_type_check'
    ) THEN
      ALTER TABLE user_notification DROP CONSTRAINT user_notification_notification_type_check;
      ALTER TABLE user_notification ADD CONSTRAINT user_notification_notification_type_check
      CHECK (notification_type IN ('Exam','Schedule','Approved','AI','MOSS','Invigilation','System'));
    END IF;
  END $$;
`).catch(err => console.log("Database constraint check:", err.message));

// ── Primary Namespaced Routes ───────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/hod', hodRoutes);
app.use('/api/dec', decRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/coordinator', coordinatorRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/desktop', desktopRoutes);
app.use('/api/proctoring', proctoringRoutes);
app.use('/api/submission', submissionRoutes);
app.use('/api/network', networkRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/exam-files', examFileRoutes);
app.use('/api/whitelist', whitelistRoutes);

// ── Legacy Flat-Path Aliases (frontend uses these exact URLs) ─

// GET /api/teachers
app.get('/api/teachers', requireSession, requireRole('teacher', 'hod', 'dec', 'coordinator', 'director', 'admin'), listTeachers);

// DEC - invigilator and swap
app.post('/api/invigilator/assign', requireSession, requireRole('dec', 'admin'), requireSelfBody('user_id', 'admin'), assignInvigilator);
app.post('/api/swap-request', requireSession, requireRole('teacher', 'hod', 'dec', 'admin'), requireSelfBody('user_id', 'admin'), createSwapRequest);
app.get('/api/swap-requests/dec', requireSession, requireRole('dec', 'admin'), listSwapRequests);
app.post('/api/swap-requests/dec/review', requireSession, requireRole('dec', 'admin'), reviewSwapRequest);

// Director + DEC use these flat paths
app.get('/api/schedule', requireSession, requireRole('director', 'dec', 'admin'), coordGetSchedule);
app.get('/api/labs', requireSession, requireRole('director', 'dec', 'coordinator', 'admin'), getLabs);
app.get('/api/director/papers', requireSession, requireRole('director', 'admin'), getSharedPapers);

// ── Multer Error Handler ────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ status: 'error', message: 'Submission is too large. Submit at most 40 MB of files in total.' });
  }
  if (err instanceof multer.MulterError || err?.message?.includes('PDF and DOCX') || err?.message?.includes('files are allowed') || err?.message?.includes('Starter code must') || err?.message?.includes('Question papers and rubrics')) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
  if (err?.message?.includes('CORS policy')) {
    auditSecurityEvent(req, { eventType: 'CORS_ORIGIN_DENIED', outcome: 'DENIED' }).catch(() => {});
    return res.status(403).json({ status: 'error', message: 'Request origin is not allowed.' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ status: 'error', message: 'Request body is too large.' });
  }
  console.error('Unhandled request error:', err);
  return res.status(500).json({ status: 'error', message: 'Internal server error.' });
});

// ── Socket.IO — Live Monitoring Push Layer ──────────────────
// Wraps the Express app in a plain http server so Socket.IO can
// share the same port. Teacher clients join a room named
// `session:<SESSION_CODE>` (see socketRegistry.js) and receive
// `live_violation` events the instant a student's desktop client
// reports a hard violation — no polling delay.
const httpServer = createServer(app);

const socketCorsOptions = {
  ...corsOptions,
  origin(origin, callback) {
    // Electron's file:// renderer has an opaque null origin. Socket access is
    // still protected by the authenticated session token in the handshake.
    if (origin === 'null') return callback(null, 'null');
    return corsOptions.origin(origin, callback);
  },
};

const io = new SocketIOServer(httpServer, {
  cors: socketCorsOptions
});

io.use(async (socket, next) => {
  try {
    const bearer = socket.handshake.headers.authorization;
    const token = socket.handshake.auth?.token
      || (bearer?.startsWith('Bearer ') ? bearer.slice(7) : '')
      || extractSessionToken({ headers: socket.handshake.headers, get: (name) => socket.handshake.headers[name.toLowerCase()] });
    socket.data.sessionToken = token;
    socket.data.requestContext = {
      ip: socket.handshake.address,
      socket: { remoteAddress: socket.handshake.address },
      get: (name) => socket.handshake.headers[name.toLowerCase()],
    };
    socket.data.sessionUser = await validateSessionToken(token, socket.data.requestContext);
    next();
  } catch {
    next(new Error('Authentication required'));
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);
  const revalidationTimer = setInterval(async () => {
    try {
      socket.data.sessionUser = await validateSessionToken(socket.data.sessionToken, socket.data.requestContext);
    } catch {
      socket.disconnect(true);
    }
  }, 60_000);
  revalidationTimer.unref?.();

  socket.on('join_room', async ({ sessionCode } = {}, acknowledge = () => {}) => {
    try {
      socket.data.sessionUser = await validateSessionToken(socket.data.sessionToken, socket.data.requestContext);
      if (!sessionCode || !['teacher', 'admin'].includes(socket.data.sessionUser.role)) throw new Error('Access denied');
      const normalized = String(sessionCode).trim().toUpperCase();
      const result = await pool.query('SELECT exam_id FROM live_exam_session WHERE session_code=$1', [normalized]);
      const examId = result.rows[0]?.exam_id;
      if (!examId || !await userHasExamAccess(socket.data.sessionUser.sub, socket.data.sessionUser.role, examId, 'manage')) throw new Error('Access denied');
      const room = `session:${normalized}`;
      socket.join(room);
      console.log(`[Socket] ${socket.id} joined room ${room}`);
      acknowledge({ status: 'success' });
    } catch {
      acknowledge({ status: 'error', message: 'You are not authorized to monitor this exam.' });
    }
  });

  socket.on('leave_room', ({ sessionCode }) => {
    if (!sessionCode) return;
    const room = `session:${String(sessionCode).trim().toUpperCase()}`;
    socket.leave(room);
  });

  socket.on('disconnect', () => {
    clearInterval(revalidationTimer);
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

setIO(io);

// ── Start Server ────────────────────────────────────────────
await ensureSubmissionSchema();
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`PROCTR Backend Server (HTTP + Socket.IO) is listening on port ${PORT}`);
});
