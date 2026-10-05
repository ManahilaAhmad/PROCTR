import express from 'express';
import { upload } from '../middleware/upload.js';
import {
  uploadExamFile,
  getExamFiles,
  deleteExamFile,
} from '../controllers/examFileController.js';

const router = express.Router();

// Mounted at /api/exam-files
router.post('/upload', upload.single('file'), uploadExamFile);
router.get('/:examId', getExamFiles);
router.delete('/:examId/:fileId', deleteExamFile);

export default router;
