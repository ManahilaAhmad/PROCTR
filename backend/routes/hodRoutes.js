import express from 'express';
import { getQueue, reviewExam, getDecisions } from '../controllers/hodController.js';
import { requireRole, requireSession } from '../middleware/sessionAuth.js';

const router = express.Router();
router.use(requireSession, requireRole('hod', 'admin'));

router.get('/queue', getQueue);
router.post('/review', reviewExam);
router.get('/decisions', getDecisions);

export default router;
