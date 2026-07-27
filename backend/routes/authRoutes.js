import express from 'express';
import { login, changePassword, updateProfilePicture } from '../controllers/authController.js';
import { uploadImage } from '../middleware/upload.js';

const router = express.Router();

router.post('/login', login);
router.post('/change-password', changePassword);
router.post('/profile-picture', uploadImage.single('avatar'), updateProfilePicture);

export default router;
