import express from "express";

import {
    getLabs,
    getApprovedExams,
    getSchedulableOfferings,
    getSchedule,
    createIndependentTimetable,
    updateIndependentTimetable,
    deleteIndependentTimetable,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    publishSchedule,
    getAvailableLabs,
    broadcastAnnouncement,
    getRecipients
} from "../controllers/coordinatorController.js";
import { requireRole, requireSession } from "../middleware/sessionAuth.js";

const router = express.Router();
router.use(requireSession, requireRole('coordinator', 'admin'));

/* ===========================================================
   LABS
=========================================================== */

router.get("/labs", getLabs);

router.get("/labs/available", getAvailableLabs);

/* ===========================================================
   APPROVED EXAMS
=========================================================== */

router.get("/exams/approved", getApprovedExams);
router.get("/schedule-options", getSchedulableOfferings);

/* ===========================================================
   SCHEDULE
=========================================================== */

router.get("/schedule", getSchedule);

router.post("/timetable", createIndependentTimetable);

router.put("/timetable/:timetable_id", updateIndependentTimetable);

router.delete("/timetable/:timetable_id", deleteIndependentTimetable);

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
