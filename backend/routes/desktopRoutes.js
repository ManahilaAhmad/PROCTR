import express from 'express';
import {
  createLiveSession,
  joinLiveSession,
  revealPaper,
  startTimer,
  getSessionStatus,
  startSession,
  logViolation,
  getActiveSessionsCount
} from '../controllers/desktopController.js';

const router = express.Router();

// Mounted at /api/desktop
router.post('/session/create', createLiveSession);
router.post('/session/join', joinLiveSession);
router.post('/session/reveal-paper', revealPaper);
router.post('/session/start-timer', startTimer);
router.get('/session/:sessionCode/status', getSessionStatus);

// Legacy/Direct endpoints
router.post('/session/start', startSession);
router.post('/violation', logViolation);
router.get('/sessions/active', getActiveSessionsCount);

export default router;
