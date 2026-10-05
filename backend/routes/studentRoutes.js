import express from 'express';
import { getSchedule } from '../controllers/studentController.js';
import { requireRole, requireSelfParam, requireSession } from '../middleware/sessionAuth.js';

const router = express.Router();

router.get('/:userId/schedule', requireSession, requireRole('student', 'admin'), requireSelfParam('userId', 'admin'), getSchedule);

export default router;
