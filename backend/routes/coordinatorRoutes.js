import express from "express";

import {
    getLabs,
    getApprovedExams,
    getSchedule,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    publishSchedule,
    getAvailableLabs,
    broadcastAnnouncement,
    getRecipients
} from "../controllers/coordinatorController.js";

const router = express.Router();

/* ===========================================================
   LABS
=========================================================== */

router.get("/labs", getLabs);

router.get("/labs/available", getAvailableLabs);

/* ===========================================================
   APPROVED EXAMS
=========================================================== */

router.get("/exams/approved", getApprovedExams);

/* ===========================================================
   SCHEDULE
=========================================================== */

router.get("/schedule", getSchedule);

router.post("/schedule", createSchedule);

router.put("/schedule/:schedule_id", updateSchedule);

router.delete("/schedule/:schedule_id", deleteSchedule);

router.patch("/schedule/:schedule_id/publish", publishSchedule);

/* ===========================================================
   NOTIFICATIONS
=========================================================== */
router.get("/notifications/recipients", getRecipients);

router.post("/notifications/broadcast", broadcastAnnouncement);

export default router;