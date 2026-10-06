import express from 'express';
import { getSubmissionReceipt } from '../service/submissionReceipts.js';
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
import { getSubmissionReceipt } from '../service/submissionReceipts.js';
import {
  requireOwnStudentBodyProfile,
  requireOwnStudentProfile,
  requireOwnTeacherProfile,
  requireRole,
  requireSession,
} from '../middleware/sessionAuth.js';
import { requireExamAccessByBody } from '../middleware/examAuthorization.js';

const router = express.Router();
router.use(requireSession);
router.get('/receipt/:requestId', requireRole('student'), getSubmissionReceipt);

router.get('/receipt/:requestId', requireRole('student', 'admin'), getSubmissionReceipt);

// Mounted at /api/submission

// Desktop app → upload a student's work (auto at session end, or manual button)
router.post('/upload', requireRole('student', 'admin'), requireOwnStudentBodyProfile(), requireExamAccessByBody('exam_id', 'participate'), uploadSubmission);

// Teacher browsing: labs (course_offerings) → students (roll numbers) → files
router.get('/teacher/:teacherId/labs', requireOwnTeacherProfile(), getTeacherLabs);
router.get('/teacher/:teacherId/lab/:courseOfferingId/students', requireOwnTeacherProfile(), getLabStudents);
router.get('/teacher/:teacherId/lab/:courseOfferingId/student/:studentId/files', requireOwnTeacherProfile(), getStudentSubmissionFiles);
router.get('/teacher/:teacherId/report/:submissionId', requireOwnTeacherProfile(), downloadReport);

// Student browsing: their own submitted labs → files (no report exposed)
router.get('/student/:studentId/labs', requireOwnStudentProfile(), getStudentOwnLabs);
router.get('/student/:studentId/lab/:courseOfferingId/files', requireOwnStudentProfile(), getStudentOwnFiles);

// Shared: download an individual file (path-based — pass ?relativePath=...&teacherId=... or &studentId=...)
router.get('/file/:submissionId', requireRole('student', 'teacher', 'admin'), downloadFile);

export default router;
