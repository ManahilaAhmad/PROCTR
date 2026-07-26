import express from 'express';
import {
  listTeachers,
  getSchedule,
  getTeacherCourses,
  getIncomingSwapRequests,
  getOutgoingSwapRequests,
  respondToSwapRequest,
} from '../controllers/teacherController.js';

const router = express.Router();

// Mounted at /api/teacher
// GET /api/teachers                                → listTeachers
// GET /api/teacher/:userId/schedule               → getSchedule
// GET /api/teacher/:userId/courses                → getTeacherCourses
// GET /api/teacher/:userId/swap-requests/incoming → getIncomingSwapRequests
// GET /api/teacher/:userId/swap-requests/outgoing → getOutgoingSwapRequests
// POST /api/teacher/swap-requests/:requestId/respond → respondToSwapRequest

router.get('/', listTeachers);
router.get('/:userId/courses', getTeacherCourses);
router.get('/:userId/schedule', getSchedule);
router.get('/:userId/swap-requests/incoming', getIncomingSwapRequests);
router.get('/:userId/swap-requests/outgoing', getOutgoingSwapRequests);
router.post('/swap-requests/:requestId/respond', respondToSwapRequest);

export default router;
