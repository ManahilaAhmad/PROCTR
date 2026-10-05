import pool from '../db.js';

async function getDecActor(req) {
  if (req.sessionUser?.role === 'admin') return { dec_member_id: null, department_id: null };
  const result = await pool.query('SELECT dec_member_id,department_id FROM dec_member WHERE user_id=$1', [req.sessionUser.sub]);
  return result.rows[0] || null;
}

/* ===========================================================
   HELPER: Check Teacher Invigilation Overlap Conflict
=========================================================== */
const checkTeacherInvigilationConflict = async (teacherId, scheduleId) => {
  const schedRes = await pool.query(
    'SELECT exam_date, start_time, end_time FROM exam_schedule WHERE schedule_id = $1',
    [scheduleId]
  );
  if (schedRes.rows.length === 0) return null;
  const { exam_date, start_time, end_time } = schedRes.rows[0];

  const conflictRes = await pool.query(`
    SELECT ia.invigilator_assignment_id, c.course_code, e.exam_type, l.lab_name,
           es.exam_date, es.start_time, es.end_time,
           u.first_name || ' ' || u.last_name AS teacher_name
    FROM invigilator_assignment ia
    JOIN exam_schedule es ON ia.schedule_id = es.schedule_id
    JOIN exam e ON es.exam_id = e.exam_id
    JOIN course_offering co ON e.course_offering_id = co.course_offering_id
    JOIN course c ON co.course_id = c.course_id
    JOIN lab l ON es.lab_id = l.lab_id
    JOIN teacher t ON ia.teacher_id = t.teacher_id
    JOIN users u ON t.user_id = u.user_id
    WHERE ia.teacher_id = $1
      AND ia.schedule_id <> $2
      AND es.exam_date = $3
      AND (es.start_time < $5 AND es.end_time > $4)
  `, [teacherId, scheduleId, exam_date, start_time, end_time]);

  if (conflictRes.rows.length > 0) {
    return conflictRes.rows[0];
  }
  return null;
};

/* ===========================================================
   ASSIGN INVIGILATOR (DEC panel)
=========================================================== */
export const assignInvigilator = async (req, res) => {
  const { schedule_id, teacher_id } = req.body;
  try {
    const actor = await getDecActor(req);
    if (!actor) {
      return res.status(403).json({ status: 'error', message: 'Only DEC members can assign invigilators.' });
    }
    const scopedResources = await pool.query(`
      SELECT p.department_id AS exam_department_id,t.department_id AS teacher_department_id
      FROM exam_schedule es
      JOIN exam e ON e.exam_id=es.exam_id
      JOIN course_offering co ON co.course_offering_id=e.course_offering_id
      JOIN course c ON c.course_id=co.course_id
      JOIN program p ON p.program_id=c.program_id
      JOIN teacher t ON t.teacher_id=$2
      WHERE es.schedule_id=$1
    `, [schedule_id, teacher_id]);
    const scoped = scopedResources.rows[0];
    if (!scoped || scoped.exam_department_id !== scoped.teacher_department_id
        || (actor.department_id != null && scoped.exam_department_id !== actor.department_id)) {
      return res.status(403).json({ status: 'error', message: 'The schedule and invigilator must belong to your department.' });
    }
    let dec_member_id = actor.dec_member_id;
    if (!dec_member_id) {
      const departmentDec = await pool.query('SELECT dec_member_id FROM dec_member WHERE department_id=$1 ORDER BY dec_member_id LIMIT 1', [scoped.exam_department_id]);
      dec_member_id = departmentDec.rows[0]?.dec_member_id;
      if (!dec_member_id) return res.status(409).json({ status: 'error', message: 'No DEC member is configured for this department.' });
    }

    // Check if teacher has another invigilation duty during this time slot
    const conflict = await checkTeacherInvigilationConflict(teacher_id, schedule_id);
    if (conflict) {
      const startTimeStr = String(conflict.start_time).substring(0, 5);
      const endTimeStr = String(conflict.end_time).substring(0, 5);
      const dateStr = new Date(conflict.exam_date).toISOString().split('T')[0];
      return res.status(409).json({
        status: 'error',
        message: `Invigilation Conflict: Prof. ${conflict.teacher_name} is already assigned as invigilator for ${conflict.course_code} ${conflict.exam_type} in ${conflict.lab_name} on ${dateStr} from ${startTimeStr} to ${endTimeStr}. They cannot invigilate two labs simultaneously.`
      });
    }

    await pool.query('DELETE FROM invigilator_assignment WHERE schedule_id = $1', [schedule_id]);

    await pool.query(`
      INSERT INTO invigilator_assignment (schedule_id, teacher_id, assigned_by, assignment_status)
      VALUES ($1, $2, $3, 'Confirmed')
      RETURNING invigilator_assignment_id
    `, [schedule_id, teacher_id, dec_member_id]);

    res.status(200).json({ status: 'success', message: 'Invigilator assigned successfully.' });
  } catch (error) {
    console.error('Error assigning invigilator:', error);
    res.status(500).json({ status: 'error', message: 'Failed to assign invigilator.' });
  }
};

