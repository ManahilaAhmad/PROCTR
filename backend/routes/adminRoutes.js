import express from 'express';
import { requireRole, requireSession } from '../middleware/sessionAuth.js';
import { createLab, createUser, deleteLab, getLabs, getOverview, getSecurityEvents, getSettings, getUsers, importLabs, importUsers, removeUser, revokeUserSessions, setUserActive, updateLab, updateSettings } from '../controllers/adminController.js';

const router = express.Router();
router.use(requireSession, requireRole('admin'));
router.get('/overview', getOverview);
router.get('/labs', getLabs);
router.post('/labs', createLab);
router.post('/labs/import', importLabs);
router.put('/labs/:labId', updateLab);
router.delete('/labs/:labId', deleteLab);
router.get('/settings', getSettings);
router.put('/settings', updateSettings);
router.get('/users', getUsers);
router.post('/users', createUser);
router.post('/users/import', importUsers);
router.delete('/users/:userId', removeUser);
router.patch('/users/:userId/status', setUserActive);
router.post('/users/:userId/revoke-sessions', revokeUserSessions);
router.get('/security-events', getSecurityEvents);

export default router;
