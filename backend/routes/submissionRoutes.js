import express from 'express';
import {
  uploadSubmission,
  getTeacherLabs,
  getLabStudents,
  getStudentSubmissionFiles,
  getStudentOwnLabs,
  getStudentOwnFiles,
  downloadFile,
  downloadReport
} from '../controllers/submissionController.js';

const router = express.Router();

// Mounted at /api/submission

// Desktop app → upload a student's work (auto at session end, or manual button)
router.post('/upload', uploadSubmission);

// Teacher browsing: labs (course_offerings) → students (roll numbers) → files
router.get('/teacher/:teacherId/labs', getTeacherLabs);
router.get('/teacher/:teacherId/lab/:courseOfferingId/students', getLabStudents);
router.get('/teacher/:teacherId/lab/:courseOfferingId/student/:studentId/files', getStudentSubmissionFiles);
router.get('/teacher/:teacherId/report/:submissionId', downloadReport);

// Student browsing: their own submitted labs → files (no report exposed)
router.get('/student/:studentId/labs', getStudentOwnLabs);
router.get('/student/:studentId/lab/:courseOfferingId/files', getStudentOwnFiles);

// Shared: download an individual file (path-based — pass ?relativePath=...&teacherId=... or &studentId=...)
router.get('/file/:submissionId', downloadFile);

export default router;
