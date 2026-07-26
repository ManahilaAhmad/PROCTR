import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

// Route files (namespaced)
import authRoutes          from './routes/authRoutes.js';
import teacherRoutes       from './routes/teacherRoutes.js';
import examRoutes          from './routes/examRoutes.js';
import hodRoutes           from './routes/hodRoutes.js';
import decRoutes           from './routes/decRoutes.js';
import studentRoutes       from './routes/studentRoutes.js';
import coordinatorRoutes   from './routes/coordinatorRoutes.js';
import notificationsRoutes from './routes/notificationsRoutes.js';

// Controllers (for legacy flat-path aliases)
import { listTeachers }                                                      from './controllers/teacherController.js';
import { assignInvigilator, createSwapRequest, listSwapRequests, reviewSwapRequest } from './controllers/decController.js';
import { getSchedule as coordGetSchedule, getLabs }                          from './controllers/coordinatorController.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Core Middleware ─────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve uploaded exam papers statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Health & DB Check ───────────────────────────────────────
import pool from './db.js';

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'PROCTR Backend is healthy and running.' });
});

app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.status(200).json({ status: 'success', message: 'Connected to PostgreSQL.', time: result.rows[0].now });
  } catch (error) {
    console.error('DB connection test failed:', error);
    res.status(500).json({ status: 'error', message: 'Failed to connect to Neon PostgreSQL.' });
  }
});

// ── Primary Namespaced Routes ───────────────────────────────
app.use('/api/auth',          authRoutes);           // POST /api/auth/login, /api/auth/change-password
app.use('/api/teacher',       teacherRoutes);        // GET  /api/teacher/:userId/schedule
app.use('/api/exams',         examRoutes);           // POST /api/exams, /api/exams/upload, etc.
app.use('/api/hod',           hodRoutes);            // GET  /api/hod/queue, POST /api/hod/review, etc.
app.use('/api/dec',           decRoutes);            // POST /api/dec/invigilator/assign, etc.
app.use('/api/student',       studentRoutes);        // GET  /api/student/:userId/schedule
app.use('/api/coordinator',   coordinatorRoutes);    // Full coordinator CRUD
app.use('/api/notifications', notificationsRoutes);  // Notification bell endpoints

// ── Legacy Flat-Path Aliases (frontend uses these exact URLs) ─
// These map old un-namespaced paths directly to controllers,
// avoiding any double-prefix issues from router re-use.

// GET /api/teachers
app.get('/api/teachers', listTeachers);

// DEC - invigilator and swap
app.post('/api/invigilator/assign',       assignInvigilator);
app.post('/api/swap-request',             createSwapRequest);
app.get('/api/swap-requests/dec',         listSwapRequests);
app.post('/api/swap-requests/dec/review', reviewSwapRequest);

// Director + DEC use these flat paths
app.get('/api/schedule', coordGetSchedule);
app.get('/api/labs',     getLabs);

// ── Multer Error Handler ────────────────────────────────────
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err?.message?.includes('PDF and DOCX')) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
  next(err);
});

// ── Start Server ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`PROCTR Backend Server is listening on port ${PORT}`);
});