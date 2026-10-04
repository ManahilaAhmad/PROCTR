import express from 'express';
import {
  listTeachers,
  getSchedule,
  getTeacherCourses,
  getIncomingSwapRequests,
  getOutgoingSwapRequests,
  respondToSwapRequest,
} from '../controllers/teacherController.js';
import { requireRole, requireSelfBody, requireSelfParam, requireSession } from '../middleware/sessionAuth.js';

const router = express.Router();

// Mounted at /api/teacher
// GET /api/teachers                                → listTeachers
// GET /api/teacher/:userId/schedule               → getSchedule
// GET /api/teacher/:userId/courses                → getTeacherCourses
// GET /api/teacher/:userId/swap-requests/incoming → getIncomingSwapRequests
// GET /api/teacher/:userId/swap-requests/outgoing → getOutgoingSwapRequests
// POST /api/teacher/swap-requests/:requestId/respond → respondToSwapRequest

router.use(requireSession, requireRole('teacher', 'hod', 'dec', 'coordinator', 'director', 'admin'));
router.get('/', listTeachers);
router.get('/:userId/courses', requireSelfParam('userId', 'admin'), getTeacherCourses);
router.get('/:userId/schedule', requireSelfParam('userId', 'admin'), getSchedule);
router.get('/:userId/swap-requests/incoming', requireSelfParam('userId', 'admin'), getIncomingSwapRequests);
router.get('/:userId/swap-requests/outgoing', requireSelfParam('userId', 'admin'), getOutgoingSwapRequests);
router.post('/swap-requests/:requestId/respond', requireSelfBody('user_id', 'admin'), respondToSwapRequest);

export default router;
