import express from 'express';
import { getSchedule, getPlannedSchedule } from '../controllers/studentController.js';
import { requireRole, requireSelfParam, requireSession } from '../middleware/sessionAuth.js';

const router = express.Router();

router.get('/:userId/schedule', requireSession, requireRole('student', 'admin'), requireSelfParam('userId', 'admin'), getSchedule);
router.get('/:userId/planned-schedule', requireSession, requireRole('student', 'admin'), requireSelfParam('userId', 'admin'), getPlannedSchedule);

export default router;