/* ===========================================================
   CREATE DUTY SWAP REQUEST (Teacher panel)
=========================================================== */
export const createSwapRequest = async (req, res) => {
  const { schedule_id, user_id, replacement_teacher_id, reason } = req.body;
  try {
    const teacherQuery = await pool.query('SELECT teacher_id FROM teacher WHERE user_id = $1', [user_id]);
    if (teacherQuery.rows.length === 0) {
      return res.status(403).json({ status: 'error', message: 'Only teachers can request duty swaps.' });
    }
    const requester_teacher_id = teacherQuery.rows[0].teacher_id;

    // Check if nominated replacement teacher has another invigilation duty during this time slot
    const conflict = await checkTeacherInvigilationConflict(replacement_teacher_id, schedule_id);
    if (conflict) {
      const startTimeStr = String(conflict.start_time).substring(0, 5);
      const endTimeStr = String(conflict.end_time).substring(0, 5);
      const dateStr = new Date(conflict.exam_date).toISOString().split('T')[0];
      return res.status(409).json({
        status: 'error',
        message: `Schedule Conflict: Prof. ${conflict.teacher_name} is already assigned as invigilator for ${conflict.course_code} ${conflict.exam_type} in ${conflict.lab_name} on ${dateStr} from ${startTimeStr} to ${endTimeStr}. They cannot be nominated for another duty during the same time slot.`
      });
    }

    const assignQuery = await pool.query(
      'SELECT invigilator_assignment_id FROM invigilator_assignment WHERE schedule_id = $1 AND teacher_id = $2',
      [schedule_id, requester_teacher_id]
    );
    if (assignQuery.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No invigilation assignment found for this exam.' });
    }
    const invigilator_assignment_id = assignQuery.rows[0].invigilator_assignment_id;

    await pool.query(`
      INSERT INTO duty_swap_request (invigilator_assignment_id, requester_teacher_id, replacement_teacher_id, reason, replacement_status, dec_status)
      VALUES ($1, $2, $3, $4, 'Pending', 'Pending')
    `, [invigilator_assignment_id, requester_teacher_id, replacement_teacher_id, reason]);

    // Send notification to the replacement teacher
    try {
      const repUserRes = await pool.query(
        `SELECT u.user_id, u_req.first_name || ' ' || u_req.last_name as requester_name,
                c.course_code, e.exam_type
         FROM teacher t
         JOIN users u ON t.user_id = u.user_id
         JOIN teacher t_req ON t_req.teacher_id = $1
         JOIN users u_req ON t_req.user_id = u_req.user_id
         JOIN invigilator_assignment ia ON ia.invigilator_assignment_id = $2
         JOIN exam_schedule es ON ia.schedule_id = es.schedule_id
         JOIN exam e ON es.exam_id = e.exam_id
         JOIN course_offering co ON e.course_offering_id = co.course_offering_id
         JOIN course c ON co.course_id = c.course_id
         WHERE t.teacher_id = $3`,
        [requester_teacher_id, invigilator_assignment_id, replacement_teacher_id]
      );

      if (repUserRes.rows.length > 0) {
        const { user_id: repUserId, requester_name, course_code, exam_type } = repUserRes.rows[0];
        await pool.query(`
          INSERT INTO user_notification (user_id, title, message, notification_type)
          VALUES ($1, $2, $3, 'Invigilation')
        `, [
          repUserId,
          'Incoming Duty Swap Request',
          `${requester_name} has requested you to cover invigilation for ${course_code} ${exam_type}. Please check your portal to accept or decline.`
        ]);
      }
    } catch (notifErr) {
      console.error('Error sending swap notification:', notifErr);
    }

    res.status(200).json({ status: 'success', message: 'Duty swap request submitted to colleague.' });
  } catch (error) {
    console.error('Error submitting swap request:', error);
    res.status(500).json({ status: 'error', message: 'Failed to submit swap request.' });
  }
};

