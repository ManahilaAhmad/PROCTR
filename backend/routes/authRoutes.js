import express from 'express';
import { login, logout, sessionStatus, changePassword, updateProfilePicture } from '../controllers/authController.js';
import { uploadImage } from '../middleware/upload.js';
import { requestPasswordReset, resetPassword, validatePasswordResetToken } from '../controllers/passwordRecoveryController.js';
import { requireSelfBody, requireSession } from '../middleware/sessionAuth.js';
import { createRateLimiter } from '../middleware/security.js';

const router = express.Router();

const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, limit: 20, message: 'Too many login attempts. Please wait and try again.' });
const recoveryLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, limit: 10, message: 'Too many recovery attempts. Please wait and try again.' });
const profileUploadLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, limit: 10, message: 'Too many profile-picture uploads. Please wait and try again.' });

router.post('/login', loginLimiter, login);
router.post('/logout', requireSession, logout);
router.get('/session', requireSession, sessionStatus);
router.post('/forgot-password', recoveryLimiter, requestPasswordReset);
router.get('/reset-password/validate', recoveryLimiter, validatePasswordResetToken);
router.post('/reset-password', recoveryLimiter, resetPassword);
router.post('/change-password', requireSession, requireSelfBody('user_id'), changePassword);
router.post('/profile-picture', requireSession, profileUploadLimiter, uploadImage.single('avatar'), updateProfilePicture);

export default router;
