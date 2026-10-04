import express from 'express';
import {
  recordEvent,
  evaluateFuzzy,
  getExamEvents,
  getExamSummary,
} from '../controllers/proctoringController.js';
import { requireOwnStudentBodyProfile, requireRole, requireSession } from '../middleware/sessionAuth.js';

const router = express.Router();
router.use(requireSession);

// Mounted at /api/proctoring
router.post('/event', requireRole('student', 'admin'), requireOwnStudentBodyProfile(), recordEvent);
router.post('/evaluate-fuzzy', requireRole('student', 'admin'), requireOwnStudentBodyProfile(), evaluateFuzzy);
router.get('/events/:examId', requireRole('teacher', 'hod', 'dec', 'coordinator', 'director', 'admin'), getExamEvents);
router.get('/summary/:examId', requireRole('teacher', 'hod', 'dec', 'coordinator', 'director', 'admin'), getExamSummary);

export default router;