/* ===========================================================
   LIST ALL SWAP REQUESTS (DEC panel — only shows colleague-accepted requests)
=========================================================== */
export const listSwapRequests = async (req, res) => {
  try {
    const actor = await getDecActor(req);
    if (!actor) return res.status(403).json({ status: 'error', message: 'DEC profile not found.' });
    const result = await pool.query(`
      SELECT dsr.request_id, dsr.reason, dsr.replacement_status, dsr.dec_status, dsr.requested_at,
             e.exam_type, c.course_code, c.course_title, s.section_name, es.exam_date, es.start_time, l.lab_name,
             u_req.first_name || ' ' || u_req.last_name as requester_name,
             u_rep.first_name || ' ' || u_rep.last_name as replacement_name
      FROM duty_swap_request dsr
      JOIN invigilator_assignment ia ON dsr.invigilator_assignment_id = ia.invigilator_assignment_id
      JOIN exam_schedule es ON ia.schedule_id = es.schedule_id
      JOIN exam e ON es.exam_id = e.exam_id
      JOIN course_offering co ON e.course_offering_id = co.course_offering_id
      JOIN course c ON co.course_id = c.course_id
      JOIN program p ON p.program_id=c.program_id
      JOIN section s ON co.section_id = s.section_id
      JOIN lab l ON es.lab_id = l.lab_id
      JOIN teacher t_req ON dsr.requester_teacher_id = t_req.teacher_id
      JOIN users u_req ON t_req.user_id = u_req.user_id
      JOIN teacher t_rep ON dsr.replacement_teacher_id = t_rep.teacher_id
      JOIN users u_rep ON t_rep.user_id = u_rep.user_id
      WHERE dsr.replacement_status = 'Accepted'
        AND ($1::int IS NULL OR p.department_id=$1)
      ORDER BY dsr.requested_at DESC
    `, [actor.department_id]);
    res.status(200).json({ status: 'success', requests: result.rows });
  } catch (error) {
    console.error('Error fetching DEC swap requests:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch swap requests.' });
  }
};

