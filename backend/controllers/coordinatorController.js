import pool from "../db.js";

/* ===========================================================
   GET ALL LABS
=========================================================== */
export const getLabs = async (req, res) => {
    try {
        const query = `
            SELECT
                lab_id,
                lab_name,
                total_pcs,
                capacity,
                network_range,
                status
            FROM lab
            ORDER BY lab_name ASC;
        `;

        const result = await pool.query(query);

        return res.status(200).json({
            status: "success",
            labs: result.rows
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            status: "error",
            message: "Failed to fetch labs."
        });
    }
};

/* ===========================================================
   GET APPROVED EXAMS
=========================================================== */
export const getApprovedExams = async (req, res) => {

    try {

        const query = `
            SELECT
                e.exam_id,
                e.exam_type,
                e.total_marks,
                e.duration,
                c.course_code,
                c.course_title,
                s.section_name
            FROM exam e

            JOIN course_offering co
                ON e.course_offering_id = co.course_offering_id

            JOIN course c
                ON co.course_id = c.course_id

            JOIN section s
                ON co.section_id = s.section_id

            WHERE e.status='Approved'

            ORDER BY c.course_code;
        `;

        const result = await pool.query(query);

        return res.status(200).json({

            status: "success",

            exams: result.rows

        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({

            status: "error",

            message: "Failed to fetch approved exams."

        });

    }

};

/* ===========================================================
   GET COMPLETE DATE SHEET
=========================================================== */
/* ===========================================================
   GET COMPLETE DATE SHEET
=========================================================== */

export const getSchedule = async (req, res) => {

    try {

        const query = `

            SELECT

                es.schedule_id,

                es.exam_date,

                es.start_time,

                es.end_time,

                es.status,

                e.exam_type,

                e.total_marks,

                e.duration,

                c.course_code,

                c.course_title,

                s.section_name,

                l.lab_id,

                l.lab_name,

                COALESCE(
                    u.first_name || ' ' || u.last_name,
                    'Unassigned'
                ) AS invigilator_name,

                ia.assignment_status

            FROM exam_schedule es

            JOIN exam e
                ON es.exam_id = e.exam_id

            JOIN course_offering co
                ON e.course_offering_id = co.course_offering_id

            JOIN course c
                ON co.course_id = c.course_id

            JOIN section s
                ON co.section_id = s.section_id

            JOIN lab l
                ON es.lab_id = l.lab_id

            LEFT JOIN invigilator_assignment ia
                ON es.schedule_id = ia.schedule_id

            LEFT JOIN teacher t
                ON ia.teacher_id = t.teacher_id

            LEFT JOIN users u
                ON t.user_id = u.user_id

            ORDER BY
                es.exam_date,
                es.start_time;

        `;

        const result = await pool.query(query);

        return res.status(200).json({

            status: "success",

            schedule: result.rows

        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({

            status: "error",

            message: "Failed to fetch schedule."

        });

    }

};
/* ===========================================================
   CREATE SCHEDULE
=========================================================== */

export const createSchedule = async (req, res) => {

    const {
        exam_id,
        lab_id,
        user_id,
        exam_date,
        start_time,
        end_time
    } = req.body;

    try {

        // ==========================
        // Validate input
        // ==========================

        if (
            !exam_id ||
            !lab_id ||
            !user_id ||
            !exam_date ||
            !start_time ||
            !end_time
        ) {
            return res.status(400).json({
                status: "error",
                message: "All fields are required."
            });
        }

        // ==========================
        // Get coordinator
        // ==========================

        const coordinatorResult = await pool.query(
            `
            SELECT coordinator_id
            FROM coordinator
            WHERE user_id = $1
            `,
            [user_id]
        );

        if (coordinatorResult.rows.length === 0) {
            return res.status(403).json({
                status: "error",
                message: "Coordinator not found."
            });
        }

        const coordinator_id = coordinatorResult.rows[0].coordinator_id;

        // ==========================
        // Check exam already scheduled
        // ==========================

        const examExists = await pool.query(
            `
            SELECT schedule_id
            FROM exam_schedule
            WHERE exam_id = $1
            `,
            [exam_id]
        );

        if (examExists.rows.length > 0) {
            return res.status(409).json({
                status: "error",
                message: "This exam has already been scheduled."
            });
        }

        // ==========================
        // Check lab conflict
        // ==========================

        const labConflict = await pool.query(
            `
            SELECT schedule_id
            FROM exam_schedule
            WHERE
                lab_id = $1
                AND exam_date = $2
                AND (
                    ($3 BETWEEN start_time AND end_time)
                    OR
                    ($4 BETWEEN start_time AND end_time)
                    OR
                    (start_time BETWEEN $3 AND $4)
                )
            `,
            [
                lab_id,
                exam_date,
                start_time,
                end_time
            ]
        );

        if (labConflict.rows.length > 0) {
            return res.status(409).json({
                status: "error",
                message: "Selected lab is already booked during this time."
            });
        }

        // ==========================
        // Create Schedule
        // ==========================

        const scheduleResult = await pool.query(
            `
            INSERT INTO exam_schedule
            (
                exam_id,
                lab_id,
                coordinator_id,
                exam_date,
                start_time,
                end_time,
                status
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                'Published'
            )
            RETURNING *
            `,
            [
                exam_id,
                lab_id,
                coordinator_id,
                exam_date,
                start_time,
                end_time
            ]
        );

        const schedule_id = scheduleResult.rows[0].schedule_id;

        // ==========================
        // Automatically assign
        // the course's lab teacher
        // as invigilator
        // ==========================

        const teacherResult = await pool.query(
            `
            SELECT e.teacher_id
            FROM exam e
            WHERE e.exam_id = $1
            `,
            [exam_id]
        );

        if (teacherResult.rows.length > 0) {

            await pool.query(
                `
                INSERT INTO invigilator_assignment
                (
                    schedule_id,
                    teacher_id,
                    assignment_status
                )
                VALUES
                (
                    $1,
                    $2,
                    'Confirmed'
                )
                `,
                [
                    schedule_id,
                    teacherResult.rows[0].teacher_id
                ]
            );

        }

        return res.status(201).json({
            status: "success",
            message: "Exam scheduled successfully.",
            schedule: scheduleResult.rows[0]
        });

    } catch (error) {

        console.error("Create Schedule Error:", error);

        return res.status(500).json({
            status: "error",
            message: "Failed to create exam schedule."
        });

    }

};
/* ===========================================================
   UPDATE SCHEDULE
=========================================================== */

export const updateSchedule = async (req, res) => {

    const { schedule_id } = req.params;

    const {
        lab_id,
        exam_date,
        start_time,
        end_time
    } = req.body;

    try {

        const scheduleResult = await pool.query(
            `
            SELECT *
            FROM exam_schedule
            WHERE schedule_id = $1
            `,
            [schedule_id]
        );

        if (scheduleResult.rows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Schedule not found."
            });
        }

        const labConflict = await pool.query(
            `
            SELECT schedule_id
            FROM exam_schedule
            WHERE
                lab_id = $1
                AND exam_date = $2
                AND schedule_id <> $3
                AND (
                    ($4 BETWEEN start_time AND end_time)
                    OR
                    ($5 BETWEEN start_time AND end_time)
                    OR
                    (start_time BETWEEN $4 AND $5)
                )
            `,
            [
                lab_id,
                exam_date,
                schedule_id,
                start_time,
                end_time
            ]
        );

        if (labConflict.rows.length > 0) {

            return res.status(409).json({

                status: "error",

                message: "Lab is already occupied during this time."

            });

        }

        const update = await pool.query(

            `
            UPDATE exam_schedule

            SET

                lab_id=$1,
                exam_date=$2,
                start_time=$3,
                end_time=$4,
                updated_at=NOW()

            WHERE schedule_id=$5

            RETURNING *
            `,

            [

                lab_id,

                exam_date,

                start_time,

                end_time,

                schedule_id

            ]

        );

        res.status(200).json({

            status: "success",

            message: "Schedule updated successfully.",

            schedule: update.rows[0]

        });

    }

    catch (error) {

        console.error(error);

        res.status(500).json({

            status: "error",

            message: "Unable to update schedule."

        });

    }

};



/* ===========================================================
   DELETE SCHEDULE
=========================================================== */

export const deleteSchedule = async (req, res) => {

    const { schedule_id } = req.params;

    try {

        const result = await pool.query(

            `
            DELETE FROM exam_schedule
            WHERE schedule_id=$1
            RETURNING *
            `,

            [schedule_id]

        );

        if (result.rows.length === 0) {

            return res.status(404).json({

                status: "error",

                message: "Schedule not found."

            });

        }

        res.status(200).json({

            status: "success",

            message: "Schedule deleted successfully."

        });

    }

    catch (error) {

        console.error(error);

        res.status(500).json({

            status: "error",

            message: "Unable to delete schedule."

        });

    }

};



/* ===========================================================
   PUBLISH SCHEDULE
=========================================================== */

export const publishSchedule = async (req, res) => {

    const { schedule_id } = req.params;

    try {

        const result = await pool.query(

            `
            UPDATE exam_schedule

            SET

                status='Published',
                updated_at=NOW()

            WHERE schedule_id=$1

            RETURNING *
            `,

            [schedule_id]

        );

        if (result.rows.length === 0) {

            return res.status(404).json({

                status: "error",

                message: "Schedule not found."

            });

        }

        res.status(200).json({

            status: "success",

            message: "Schedule published successfully.",

            schedule: result.rows[0]

        });

    }

    catch (error) {

        console.error(error);

        res.status(500).json({

            status: "error",

            message: "Unable to publish schedule."

        });

    }

};



/* ===========================================================
   AVAILABLE LABS
=========================================================== */

export const getAvailableLabs = async (req, res) => {

    const {

        exam_date,

        start_time,

        end_time

    } = req.query;

    try {

        const result = await pool.query(

            `
            SELECT *

            FROM lab

            WHERE lab_id NOT IN (

                SELECT lab_id

                FROM exam_schedule

                WHERE

                    exam_date=$1

                    AND (

                        ($2 BETWEEN start_time AND end_time)

                        OR

                        ($3 BETWEEN start_time AND end_time)

                        OR

                        (start_time BETWEEN $2 AND $3)

                    )

            )

            ORDER BY lab_name
            `,

            [

                exam_date,

                start_time,

                end_time

            ]

        );

        res.status(200).json({

            status: "success",

            labs: result.rows

        });

    }

    catch (error) {

        console.error(error);

        res.status(500).json({

            status: "error",

            message: "Unable to fetch available labs."

        });

    }

};


/* ===========================================================
   CREATE BROADCAST
=========================================================== */

// Maps the friendly labels sent by the frontend dropdown to the
// broadcast_announcement.audience_type CHECK constraint values
// (audience_type is varchar(20), so these MUST stay short).
const AUDIENCE_MAP = {
    "All Students": "AllStudents",
    "CS Department Only": "Department",
    "Invigilators Only": "InvigilatorsOnly",
    "All Teachers & Faculty": "AllTeachers",
};

const VALID_AUDIENCES = [
    "AllStudents",
    "Department",
    "InvigilatorsOnly",
    "AllTeachers",
    "Specific"
];

export const broadcastAnnouncement = async (req, res) => {

    const {

        user_id,

        subject,

        message,

        audience_type,

        target_user_id

    } = req.body;

    try {

        if (!user_id || !subject?.trim() || !message?.trim() || !audience_type) {
            return res.status(400).json({
                status: "error",
                message: "All fields are required."
            });
        }

        // Translate the frontend's friendly label into the short
        // DB-safe code (falls back to the raw value in case it's
        // already sent in the mapped form).
        const resolvedAudience = AUDIENCE_MAP[audience_type] || audience_type;

        if (!VALID_AUDIENCES.includes(resolvedAudience)) {
            return res.status(400).json({
                status: "error",
                message: "Invalid audience type."
            });
        }

        if (resolvedAudience === "Specific" && !target_user_id) {
            return res.status(400).json({
                status: "error",
                message: "Please select a specific user to message."
            });
        }

        // For department-scoped broadcasts, resolve the coordinator's
        // own department automatically.
        let department_id = null;

        if (resolvedAudience === "Department") {

            const deptResult = await pool.query(
                `
                SELECT department_id
                FROM coordinator
                WHERE user_id = $1
                `,
                [user_id]
            );

            department_id = deptResult.rows[0]?.department_id || null;

            if (!department_id) {
                return res.status(400).json({
                    status: "error",
                    message: "Could not resolve coordinator's department."
                });
            }
        }

        const result = await pool.query(

            `
            INSERT INTO broadcast_announcement
            (
                sender_user_id,
                subject,
                message,
                audience_type,
                target_user_id,
                department_id
            )

            VALUES

            ($1,$2,$3,$4,$5,$6)

            RETURNING announcement_id, subject, message, audience_type, created_at
            `,

            [

                user_id,

                subject.trim(),

                message.trim(),

                resolvedAudience,

                resolvedAudience === "Specific" ? target_user_id : null,

                department_id

            ]

        );

        return res.status(200).json({

            status: "success",

            message: "Broadcast announcement sent.",

            announcement: result.rows[0]

        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({

            status: "error",

            message: "Failed to send announcement."

        });

    }

};

/* ===========================================================
   SEARCH RECIPIENTS (for "Message Specific User")
=========================================================== */

export const getRecipients = async (req, res) => {

    const search = (req.query.search || "").trim();

    if (search.length < 2) {
        return res.status(200).json({
            status: "success",
            users: []
        });
    }

    try {

        const result = await pool.query(

            `
            SELECT
                u.user_id,
                u.first_name,
                u.last_name,
                u.email,
                u.user_type,
                s.registration_no
            FROM users u
            LEFT JOIN student s ON s.user_id = u.user_id
            WHERE
                u.is_active = TRUE
                AND (
                    u.first_name ILIKE $1
                    OR u.last_name ILIKE $1
                    OR u.email ILIKE $1
                    OR s.registration_no ILIKE $1
                )
            ORDER BY u.first_name ASC
            LIMIT 15
            `,

            [`%${search}%`]

        );

        return res.status(200).json({

            status: "success",

            users: result.rows

        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({

            status: "error",

            message: "Failed to search users."

        });

    }

};