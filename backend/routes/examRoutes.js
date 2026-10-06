import express from 'express';
import { upload } from '../middleware/upload.js';
import {
  createExam,
  uploadPaper,
  submitToHOD,
  shareToDEC,
} from '../controllers/teacherController.js';

const router = express.Router();

// Mounted at /api/exams
// POST /api/exams              → create exam draft
// POST /api/exams/submit-hod   → submit to HOD
// POST /api/exams/upload       → file upload
// POST /api/exams/:id/share-dec → share with DEC

// IMPORTANT: /upload and /submit-hod must be defined BEFORE /:examId
// to prevent Express matching them as an examId parameter
router.post('/upload', upload.single('file'), uploadPaper);
router.post('/submit-hod', submitToHOD);
router.post('/:examId/share-dec', shareToDEC);
router.post('/', createExam);

export default router;
