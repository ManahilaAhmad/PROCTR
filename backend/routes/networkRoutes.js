import express from 'express';
import { requireLabNetwork } from '../middleware/labNetwork.js';

const router = express.Router();

router.post('/validate', requireLabNetwork, (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Device is connected to the allowed lab network.',
    ...req.labNetwork,
  });
});

export default router;