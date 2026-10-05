import express from 'express';
import {
  assignInvigilator,
  createSwapRequest,
  listSwapRequests,
  reviewSwapRequest,
} from '../controllers/decController.js';
import { requireRole, requireSelfBody, requireSession } from '../middleware/sessionAuth.js';

const router = express.Router();

// Mounted at /api/dec
// POST /api/dec/invigilator/assign   → assignInvigilator
// POST /api/dec/swap-request         → createSwapRequest
// GET  /api/dec/swap-requests        → listSwapRequests
// POST /api/dec/swap-requests/review → reviewSwapRequest

router.use(requireSession);
router.post('/invigilator/assign', requireRole('dec', 'admin'), requireSelfBody('user_id', 'admin'), assignInvigilator);
router.post('/swap-request', requireRole('teacher', 'hod', 'dec', 'admin'), requireSelfBody('user_id', 'admin'), createSwapRequest);
router.get('/swap-requests', requireRole('dec', 'admin'), listSwapRequests);
router.post('/swap-requests/review', requireRole('dec', 'admin'), reviewSwapRequest);

export default router;
