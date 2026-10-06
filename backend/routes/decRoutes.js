import express from 'express';
import {
  assignInvigilator,
  createSwapRequest,
  listSwapRequests,
  reviewSwapRequest,
} from '../controllers/decController.js';

const router = express.Router();

// Mounted at /api/dec
// POST /api/dec/invigilator/assign   → assignInvigilator
// POST /api/dec/swap-request         → createSwapRequest
// GET  /api/dec/swap-requests        → listSwapRequests
// POST /api/dec/swap-requests/review → reviewSwapRequest

router.post('/invigilator/assign', assignInvigilator);
router.post('/swap-request', createSwapRequest);
router.get('/swap-requests', listSwapRequests);
router.post('/swap-requests/review', reviewSwapRequest);

export default router;
