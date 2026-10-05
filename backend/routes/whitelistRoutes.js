import express from 'express';
import {
  getExamWhitelist,
  addDomainToWhitelist,
  removeDomainFromWhitelist,
  getDomainSuggestions,
} from '../controllers/whitelistController.js';
import { requireRole, requireSession } from '../middleware/sessionAuth.js';
import { requireParamExamManage } from '../middleware/examAuthorization.js';

const router = express.Router();
router.use(requireSession, requireRole('teacher', 'admin'));

// Mounted at /api/whitelist
router.get('/suggest', getDomainSuggestions);
router.get('/:examId', requireParamExamManage, getExamWhitelist);
router.post('/:examId', requireParamExamManage, addDomainToWhitelist);
router.delete('/:examId/:whitelistId', requireParamExamManage, removeDomainFromWhitelist);

export default router;
