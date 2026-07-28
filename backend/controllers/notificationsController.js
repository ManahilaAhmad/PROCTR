import pool from "../db.js";

/* ===========================================================
   Resolve what a user should see:
   - which audience_types apply to them
   - their department_id (for "Department" scoped broadcasts)
=========================================================== */
async function resolveUserContext(userId) {

    const userResult = await pool.query(
        `SELECT user_type FROM users WHERE user_id = $1`,
        [userId]
    );

    if (userResult.rows.length === 0) return null;

    const userType = userResult.rows[0].user_type;
    let departmentId = null;
    let audienceTypes = [];

    if (userType === "teacher") {

        audienceTypes = ["AllTeachers", "InvigilatorsOnly"];

        const dept = await pool.query(
            `SELECT department_id FROM teacher WHERE user_id = $1`,
            [userId]
        );
        departmentId = dept.rows[0]?.department_id || null;

    } else if (userType === "student") {

        audienceTypes = ["AllStudents"];

        const dept = await pool.query(
            `
            SELECT p.department_id
            FROM student s
            JOIN batch b ON s.batch_id = b.batch_id
            JOIN program p ON b.program_id = p.program_id
            WHERE s.user_id = $1
            `,
            [userId]
        );
        departmentId = dept.rows[0]?.department_id || null;

    } else if (userType === "coordinator" || userType === "hod" || userType === "director" || userType === "dec") {

        audienceTypes = ["AllTeachers", "InvigilatorsOnly"];

        if (userType === "coordinator" || userType === "hod") {
            const dept = await pool.query(
                `SELECT department_id FROM ${userType} WHERE user_id = $1`,
                [userId]
            );
            departmentId = dept.rows[0]?.department_id || null;
        }
    }

    return { userType, departmentId, audienceTypes };
}

/* ===========================================================
   GET NOTIFICATIONS FOR A USER
   (combines broadcasts targeted at them + their personal notifications)
=========================================================== */
export const getMyNotifications = async (req, res) => {

    const { userId } = req.params;

    try {

        const context = await resolveUserContext(userId);

        if (!context) {
            return res.status(404).json({ status: "error", message: "User not found." });
        }

        const { departmentId, audienceTypes } = context;

        // Broadcasts: department-wide, role-wide, or "Specific" (targeted at exactly this user)
        const broadcastResult = await pool.query(
            `
            SELECT
                ba.announcement_id,
                ba.subject,
                ba.message,
                ba.audience_type,
                ba.department_id,
                ba.created_at,
                u.first_name || ' ' || u.last_name AS sender_name,
                u.user_type AS sender_role,
                (nr.notification_read_id IS NOT NULL) AS is_read
            FROM broadcast_announcement ba
            LEFT JOIN users u ON ba.sender_user_id = u.user_id
            LEFT JOIN notification_read nr
                ON nr.announcement_id = ba.announcement_id
                AND nr.user_id = $1
            WHERE
                ba.is_published = TRUE
                AND (
                    ba.audience_type = ANY($2::varchar[])
                    OR (ba.audience_type = 'Department' AND ba.department_id = $3)
                    OR (ba.audience_type = 'Specific' AND ba.target_user_id = $1)
                )
            ORDER BY ba.created_at DESC
            LIMIT 50
            `,
            [userId, audienceTypes, departmentId]
        );

        // Personal, system-generated notifications (no human sender — user_notification has no sender column)
        const personalResult = await pool.query(
            `
            SELECT
                notification_id,
                title AS subject,
                message,
                notification_type,
                is_read,
                created_at
            FROM user_notification
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 50
            `,
            [userId]
        );

        const broadcasts = broadcastResult.rows.map(r => ({
            id: `b-${r.announcement_id}`,
            source: "broadcast",
            title: r.subject,
            message: r.message,
            created_at: r.created_at,
            is_read: r.is_read,
            sender_name: r.sender_name || "System",
            sender_role: r.sender_role || null,
            audience_type: r.audience_type,
            // Only "Specific" broadcasts were sent directly to this exact user;
            // everything else (Department / AllTeachers / AllStudents / InvigilatorsOnly)
            // was sent to a group this user happens to belong to.
            is_personal: r.audience_type === "Specific",
            scope_label:
                r.audience_type === "Specific" ? "Sent directly to you" :
                r.audience_type === "Department" ? "Department broadcast" :
                r.audience_type === "AllTeachers" ? "Sent to all teachers" :
                r.audience_type === "AllStudents" ? "Sent to all students" :
                r.audience_type === "InvigilatorsOnly" ? "Sent to invigilators" :
                r.audience_type,
        }));

        const personal = personalResult.rows.map(r => ({
            id: `n-${r.notification_id}`,
            source: "personal",
            title: r.subject,
            message: r.message,
            created_at: r.created_at,
            is_read: r.is_read,
            sender_name: "System",
            sender_role: null,
            notification_type: r.notification_type, // Exam / Schedule / Approved / AI / MOSS / Invigilation
            audience_type: null,
            is_personal: true, // always targeted at exactly this user
            scope_label: `Automated · ${r.notification_type}`,
        }));

        const combined = [...broadcasts, ...personal].sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );

        const unreadCount = combined.filter(n => !n.is_read).length;

        return res.status(200).json({
            status: "success",
            notifications: combined,
            unread_count: unreadCount,
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            status: "error",
            message: "Failed to fetch notifications.",
        });
    }
};

/* ===========================================================
   MARK ONE NOTIFICATION READ
   id looks like "b-12" (broadcast) or "n-45" (personal)
=========================================================== */
export const markNotificationRead = async (req, res) => {

    const { id } = req.params;
    const { user_id } = req.body;

    if (!id || !user_id) {
        return res.status(400).json({ status: "error", message: "Missing id or user_id." });
    }

    const [prefix, rawId] = id.split("-");

    try {

        if (prefix === "b") {

            await pool.query(
                `
                INSERT INTO notification_read (announcement_id, user_id)
                VALUES ($1, $2)
                ON CONFLICT (announcement_id, user_id) DO NOTHING
                `,
                [rawId, user_id]
            );

        } else if (prefix === "n") {

            await pool.query(
                `UPDATE user_notification SET is_read = TRUE WHERE notification_id = $1 AND user_id = $2`,
                [rawId, user_id]
            );

        } else {
            return res.status(400).json({ status: "error", message: "Invalid notification id." });
        }

        return res.status(200).json({ status: "success" });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: "error", message: "Failed to mark as read." });
    }
};

/* ===========================================================
   MARK ALL NOTIFICATIONS READ FOR A USER
=========================================================== */
export const markAllNotificationsRead = async (req, res) => {

    const { userId } = req.params;

    try {

        const context = await resolveUserContext(userId);

        if (!context) {
            return res.status(404).json({ status: "error", message: "User not found." });
        }

        const { departmentId, audienceTypes } = context;

        await pool.query(
            `
            INSERT INTO notification_read (announcement_id, user_id)
            SELECT ba.announcement_id, $1
            FROM broadcast_announcement ba
            WHERE
                ba.is_published = TRUE
                AND (
                    ba.audience_type = ANY($2::varchar[])
                    OR (ba.audience_type = 'Department' AND ba.department_id = $3)
                    OR (ba.audience_type = 'Specific' AND ba.target_user_id = $1)
                )
            ON CONFLICT (announcement_id, user_id) DO NOTHING
            `,
            [userId, audienceTypes, departmentId]
        );

        await pool.query(
            `UPDATE user_notification SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`,
            [userId]
        );

        return res.status(200).json({ status: "success" });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: "error", message: "Failed to mark all as read." });
    }
};