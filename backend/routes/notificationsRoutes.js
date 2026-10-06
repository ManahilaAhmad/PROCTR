import express from "express";
import {
    getMyNotifications,
    markNotificationRead,
    markAllNotificationsRead,
} from "../controllers/notificationsController.js";

const router = express.Router();

/* ===========================================================
   NOTIFICATIONS
=========================================================== */

router.get("/:userId", getMyNotifications);

router.post("/:id/read", markNotificationRead);

router.post("/:userId/read-all", markAllNotificationsRead);

export default router;