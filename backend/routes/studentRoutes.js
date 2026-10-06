import express from 'express';
import { getSchedule } from '../controllers/studentController.js';

const router = express.Router();

router.get('/:userId/schedule', getSchedule);

export default router;
