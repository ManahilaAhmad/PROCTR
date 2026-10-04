import express from 'express';
import {
  createLiveSession,
  joinLiveSession,
  revealPaper,
  startTimer,
  extendTime,
  endLiveSession,
  leaveLiveSession,
  getSessionStatus,
  startSession,
  logViolation,
  getActiveSessionsCount
} from '../controllers/desktopController.js';
import {
  requireOwnStudentBodyProfile,
  requireOwnTeacherBodyProfile,
  requireRole,
  requireSession,
} from '../middleware/sessionAuth.js';

const router = express.Router();
router.use(requireSession);

// Mounted at /api/desktop
router.post('/session/create', requireRole('teacher', 'admin'), requireOwnTeacherBodyProfile('invigilator_id'), createLiveSession);
router.post('/session/join', requireRole('student', 'admin'), requireOwnStudentBodyProfile(), joinLiveSession);
router.post('/session/reveal-paper', requireRole('teacher', 'admin'), revealPaper);
router.post('/session/start-timer', requireRole('teacher', 'admin'), startTimer);
router.post('/session/extend-time', requireRole('teacher', 'admin'), extendTime);
router.post('/session/end', requireRole('teacher', 'admin'), endLiveSession);
router.post('/session/leave', requireRole('student', 'admin'), requireOwnStudentBodyProfile(), leaveLiveSession);
router.get('/session/:sessionCode/status', requireRole('student', 'teacher', 'admin'), getSessionStatus);

// Legacy/Direct endpoints
router.post('/session/start', requireRole('student', 'admin'), requireOwnStudentBodyProfile(), startSession);
router.post('/violation', requireRole('student', 'admin'), requireOwnStudentBodyProfile(), logViolation);
router.get('/sessions/active', requireRole('teacher', 'coordinator', 'admin'), getActiveSessionsCount);

export default router;
