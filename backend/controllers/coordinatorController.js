import pool from "../db.js";
import ensureCoordinatorTimetableSchema from "../service/coordinatorTimetableSchema.js";

function isValidTime(value) {
    return /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(String(value || ''));
}

async function getCoordinatorDepartmentId(req) {
    if (['admin', 'director', 'dec'].includes(req.sessionUser?.role)) return null;
    const result = await pool.query('SELECT department_id FROM coordinator WHERE user_id=$1', [req.sessionUser.sub]);
    return result.rows[0]?.department_id || 0;
}

async function linkApprovedExamToTimetable(client, timetable) {
    const examResult = await client.query(`
        SELECT exam_id
        FROM exam
        WHERE course_offering_id=$1 AND exam_type=$2 AND status='Approved'
        LIMIT 1
    `, [timetable.course_offering_id, timetable.exam_type]);
    if (!examResult.rowCount) return null;

    const examId = examResult.rows[0].exam_id;
    const existingSchedule = await client.query(
        'SELECT schedule_id FROM exam_schedule WHERE exam_id=$1',
        [examId]
    );
    let scheduleId = existingSchedule.rows[0]?.schedule_id;
    if (scheduleId) {
        await client.query(`
            UPDATE exam_schedule
            SET lab_id=$1,coordinator_id=$2,exam_date=$3,start_time=$4,end_time=$5,status='Published',updated_at=NOW()
            WHERE schedule_id=$6
        `, [timetable.lab_id, timetable.coordinator_id, timetable.exam_date, timetable.start_time, timetable.end_time, scheduleId]);
    } else {
        const createdSchedule = await client.query(`
            INSERT INTO exam_schedule (exam_id, lab_id, coordinator_id, exam_date, start_time, end_time, status)
            VALUES ($1,$2,$3,$4,$5,$6,'Published')
            RETURNING schedule_id
        `, [examId, timetable.lab_id, timetable.coordinator_id, timetable.exam_date, timetable.start_time, timetable.end_time]);
        scheduleId = createdSchedule.rows[0].schedule_id;
    }
    await client.query(`
        UPDATE coordinator_exam_timetable
        SET linked_exam_id=$1, linked_schedule_id=$2, updated_at=NOW()
        WHERE timetable_id=$3
    `, [examId, scheduleId, timetable.timetable_id]);
    return scheduleId;
}

async function notifyTimetableRecipients(courseOfferingId, timetable, title = 'Exam Timetable Published') {
    const offering = await pool.query(`
        SELECT t.user_id AS teacher_user_id,c.course_code,p.program_code,b.batch_name,s.section_name
        FROM course_offering co
        JOIN course c ON c.course_id=co.course_id
        JOIN program p ON p.program_id=c.program_id
        JOIN section s ON s.section_id=co.section_id
        JOIN batch b ON b.batch_id=s.batch_id
        JOIN teacher t ON t.teacher_id=co.teacher_id
        WHERE co.course_offering_id=$1
    `, [courseOfferingId]);
    if (!offering.rowCount) throw new Error(`Course offering ${courseOfferingId} was not found while notifying timetable recipients.`);
    const details = offering.rows[0];
    const message = `${details.course_code} ${timetable.exam_type} for ${details.program_code} ${details.batch_name} Section ${details.section_name} is ${title.endsWith('Updated') ? 'updated' : 'scheduled'} for ${timetable.exam_date} from ${String(timetable.start_time).slice(0, 5)} to ${String(timetable.end_time).slice(0, 5)}.`;
    await pool.query(`
        INSERT INTO user_notification (user_id,title,message,notification_type)
        SELECT recipients.user_id,$2,$3,'Exam'
        FROM (
            SELECT $1::int AS user_id
            UNION
            SELECT u.user_id
            FROM enrollment en
            JOIN student st ON st.student_id=en.student_id
            JOIN users u ON u.user_id=st.user_id
            WHERE en.course_offering_id=$4 AND en.status='Active'
        ) recipients
    `, [details.teacher_user_id, title, message, courseOfferingId]);
}

async function coordinatorOwnsSchedule(req, scheduleId) {
    if (req.sessionUser?.role === 'admin') return true;
    const result = await pool.query(`
        SELECT 1 FROM exam_schedule es
        JOIN exam e ON e.exam_id=es.exam_id
        JOIN course_offering co ON co.course_offering_id=e.course_offering_id
        JOIN course c ON c.course_id=co.course_id
        JOIN program p ON p.program_id=c.program_id
        JOIN coordinator cr ON cr.user_id=$2
        WHERE es.schedule_id=$1 AND p.department_id=cr.department_id
    `, [scheduleId, req.sessionUser.sub]);
    return result.rowCount > 0;
}

