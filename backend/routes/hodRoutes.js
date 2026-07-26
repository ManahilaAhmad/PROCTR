import express from 'express';
import { getQueue, reviewExam, getDecisions } from '../controllers/hodController.js';

const router = express.Router();

router.get('/queue', getQueue);
router.post('/review', reviewExam);
router.get('/decisions', getDecisions);

export default router;
