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
import {
  requireBodyExamManage,
  requireBodySessionManage,
  requireParamSessionRead,
} from '../middleware/examAuthorization.js';
import { createRateLimiter } from '../middleware/security.js';

const router = express.Router();
router.use(requireSession);

// Mounted at /api/desktop
const joinLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, limit: 15, message: 'Too many exam join attempts. Please wait before trying again.' });

router.post('/session/create', requireRole('teacher', 'admin'), requireOwnTeacherBodyProfile('invigilator_id'), requireBodyExamManage, createLiveSession);
router.post('/session/join', joinLimiter, requireRole('student', 'admin'), requireOwnStudentBodyProfile(), joinLiveSession);
router.post('/session/reveal-paper', requireRole('teacher', 'admin'), requireBodySessionManage, revealPaper);
router.post('/session/start-timer', requireRole('teacher', 'admin'), requireBodySessionManage, startTimer);
router.post('/session/extend-time', requireRole('teacher', 'admin'), requireBodySessionManage, extendTime);
router.post('/session/end', requireRole('teacher', 'admin'), requireBodySessionManage, endLiveSession);
router.post('/session/leave', requireRole('student', 'admin'), requireOwnStudentBodyProfile(), leaveLiveSession);
router.get('/session/:sessionCode/status', requireRole('student', 'teacher', 'admin'), requireParamSessionRead, getSessionStatus);

// Legacy/Direct endpoints
router.post('/session/start', requireRole('student', 'admin'), requireOwnStudentBodyProfile(), startSession);
router.post('/violation', requireRole('student', 'admin'), requireOwnStudentBodyProfile(), logViolation);
router.get('/sessions/active', requireRole('teacher', 'coordinator', 'admin'), getActiveSessionsCount);

export default router;
