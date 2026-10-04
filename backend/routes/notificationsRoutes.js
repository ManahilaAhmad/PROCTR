import express from "express";
import {
    getMyNotifications,
    markNotificationRead,
    markAllNotificationsRead,
} from "../controllers/notificationsController.js";
import { requireSelfBody, requireSelfParam, requireSession } from "../middleware/sessionAuth.js";

const router = express.Router();
router.use(requireSession);

/* ===========================================================
   NOTIFICATIONS
=========================================================== */

router.get("/:userId", requireSelfParam('userId', 'admin'), getMyNotifications);

router.post("/:id/read", requireSelfBody('user_id', 'admin'), markNotificationRead);

router.post("/:userId/read-all", requireSelfParam('userId', 'admin'), markAllNotificationsRead);

export default router;
