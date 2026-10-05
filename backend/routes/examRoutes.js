import express from 'express';
import { upload } from '../middleware/upload.js';
import {
  createExam,
  uploadPaper,
  submitToHOD,
  shareToDEC,
} from '../controllers/teacherController.js';
import { requireRole, requireSelfBody, requireSession } from '../middleware/sessionAuth.js';
import { requireBodyExamManage, requireParamExamManage } from '../middleware/examAuthorization.js';
import { createRateLimiter } from '../middleware/security.js';

const router = express.Router();
router.use(requireSession, requireRole('teacher', 'admin'));

// Mounted at /api/exams
// POST /api/exams              → create exam draft
// POST /api/exams/submit-hod   → submit to HOD
// POST /api/exams/upload       → file upload
// POST /api/exams/:id/share-dec → share with DEC

// IMPORTANT: /upload and /submit-hod must be defined BEFORE /:examId
// to prevent Express matching them as an examId parameter
router.post('/upload', createRateLimiter({ windowMs: 60 * 60 * 1000, limit: 30 }), upload.single('file'), requireBodyExamManage, uploadPaper);
router.post('/submit-hod', requireBodyExamManage, submitToHOD);
router.post('/:examId/share-dec', requireParamExamManage, shareToDEC);
router.post('/', requireSelfBody('user_id', 'admin'), createExam);

export default router;
