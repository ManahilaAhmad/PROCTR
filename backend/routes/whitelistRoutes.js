import express from 'express';
import {
  getExamWhitelist,
  addDomainToWhitelist,
  removeDomainFromWhitelist,
  getDomainSuggestions,
} from '../controllers/whitelistController.js';

const router = express.Router();

// Mounted at /api/whitelist
router.get('/suggest', getDomainSuggestions);
router.get('/:examId', getExamWhitelist);
router.post('/:examId', addDomainToWhitelist);
router.delete('/:examId/:whitelistId', removeDomainFromWhitelist);

export default router;