/* ===========================================================
   GET ALL LABS
=========================================================== */
export const getLabs = async (req, res) => {
    try {
        const departmentId = await getCoordinatorDepartmentId(req);
        const query = `
            SELECT
                lab_id,
                lab_name,
                total_pcs,
                capacity,
                network_range,
                status
            FROM lab
            WHERE ($1::int IS NULL OR department_id=$1)
            ORDER BY lab_name ASC;
        `;

        const result = await pool.query(query, [departmentId]);

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
        const departmentId = await getCoordinatorDepartmentId(req);

        const query = `
            SELECT
                e.exam_id,
                e.exam_type,
                e.total_marks,
                e.duration,
                e.proposed_date,
                c.course_code,
                c.course_title,
                s.section_name
            FROM exam e

            JOIN course_offering co
                ON e.course_offering_id = co.course_offering_id

            JOIN course c
                ON co.course_id = c.course_id

            JOIN program p
                ON c.program_id = p.program_id

            JOIN section s
                ON co.section_id = s.section_id

            LEFT JOIN exam_schedule es
                ON e.exam_id = es.exam_id

            WHERE e.status='Approved'
              AND es.schedule_id IS NULL
              AND ($1::int IS NULL OR p.department_id=$1)

            ORDER BY c.course_code;
        `;

        const result = await pool.query(query, [departmentId]);

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

export const getSchedulableOfferings = async (req, res) => {
    try {
        await ensureCoordinatorTimetableSchema();
        const departmentId = await getCoordinatorDepartmentId(req);
        const result = await pool.query(`
            SELECT co.course_offering_id, co.teacher_id, co.offering_type,
                   c.course_code, c.course_title,
                   p.program_id, p.program_name, p.program_code,
                   b.batch_id, b.batch_name,
                   s.section_id, s.section_name,
                   u.first_name || ' ' || u.last_name AS teacher_name
            FROM course_offering co
            JOIN course c ON c.course_id=co.course_id
            JOIN program p ON p.program_id=c.program_id
            JOIN section s ON s.section_id=co.section_id
            JOIN batch b ON b.batch_id=s.batch_id
            JOIN teacher t ON t.teacher_id=co.teacher_id
            JOIN users u ON u.user_id=t.user_id
            WHERE co.offering_type='Lab'
              AND ($1::int IS NULL OR p.department_id=$1)
            ORDER BY p.program_code,b.batch_name,s.section_name,c.course_code
        `, [departmentId]);
        res.status(200).json({ status: 'success', offerings: result.rows });
    } catch (error) {
        console.error('Error fetching coordinator scheduling options:', error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch course offerings.' });
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
        await ensureCoordinatorTimetableSchema();
        const departmentId = await getCoordinatorDepartmentId(req);
        const [planned, legacy] = await Promise.all([
            pool.query(`
                SELECT cet.timetable_id AS schedule_id, cet.timetable_id,
                       cet.linked_schedule_id, cet.linked_exam_id AS exam_id,
                       cet.course_offering_id, cet.exam_type, cet.exam_date,
                       cet.start_time, cet.end_time, cet.status,
                       c.course_code, c.course_title, p.program_id, p.program_name, p.program_code,
                       b.batch_id, b.batch_name, s.section_id, s.section_name,
                       l.lab_id, l.lab_name, l.capacity, u.first_name || ' ' || u.last_name AS teacher_name,
                       COALESCE(u_inv.first_name || ' ' || u_inv.last_name, 'Not yet assigned') AS invigilator_name,
                       ia.assignment_status, TRUE AS is_independent_schedule
                FROM coordinator_exam_timetable cet
                JOIN course_offering co ON co.course_offering_id=cet.course_offering_id
                JOIN course c ON c.course_id=co.course_id
                JOIN program p ON p.program_id=c.program_id
                JOIN section s ON s.section_id=co.section_id
                JOIN batch b ON b.batch_id=s.batch_id
                JOIN teacher t ON t.teacher_id=co.teacher_id
                JOIN users u ON u.user_id=t.user_id
                JOIN lab l ON l.lab_id=cet.lab_id
                LEFT JOIN exam_schedule es ON es.schedule_id=cet.linked_schedule_id
                LEFT JOIN invigilator_assignment ia ON ia.schedule_id=es.schedule_id
                LEFT JOIN teacher t_inv ON t_inv.teacher_id=ia.teacher_id
                LEFT JOIN users u_inv ON u_inv.user_id=t_inv.user_id
                WHERE cet.status='Published' AND ($1::int IS NULL OR p.department_id=$1)
            `, [departmentId]),
            pool.query(`
                SELECT es.schedule_id, NULL::int AS timetable_id, es.schedule_id AS linked_schedule_id,
                       e.exam_id, co.course_offering_id, e.exam_type,
                       es.exam_date, es.start_time, es.end_time, es.status,
                       c.course_code, c.course_title, p.program_id, p.program_name, p.program_code,
                       b.batch_id, b.batch_name, s.section_id, s.section_name,
                       l.lab_id, l.lab_name, l.capacity, u.first_name || ' ' || u.last_name AS teacher_name,
                       COALESCE(u_inv.first_name || ' ' || u_inv.last_name, 'Not yet assigned') AS invigilator_name,
                       ia.assignment_status, FALSE AS is_independent_schedule
                FROM exam_schedule es
                JOIN exam e ON e.exam_id=es.exam_id
                JOIN course_offering co ON co.course_offering_id=e.course_offering_id
                JOIN course c ON c.course_id=co.course_id
                JOIN program p ON p.program_id=c.program_id
                JOIN section s ON s.section_id=co.section_id
                JOIN batch b ON b.batch_id=s.batch_id
                JOIN teacher t ON t.teacher_id=co.teacher_id
                JOIN users u ON u.user_id=t.user_id
                JOIN lab l ON l.lab_id=es.lab_id
                LEFT JOIN invigilator_assignment ia ON ia.schedule_id=es.schedule_id
                LEFT JOIN teacher t_inv ON t_inv.teacher_id=ia.teacher_id
                LEFT JOIN users u_inv ON u_inv.user_id=t_inv.user_id
                WHERE ($1::int IS NULL OR p.department_id=$1)
                  AND es.status <> 'Cancelled'
                  AND NOT EXISTS (
                    SELECT 1 FROM coordinator_exam_timetable cet
                    WHERE cet.linked_schedule_id=es.schedule_id
                  )
            `, [departmentId])
        ]);
        const rows = [...planned.rows, ...legacy.rows].sort((a, b) =>
            String(a.exam_date).localeCompare(String(b.exam_date)) ||
            String(a.start_time).localeCompare(String(b.start_time))
        );

        return res.status(200).json({

            status: "success",

            schedule: rows

        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({

            status: "error",

            message: "Failed to fetch schedule."

        });

    }

};

export const createIndependentTimetable = async (req, res) => {
    const { course_offering_id, exam_type, lab_id, exam_date, start_time, end_time } = req.body;
    const examTypes = ['LabMid', 'LabFinal', 'LabPractical'];
    const [year, month, day] = String(exam_date || '').split('-').map(Number);
    const requestedDate = new Date(year, month - 1, day);
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(String(exam_date || '')) &&
        !Number.isNaN(requestedDate.getTime()) &&
        requestedDate.getFullYear() === year && requestedDate.getMonth() === month - 1 && requestedDate.getDate() === day;
    const validTimes = isValidTime(start_time) && isValidTime(end_time);
    if (!/^\d+$/.test(String(course_offering_id || '')) || !examTypes.includes(exam_type) ||
        !/^\d+$/.test(String(lab_id || '')) || !validDate || !validTimes || end_time <= start_time) {
        return res.status(400).json({ status: 'error', message: 'Choose a course, exam type, lab, date, and valid time range.' });
    }
    if (requestedDate < new Date(new Date().toDateString())) {
        return res.status(400).json({ status: 'error', message: 'Exam date cannot be scheduled in the past.' });
    }

    const client = await pool.connect();
    let timetableToNotify;
    try {
        await ensureCoordinatorTimetableSchema();
        await client.query('BEGIN');
        const departmentId = await getCoordinatorDepartmentId(req);
        const offering = await client.query(`
            SELECT co.course_offering_id, co.teacher_id, p.department_id, c.course_code, c.course_title,
                   s.section_id, s.section_name, p.program_name, p.program_code, b.batch_name,
                   t.user_id AS teacher_user_id
            FROM course_offering co
            JOIN course c ON c.course_id=co.course_id
            JOIN program p ON p.program_id=c.program_id
            JOIN section s ON s.section_id=co.section_id
            JOIN batch b ON b.batch_id=s.batch_id
            JOIN teacher t ON t.teacher_id=co.teacher_id
            WHERE co.course_offering_id=$1 AND co.offering_type='Lab'
              AND ($2::int IS NULL OR p.department_id=$2)
        `, [course_offering_id, departmentId]);
        if (!offering.rowCount) {
            await client.query('ROLLBACK');
            return res.status(403).json({ status: 'error', message: 'This course offering is not in your department.' });
        }
        const lab = await client.query(
            'SELECT lab_id FROM lab WHERE lab_id=$1 AND department_id=$2 AND status=\'Available\'',
            [lab_id, offering.rows[0].department_id]
        );
        if (!lab.rowCount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ status: 'error', message: 'Choose an available lab from the course offering’s department.' });
        }

        const coordinator = req.sessionUser?.role === 'admin'
            ? await client.query('SELECT coordinator_id FROM coordinator WHERE department_id=$1 ORDER BY coordinator_id LIMIT 1', [offering.rows[0].department_id])
            : await client.query('SELECT coordinator_id FROM coordinator WHERE user_id=$1 AND department_id=$2', [req.sessionUser.sub, offering.rows[0].department_id]);
        if (!coordinator.rowCount) {
            await client.query('ROLLBACK');
            return res.status(403).json({ status: 'error', message: 'No coordinator is assigned to this department.' });
        }

        const duplicate = await client.query(`
            SELECT 1 FROM coordinator_exam_timetable
            WHERE course_offering_id=$1 AND exam_type=$2 AND status='Published'
            UNION ALL
            SELECT 1 FROM exam e JOIN exam_schedule es ON es.exam_id=e.exam_id
            WHERE e.course_offering_id=$1 AND e.exam_type=$2 AND es.status <> 'Cancelled'
            LIMIT 1
        `, [course_offering_id, exam_type]);
        if (duplicate.rowCount) {
            await client.query('ROLLBACK');
            return res.status(409).json({ status: 'error', message: 'This exam is already scheduled for that course section.' });
        }

        const labConflict = await client.query(`
            SELECT 1 FROM exam_schedule
            WHERE lab_id=$1 AND exam_date=$2 AND status <> 'Cancelled'
              AND start_time < $4 AND end_time > $3
            UNION ALL
            SELECT 1 FROM coordinator_exam_timetable
            WHERE lab_id=$1 AND exam_date=$2 AND status='Published'
              AND start_time < $4 AND end_time > $3
            LIMIT 1
        `, [lab_id, exam_date, start_time, end_time]);
        if (labConflict.rowCount) {
            await client.query('ROLLBACK');
            return res.status(409).json({ status: 'error', message: 'That lab is already booked during this time.' });
        }

        const sectionConflict = await client.query(`
            SELECT 1
            FROM exam_schedule es
            JOIN exam e ON e.exam_id=es.exam_id
            JOIN course_offering co ON co.course_offering_id=e.course_offering_id
            WHERE co.section_id=$1 AND es.exam_date=$2 AND es.status <> 'Cancelled'
              AND es.start_time < $4 AND es.end_time > $3
            UNION ALL
            SELECT 1
            FROM coordinator_exam_timetable cet
            JOIN course_offering co ON co.course_offering_id=cet.course_offering_id
            WHERE co.section_id=$1 AND cet.exam_date=$2 AND cet.status='Published'
              AND cet.start_time < $4 AND cet.end_time > $3
            LIMIT 1
        `, [offering.rows[0].section_id, exam_date, start_time, end_time]);
        if (sectionConflict.rowCount) {
            await client.query('ROLLBACK');
            return res.status(409).json({ status: 'error', message: `This section already has an exam during that time (${offering.rows[0].section_name}).` });
        }

        const inserted = await client.query(`
            INSERT INTO coordinator_exam_timetable
                (course_offering_id, exam_type, lab_id, coordinator_id, exam_date, start_time, end_time)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            RETURNING timetable_id
        `, [course_offering_id, exam_type, lab_id, coordinator.rows[0].coordinator_id, exam_date, start_time, end_time]);
        const timetable = {
            timetable_id: inserted.rows[0].timetable_id,
            course_offering_id: Number(course_offering_id),
            exam_type,
            lab_id: Number(lab_id),
            coordinator_id: coordinator.rows[0].coordinator_id,
            exam_date,
            start_time,
            end_time
        };
        await linkApprovedExamToTimetable(client, timetable);
        await client.query('COMMIT');
        timetableToNotify = timetable;
        res.status(201).json({ status: 'success', message: 'Exam timetable published independently of the exam paper review.', timetable });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        if (error.code === '23505') {
            return res.status(409).json({ status: 'error', message: 'This exam is already scheduled for that course section.' });
        }
        console.error('Failed to create independent exam timetable:', error);
        return res.status(500).json({ status: 'error', message: 'Failed to publish exam timetable.' });
    } finally {
        client.release();
    }

    if (timetableToNotify) {
        try {
            await notifyTimetableRecipients(course_offering_id, timetableToNotify);
        } catch (error) {
            console.error('Timetable saved, but notifications could not be sent:', error);
        }
    }
};

export const updateIndependentTimetable = async (req, res) => {
    const { timetable_id } = req.params;
    const { lab_id, exam_date, start_time, end_time } = req.body;
    const [year, month, day] = String(exam_date || '').split('-').map(Number);
    const requestedDate = new Date(year, month - 1, day);
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(String(exam_date || '')) &&
        !Number.isNaN(requestedDate.getTime()) &&
        requestedDate.getFullYear() === year && requestedDate.getMonth() === month - 1 && requestedDate.getDate() === day;
    const validTimes = isValidTime(start_time) && isValidTime(end_time);
    if (!/^\d+$/.test(String(timetable_id || '')) || !/^\d+$/.test(String(lab_id || '')) ||
        !validDate || !validTimes || end_time <= start_time) {
        return res.status(400).json({ status: 'error', message: 'Choose a lab, date, and valid time range.' });
    }
    if (requestedDate < new Date(new Date().toDateString())) {
        return res.status(400).json({ status: 'error', message: 'Exam date cannot be scheduled in the past.' });
    }
    const client = await pool.connect();
    let timetableToNotify;
    try {
        await ensureCoordinatorTimetableSchema();
        const departmentId = await getCoordinatorDepartmentId(req);
        await client.query('BEGIN');
        const details = await client.query(`
            SELECT cet.linked_schedule_id,cet.course_offering_id,cet.exam_type,co.section_id,p.department_id
            FROM coordinator_exam_timetable cet
            JOIN course_offering co ON co.course_offering_id=cet.course_offering_id
            JOIN course c ON c.course_id=co.course_id
            JOIN program p ON p.program_id=c.program_id
            WHERE cet.timetable_id=$1 AND cet.status='Published'
              AND ($2::int IS NULL OR p.department_id=$2)
        `, [timetable_id, departmentId]);
        if (!details.rowCount) {
            await client.query('ROLLBACK');
            return res.status(404).json({ status: 'error', message: 'Timetable entry not found or lab is outside your department.' });
        }
        const current = details.rows[0];
        const lab = await client.query(
            'SELECT 1 FROM lab WHERE lab_id=$1 AND department_id=$2 AND status=\'Available\'',
            [lab_id, current.department_id]
        );
        if (!lab.rowCount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ status: 'error', message: 'Choose an available lab from the course offering’s department.' });
        }
        const labConflict = await client.query(`
            SELECT 1 FROM exam_schedule
            WHERE lab_id=$1 AND exam_date=$2 AND status <> 'Cancelled'
              AND ($5::int IS NULL OR schedule_id <> $5)
              AND start_time < $4 AND end_time > $3
            UNION ALL
            SELECT 1 FROM coordinator_exam_timetable
            WHERE lab_id=$1 AND exam_date=$2 AND status='Published'
              AND timetable_id <> $6
              AND start_time < $4 AND end_time > $3
            LIMIT 1
        `, [lab_id, exam_date, start_time, end_time, current.linked_schedule_id, timetable_id]);
        if (labConflict.rowCount) {
            await client.query('ROLLBACK');
            return res.status(409).json({ status: 'error', message: 'That lab is already booked during this time.' });
        }
        const sectionConflict = await client.query(`
            SELECT 1
            FROM exam_schedule es
            JOIN exam e ON e.exam_id=es.exam_id
            JOIN course_offering co ON co.course_offering_id=e.course_offering_id
            WHERE co.section_id=$1 AND es.exam_date=$2 AND es.status <> 'Cancelled'
              AND ($5::int IS NULL OR es.schedule_id <> $5)
              AND es.start_time < $4 AND es.end_time > $3
            UNION ALL
            SELECT 1
            FROM coordinator_exam_timetable cet
            JOIN course_offering co ON co.course_offering_id=cet.course_offering_id
            WHERE co.section_id=$1 AND cet.exam_date=$2 AND cet.status='Published'
              AND cet.timetable_id <> $6 AND cet.start_time < $4 AND cet.end_time > $3
            LIMIT 1
        `, [current.section_id, exam_date, start_time, end_time, current.linked_schedule_id, timetable_id]);
        if (sectionConflict.rowCount) {
            await client.query('ROLLBACK');
            return res.status(409).json({ status: 'error', message: 'This section already has an exam during that time.' });
        }
        await client.query(`
            UPDATE coordinator_exam_timetable
            SET lab_id=$1,exam_date=$2,start_time=$3,end_time=$4,updated_at=NOW()
            WHERE timetable_id=$5
        `, [lab_id, exam_date, start_time, end_time, timetable_id]);
        if (current.linked_schedule_id) {
            await client.query(`
                UPDATE exam_schedule SET lab_id=$1,exam_date=$2,start_time=$3,end_time=$4,updated_at=NOW()
                WHERE schedule_id=$5
            `, [lab_id, exam_date, start_time, end_time, current.linked_schedule_id]);
        }
        await client.query('COMMIT');
        timetableToNotify = {
            course_offering_id: current.course_offering_id,
            exam_type: current.exam_type,
            exam_date,
            start_time,
            end_time
        };
        res.status(200).json({ status: 'success', message: 'Timetable updated.' });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Failed to update independent timetable:', error);
        res.status(500).json({ status: 'error', message: 'Failed to update timetable.' });
    } finally {
        client.release();
    }
    if (timetableToNotify) {
        try {
            await notifyTimetableRecipients(
                timetableToNotify.course_offering_id,
                timetableToNotify,
                'Exam Timetable Updated'
            );
        } catch (error) {
            console.error('Timetable updated, but notifications could not be sent:', error);
        }
    }
};

export const deleteIndependentTimetable = async (req, res) => {
    const { timetable_id } = req.params;
    if (!/^\d+$/.test(String(timetable_id || ''))) {
        return res.status(400).json({ status: 'error', message: 'A valid timetable entry is required.' });
    }
    const client = await pool.connect();
    try {
        await ensureCoordinatorTimetableSchema();
        const departmentId = await getCoordinatorDepartmentId(req);
        await client.query('BEGIN');
        const result = await client.query(`
            SELECT cet.linked_schedule_id
            FROM coordinator_exam_timetable cet
            JOIN course_offering co ON co.course_offering_id=cet.course_offering_id
            JOIN course c ON c.course_id=co.course_id
            JOIN program p ON p.program_id=c.program_id
            WHERE cet.timetable_id=$1 AND ($2::int IS NULL OR p.department_id=$2)
        `, [timetable_id, departmentId]);
        if (!result.rowCount) {
            await client.query('ROLLBACK');
            return res.status(404).json({ status: 'error', message: 'Timetable entry not found.' });
        }
        if (result.rows[0].linked_schedule_id) {
            await client.query(`
                UPDATE exam_schedule SET status='Cancelled',updated_at=NOW()
                WHERE schedule_id=$1
            `, [result.rows[0].linked_schedule_id]);
            await client.query(`
                UPDATE coordinator_exam_timetable
                SET status='Cancelled',linked_exam_id=NULL,linked_schedule_id=NULL,updated_at=NOW()
                WHERE timetable_id=$1
            `, [timetable_id]);
        } else {
            await client.query('DELETE FROM coordinator_exam_timetable WHERE timetable_id=$1', [timetable_id]);
        }
        await client.query('COMMIT');
        res.status(200).json({ status: 'success', message: 'Timetable entry removed.' });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Failed to remove independent timetable:', error);
        res.status(500).json({ status: 'error', message: 'Failed to remove timetable entry.' });
    } finally {
        client.release();
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

        if (end_time <= start_time) {
            return res.status(400).json({
                status: "error",
                message: "Invalid Time Slot: End time must be strictly after start time."
            });
        }

        if (exam_date) {
            const todayStr = new Date().toISOString().split('T')[0];
            const examDateStr = new Date(exam_date).toISOString().split('T')[0];
            if (examDateStr < todayStr) {
                return res.status(400).json({
                    status: "error",
                    message: "Invalid Date: Exam date cannot be scheduled in the past."
                });
            }
        }

        // ==========================
        // Get coordinator
        // ==========================

        const coordinatorResult = await pool.query(
            `
            SELECT coordinator_id, department_id
            FROM coordinator
            WHERE user_id = $1 AND user_id = $2
            `,
            [user_id, req.sessionUser.sub]
        );

        if (coordinatorResult.rows.length === 0) {
            return res.status(403).json({
                status: "error",
                message: "Coordinator not found."
            });
        }

        const coordinator_id = coordinatorResult.rows[0].coordinator_id;
        const coordinatorDepartmentId = coordinatorResult.rows[0].department_id;

        const scopedResources = await pool.query(`
            SELECT e.exam_id
            FROM exam e
            JOIN course_offering co ON co.course_offering_id=e.course_offering_id
            JOIN course c ON c.course_id=co.course_id
            JOIN program p ON p.program_id=c.program_id
            JOIN lab l ON l.lab_id=$2
            WHERE e.exam_id=$1 AND p.department_id=$3 AND l.department_id=$3
        `, [exam_id, lab_id, coordinatorDepartmentId]);
        if (!scopedResources.rowCount) {
            return res.status(403).json({
                status: "error",
                message: "The exam and lab must both belong to your department."
            });
        }

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
            SELECT
                l.lab_name,
                c.course_code,
                c.course_title,
                s.section_name,
                e.exam_type,
                es.start_time,
                es.end_time,
                es.exam_date
            FROM exam_schedule es
            JOIN lab l ON es.lab_id = l.lab_id
            JOIN exam e ON es.exam_id = e.exam_id
            JOIN course_offering co ON e.course_offering_id = co.course_offering_id
            JOIN course c ON co.course_id = c.course_id
            JOIN section s ON co.section_id = s.section_id
            WHERE es.lab_id = $1
              AND es.exam_date = $2
              AND (es.start_time < $4 AND es.end_time > $3)
            `,
            [
                lab_id,
                exam_date,
                start_time,
                end_time
            ]
        );

        if (labConflict.rows.length > 0) {
            const conflict = labConflict.rows[0];
            const startTimeStr = String(conflict.start_time).substring(0, 5);
            const endTimeStr = String(conflict.end_time).substring(0, 5);
            const dateStr = new Date(conflict.exam_date).toISOString().split('T')[0];

            return res.status(409).json({
                status: "error",
                message: `Lab Conflict: ${conflict.lab_name} is already booked on ${dateStr} from ${startTimeStr} to ${endTimeStr} for ${conflict.course_code} ${conflict.exam_type} (${conflict.section_name}). This lab is not available during this time slot.`
            });
        }

        // ==========================
        // Check section/class timetable conflict
        // ==========================

        const sectionConflict = await pool.query(
            `
            SELECT
                s.section_name,
                c.course_code,
                c.course_title,
                e.exam_type,
                es.start_time,
                es.end_time,
                es.exam_date,
                l.lab_name
            FROM exam_schedule es
            JOIN exam e ON es.exam_id = e.exam_id
            JOIN course_offering co ON e.course_offering_id = co.course_offering_id
            JOIN course c ON co.course_id = c.course_id
            JOIN section s ON co.section_id = s.section_id
            JOIN lab l ON es.lab_id = l.lab_id
            WHERE co.section_id = (
                SELECT co_target.section_id
                FROM exam e_target
                JOIN course_offering co_target ON e_target.course_offering_id = co_target.course_offering_id
                WHERE e_target.exam_id = $1
            )
              AND es.exam_id <> $1
              AND es.exam_date = $2
              AND (es.start_time < $4 AND es.end_time > $3)
            `,
            [
                exam_id,
                exam_date,
                start_time,
                end_time
            ]
        );

        if (sectionConflict.rows.length > 0) {
            const conflict = sectionConflict.rows[0];
            const startTimeStr = String(conflict.start_time).substring(0, 5);
            const endTimeStr = String(conflict.end_time).substring(0, 5);
            const dateStr = new Date(conflict.exam_date).toISOString().split('T')[0];

            return res.status(409).json({
                status: "error",
                message: `Student Section Conflict: Section ${conflict.section_name} already has an exam scheduled for ${conflict.course_code} ${conflict.exam_type} in ${conflict.lab_name} on ${dateStr} from ${startTimeStr} to ${endTimeStr}. Students of section ${conflict.section_name} cannot take two exams at the same time.`
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

        // Notify Teacher and Enrolled Students of the new exam timetable slot
        try {
            const infoRes = await pool.query(`
                SELECT u.user_id AS teacher_user_id, c.course_code, e.exam_type, s.section_name, l.lab_name
                FROM exam e
                JOIN course_offering co ON e.course_offering_id = co.course_offering_id
                JOIN course c ON co.course_id = c.course_id
                JOIN section s ON co.section_id = s.section_id
                JOIN teacher t ON co.teacher_id = t.teacher_id
                JOIN users u ON t.user_id = u.user_id
                LEFT JOIN lab l ON l.lab_id = $2
                WHERE e.exam_id = $1
            `, [exam_id, lab_id]);

            if (infoRes.rows.length > 0) {
                const { teacher_user_id, course_code, exam_type, section_name, lab_name } = infoRes.rows[0];
                const startTimeStr = String(start_time).substring(0, 5);
                const endTimeStr = String(end_time).substring(0, 5);

                await pool.query(`
                    INSERT INTO user_notification (user_id, title, message, notification_type)
                    VALUES ($1, $2, $3, 'Exam')
                `, [
                    teacher_user_id,
                    'Exam Scheduled',
                    `Your exam for ${course_code} ${exam_type} (${section_name}) has been scheduled on ${exam_date} from ${startTimeStr} to ${endTimeStr} in ${lab_name || 'Lab'}.`
                ]);

                // Notify all enrolled students
                const studentsRes = await pool.query(`
                    SELECT u.user_id
                    FROM enrollment en
                    JOIN exam e ON en.course_offering_id = e.course_offering_id
                    JOIN student st ON en.student_id = st.student_id
                    JOIN users u ON st.user_id = u.user_id
                    WHERE e.exam_id = $1
                `, [exam_id]);

                for (const stRow of studentsRes.rows) {
                    await pool.query(`
                        INSERT INTO user_notification (user_id, title, message, notification_type)
                        VALUES ($1, $2, $3, 'Exam')
                    `, [
                        stRow.user_id,
                        'Exam Timetable Released',
                        `${course_code} ${exam_type} has been scheduled on ${exam_date} from ${startTimeStr} to ${endTimeStr} in ${lab_name || 'Lab'}.`
                    ]);
                }
            }
        } catch (notifErr) {
            console.error("Error creating notifications for schedule:", notifErr);
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
        if (!await coordinatorOwnsSchedule(req, schedule_id)) {
            return res.status(403).json({ status: "error", message: "You can only update schedules in your department." });
        }
        const departmentId = await getCoordinatorDepartmentId(req);
        const labScope = await pool.query('SELECT 1 FROM lab WHERE lab_id=$1 AND ($2::int IS NULL OR department_id=$2)', [lab_id, departmentId]);
        if (!labScope.rowCount) {
            return res.status(403).json({ status: "error", message: "You can only schedule exams in labs belonging to your department." });
        }
        if (start_time && end_time && end_time <= start_time) {
            return res.status(400).json({
                status: "error",
                message: "Invalid Time Slot: End time must be strictly after start time."
            });
        }

        if (exam_date) {
            const todayStr = new Date().toISOString().split('T')[0];
            const examDateStr = new Date(exam_date).toISOString().split('T')[0];
            if (examDateStr < todayStr) {
                return res.status(400).json({
                    status: "error",
                    message: "Invalid Date: Exam date cannot be scheduled in the past."
                });
            }
        }

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
            SELECT
                l.lab_name,
                c.course_code,
                c.course_title,
                s.section_name,
                e.exam_type,
                es.start_time,
                es.end_time,
                es.exam_date
            FROM exam_schedule es
            JOIN lab l ON es.lab_id = l.lab_id
            JOIN exam e ON es.exam_id = e.exam_id
            JOIN course_offering co ON e.course_offering_id = co.course_offering_id
            JOIN course c ON co.course_id = c.course_id
            JOIN section s ON co.section_id = s.section_id
            WHERE es.lab_id = $1
              AND es.exam_date = $2
              AND es.schedule_id <> $3
              AND (es.start_time < $5 AND es.end_time > $4)
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
            const conflict = labConflict.rows[0];
            const startTimeStr = String(conflict.start_time).substring(0, 5);
            const endTimeStr = String(conflict.end_time).substring(0, 5);
            const dateStr = new Date(conflict.exam_date).toISOString().split('T')[0];

            return res.status(409).json({
                status: "error",
                message: `Lab Conflict: ${conflict.lab_name} is already booked on ${dateStr} from ${startTimeStr} to ${endTimeStr} for ${conflict.course_code} ${conflict.exam_type} (${conflict.section_name}). This lab is not available during this time slot.`
            });
        }

        const sectionConflict = await pool.query(
            `
            SELECT
                s.section_name,
                c.course_code,
                c.course_title,
                e.exam_type,
                es.start_time,
                es.end_time,
                es.exam_date,
                l.lab_name
            FROM exam_schedule es
            JOIN exam e ON es.exam_id = e.exam_id
            JOIN course_offering co ON e.course_offering_id = co.course_offering_id
            JOIN course c ON co.course_id = c.course_id
            JOIN section s ON co.section_id = s.section_id
            JOIN lab l ON es.lab_id = l.lab_id
            WHERE co.section_id = (
                SELECT co_target.section_id
                FROM exam_schedule es_target
                JOIN exam e_target ON es_target.exam_id = e_target.exam_id
                JOIN course_offering co_target ON e_target.course_offering_id = co_target.course_offering_id
                WHERE es_target.schedule_id = $1
            )
              AND es.schedule_id <> $1
              AND es.exam_date = $2
              AND (es.start_time < $4 AND es.end_time > $3)
            `,
            [
                schedule_id,
                exam_date,
                start_time,
                end_time
            ]
        );

        if (sectionConflict.rows.length > 0) {
            const conflict = sectionConflict.rows[0];
            const startTimeStr = String(conflict.start_time).substring(0, 5);
            const endTimeStr = String(conflict.end_time).substring(0, 5);
            const dateStr = new Date(conflict.exam_date).toISOString().split('T')[0];

            return res.status(409).json({
                status: "error",
                message: `Student Section Conflict: Section ${conflict.section_name} already has an exam scheduled for ${conflict.course_code} ${conflict.exam_type} in ${conflict.lab_name} on ${dateStr} from ${startTimeStr} to ${endTimeStr}. Students of section ${conflict.section_name} cannot take two exams at the same time.`
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
        if (!await coordinatorOwnsSchedule(req, schedule_id)) {
            return res.status(403).json({ status: "error", message: "You can only delete schedules in your department." });
        }
        // Delete any duty swap requests for this schedule
        await pool.query(`
            DELETE FROM duty_swap_request 
            WHERE invigilator_assignment_id IN (
                SELECT invigilator_assignment_id FROM invigilator_assignment WHERE schedule_id = $1
            )
        `, [schedule_id]);

        // Delete invigilator assignments for this schedule
        await pool.query(`
            DELETE FROM invigilator_assignment WHERE schedule_id = $1
        `, [schedule_id]);

        // Delete the schedule entry
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
        if (!await coordinatorOwnsSchedule(req, schedule_id)) {
            return res.status(403).json({ status: "error", message: "You can only publish schedules in your department." });
        }

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
        const departmentId = await getCoordinatorDepartmentId(req);

        const result = await pool.query(

            `
            SELECT *

            FROM lab

            WHERE ($4::int IS NULL OR department_id=$4)
              AND lab_id NOT IN (
                SELECT lab_id
                FROM exam_schedule
                WHERE exam_date = $1
                  AND (start_time < $3 AND end_time > $2)
            )
            ORDER BY lab_name
            `,

            [

                exam_date,

                start_time,

                end_time,
                departmentId

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
                department_id,
                is_published
            )
            VALUES
            ($1, $2, $3, $4, $5, $6, TRUE)
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