/* ===========================================================
   REVIEW SWAP REQUEST (Approve / Reject — DEC panel)
=========================================================== */
export const reviewSwapRequest = async (req, res) => {
  const { request_id, status } = req.body;
  try {
    if (!['Approved', 'Rejected'].includes(status)) return res.status(400).json({ status: 'error', message: 'Status must be Approved or Rejected.' });
    const actor = await getDecActor(req);
    if (!actor) return res.status(403).json({ status: 'error', message: 'DEC profile not found.' });
    const requestResult = await pool.query(`
      UPDATE duty_swap_request
      SET dec_status = $1, approved_by_user_id = $2, processed_at = NOW()
      WHERE request_id = $3
        AND EXISTS (
          SELECT 1 FROM invigilator_assignment ia
          JOIN exam_schedule es ON es.schedule_id=ia.schedule_id
          JOIN exam e ON e.exam_id=es.exam_id
          JOIN course_offering co ON co.course_offering_id=e.course_offering_id
          JOIN course c ON c.course_id=co.course_id
          JOIN program p ON p.program_id=c.program_id
          WHERE ia.invigilator_assignment_id=duty_swap_request.invigilator_assignment_id
            AND ($4::int IS NULL OR p.department_id=$4)
        )
      RETURNING invigilator_assignment_id, replacement_teacher_id
    `, [status, req.sessionUser.sub, request_id, actor.department_id]);

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Swap request not found.' });
    }

    const { invigilator_assignment_id, replacement_teacher_id } = requestResult.rows[0];

    if (status === 'Approved') {
      const assignRes = await pool.query(
        'SELECT schedule_id FROM invigilator_assignment WHERE invigilator_assignment_id = $1',
        [invigilator_assignment_id]
      );
      if (assignRes.rows.length > 0) {
        const schedId = assignRes.rows[0].schedule_id;
        const conflict = await checkTeacherInvigilationConflict(replacement_teacher_id, schedId);
        if (conflict) {
          const startTimeStr = String(conflict.start_time).substring(0, 5);
          const endTimeStr = String(conflict.end_time).substring(0, 5);
          const dateStr = new Date(conflict.exam_date).toISOString().split('T')[0];
          return res.status(409).json({
            status: 'error',
            message: `Cannot approve swap: Prof. ${conflict.teacher_name} is already assigned as invigilator for ${conflict.course_code} ${conflict.exam_type} in ${conflict.lab_name} on ${dateStr} from ${startTimeStr} to ${endTimeStr}. They cannot invigilate two labs simultaneously.`
          });
        }
      }

      await pool.query(`
        UPDATE invigilator_assignment
        SET teacher_id = $1, assignment_status = 'Swapped', updated_at = NOW()
        WHERE invigilator_assignment_id = $2
      `, [replacement_teacher_id, invigilator_assignment_id]);

      try {
        const infoRes = await pool.query(`
          SELECT u.user_id, c.course_code, e.exam_type, qp.file_path
          FROM invigilator_assignment ia
          JOIN exam_schedule es ON ia.schedule_id = es.schedule_id
          JOIN exam e ON es.exam_id = e.exam_id
          JOIN course_offering co ON e.course_offering_id = co.course_offering_id
          JOIN course c ON co.course_id = c.course_id
          JOIN teacher t ON t.teacher_id = $2
          JOIN users u ON t.user_id = u.user_id
          LEFT JOIN question_paper qp ON qp.exam_id = e.exam_id
          WHERE ia.invigilator_assignment_id = $1
        `, [invigilator_assignment_id, replacement_teacher_id]);

        if (infoRes.rows.length > 0) {
          const { user_id: newInvigilatorUserId, course_code, exam_type, file_path } = infoRes.rows[0];
          const message = file_path
            ? `You are now the invigilator for ${course_code} ${exam_type}. The exam paper is available in your schedule.`
            : `You are now the invigilator for ${course_code} ${exam_type}.`;

          await pool.query(`
            INSERT INTO user_notification (user_id, title, message, notification_type)
            VALUES ($1, $2, $3, 'Invigilation')
          `, [newInvigilatorUserId, 'New Invigilation Duty Assigned', message]);
        }
      } catch (notifyErr) {
        console.error('Failed to notify new invigilator:', notifyErr);
      }
    }

    res.status(200).json({ status: 'success', message: `Swap request has been ${status.toLowerCase()}.` });
  } catch (error) {
    console.error('Error processing DEC swap request:', error);
    res.status(500).json({ status: 'error', message: 'Failed to process swap request.' });
  }
};
