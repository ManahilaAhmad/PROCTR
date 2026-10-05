import express from 'express';
import { requireLabNetwork } from '../middleware/labNetwork.js';
import { requireRole, requireSession } from '../middleware/sessionAuth.js';

const router = express.Router();

router.post('/validate', requireSession, requireRole('student', 'admin'), requireLabNetwork, (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Device is connected to the allowed lab network.',
    ...req.labNetwork,
  });
});

export default router;
