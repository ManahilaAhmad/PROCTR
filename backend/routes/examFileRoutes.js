import express from 'express';
import { uploadExamAsset } from '../middleware/upload.js';
import {
  uploadExamFile,
  getExamFiles,
  deleteExamFile,
} from '../controllers/examFileController.js';
import { requireRole, requireSession } from '../middleware/sessionAuth.js';

const router = express.Router();
router.use(requireSession);

// Mounted at /api/exam-files
router.post('/upload', requireRole('teacher', 'admin'), uploadExamAsset.single('file'), uploadExamFile);
router.get('/:examId', requireRole('teacher', 'hod', 'dec', 'director', 'coordinator', 'admin'), getExamFiles);
router.delete('/:examId/:fileId', requireRole('teacher', 'admin'), deleteExamFile);

export default router;
