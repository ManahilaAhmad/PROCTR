import express from 'express';
import { login, changePassword, updateProfilePicture } from '../controllers/authController.js';
import { uploadImage } from '../middleware/upload.js';
import { requestPasswordReset, resetPassword, validatePasswordResetToken } from '../controllers/passwordRecoveryController.js';
import { requireSelfBody, requireSession } from '../middleware/sessionAuth.js';

const router = express.Router();

router.post('/login', login);
router.post('/forgot-password', requestPasswordReset);
router.get('/reset-password/validate', validatePasswordResetToken);
router.post('/reset-password', resetPassword);
router.post('/change-password', requireSession, requireSelfBody('user_id'), changePassword);
router.post('/profile-picture', requireSession, uploadImage.single('avatar'), requireSelfBody('user_id'), updateProfilePicture);

export default router;
