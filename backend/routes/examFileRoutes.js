import express from 'express';
import { uploadExamAsset } from '../middleware/upload.js';
import {
  uploadExamFile,
  getExamFiles,
  deleteExamFile,
} from '../controllers/examFileController.js';
import { requireRole, requireSession } from '../middleware/sessionAuth.js';
import { requireBodyExamManage, requireParamExamManage, requireParamExamRead } from '../middleware/examAuthorization.js';
import { createRateLimiter } from '../middleware/security.js';

const router = express.Router();
router.use(requireSession);

// Mounted at /api/exam-files
router.post('/upload', requireRole('teacher', 'admin'), createRateLimiter({ windowMs: 60 * 60 * 1000, limit: 30 }), uploadExamAsset.single('file'), requireBodyExamManage, uploadExamFile);
router.get('/:examId', requireRole('teacher', 'hod', 'dec', 'director', 'coordinator', 'admin'), requireParamExamRead, getExamFiles);
router.delete('/:examId/:fileId', requireRole('teacher', 'admin'), requireParamExamManage, deleteExamFile);

export default router;
