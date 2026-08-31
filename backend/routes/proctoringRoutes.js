import express from 'express';
import {
  recordEvent,
  evaluateFuzzy,
  getExamEvents,
  getExamSummary,
} from '../controllers/proctoringController.js';

const router = express.Router();

// Mounted at /api/proctoring
router.post('/event', recordEvent);
router.post('/evaluate-fuzzy', evaluateFuzzy);
router.get('/events/:examId', getExamEvents);
router.get('/summary/:examId', getExamSummary);

export default router;
