import pool from '../db.js';
import { getFileUrl } from '../middleware/upload.js';
import ensureCoordinatorTimetableSchema from '../service/coordinatorTimetableSchema.js';

async function getHodDepartmentId(req) {
  if (req.sessionUser?.role === 'admin') return null;
  const result = await pool.query('SELECT department_id FROM hod WHERE user_id=$1', [req.sessionUser.sub]);
  return result.rows[0]?.department_id || 0;
}

/* ===========================================================
   GET HOD REVIEW QUEUE (PendingHOD exams)
=========================================================== */
export const getQueue = async (req, res) => {
  try {
    const departmentId = await getHodDepartmentId(req);
    const result = await pool.query(`
      SELECT e.exam_id, e.exam_type, e.total_marks, e.duration, e.status, e.submitted_at,
             qp.file_path AS exam_paper_url, r.file_path AS rubric_url,
             c.course_code, c.course_title, s.section_name,
             u.first_name || ' ' || u.last_name as teacher_name
      FROM exam e
      JOIN course_offering co ON e.course_offering_id = co.course_offering_id
      JOIN course c ON co.course_id = c.course_id
      JOIN program p ON c.program_id = p.program_id
      JOIN section s ON co.section_id = s.section_id
      JOIN teacher t ON co.teacher_id = t.teacher_id
      JOIN users u ON t.user_id = u.user_id
      LEFT JOIN question_paper qp ON qp.exam_id = e.exam_id
      LEFT JOIN LATERAL (SELECT file_path FROM rubric WHERE exam_id=e.exam_id ORDER BY version DESC, uploaded_at DESC LIMIT 1) r ON TRUE
      WHERE e.status = 'PendingHOD' AND ($1::int IS NULL OR p.department_id=$1)
      ORDER BY e.submitted_at DESC NULLS LAST
    `, [departmentId]);

    const rows = result.rows.map(row => ({
      ...row,
      exam_paper_url: row.exam_paper_url ? getFileUrl(req, row.exam_paper_url) : null,
      rubric_url: row.rubric_url ? getFileUrl(req, row.rubric_url) : null
    }));

    res.status(200).json({ status: 'success', queue: rows });
  } catch (error) {
    console.error('Error fetching HOD queue:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch HOD review queue.' });
  }
};

/* ===========================================================
   REVIEW AN EXAM (Approve / Reject)
=========================================================== */
export const reviewExam = async (req, res) => {
  const { exam_id, decision, comment } = req.body;
  try {
    if (!/^\d+$/.test(String(exam_id || '')) || !['Approved', 'Rejected'].includes(decision)) {
      return res.status(400).json({ status: 'error', message: 'A valid exam and decision are required.' });
    }
    if (String(comment || '').length > 2000) return res.status(400).json({ status: 'error', message: 'Review comment is too long.' });
    const departmentId = await getHodDepartmentId(req);
    const newStatus = decision;
    const approvedAt = newStatus === 'Approved' ? new Date() : null;

    const result = await pool.query(`
      UPDATE exam
      SET status = $1, hod_comment = $2, approved_at = $3
      WHERE exam_id = $4
        AND status='PendingHOD'
        AND EXISTS (
          SELECT 1 FROM course_offering co
          JOIN course c ON c.course_id=co.course_id
          JOIN program p ON p.program_id=c.program_id
          WHERE co.course_offering_id=exam.course_offering_id
            AND ($5::int IS NULL OR p.department_id=$5)
        )
      RETURNING exam_id
    `, [newStatus, comment || null, approvedAt, exam_id, departmentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Exam paper was not found in your department.' });
    }

    let scheduleLinkWarning = null;
    let independentTimetableLinked = false;
    if (newStatus === 'Approved') {
      try {
        await ensureCoordinatorTimetableSchema();
        const planned = await pool.query(`
          SELECT cet.timetable_id,cet.lab_id,cet.coordinator_id,cet.exam_date,cet.start_time,cet.end_time,e.exam_id
          FROM coordinator_exam_timetable cet
          JOIN exam e ON e.course_offering_id=cet.course_offering_id AND e.exam_type=cet.exam_type
          WHERE e.exam_id=$1 AND cet.status='Published' AND cet.linked_schedule_id IS NULL
        `, [exam_id]);
        if (planned.rowCount) {
          const item = planned.rows[0];
          const schedule = await pool.query(`
            INSERT INTO exam_schedule (exam_id,lab_id,coordinator_id,exam_date,start_time,end_time,status)
            VALUES ($1,$2,$3,$4,$5,$6,'Published')
            ON CONFLICT (exam_id) DO UPDATE
            SET lab_id=EXCLUDED.lab_id,coordinator_id=EXCLUDED.coordinator_id,
                exam_date=EXCLUDED.exam_date,start_time=EXCLUDED.start_time,
                end_time=EXCLUDED.end_time,status='Published',updated_at=NOW()
            RETURNING schedule_id
          `, [item.exam_id, item.lab_id, item.coordinator_id, item.exam_date, item.start_time, item.end_time]);
          await pool.query(`
            UPDATE coordinator_exam_timetable
            SET linked_exam_id=$1,linked_schedule_id=$2,updated_at=NOW()
            WHERE timetable_id=$3
          `, [item.exam_id, schedule.rows[0].schedule_id, item.timetable_id]);
          independentTimetableLinked = true;
        }
      } catch (error) {
        console.error('HOD approved the exam, but its independent timetable could not be linked for invigilation:', error);
        scheduleLinkWarning = 'The paper was approved, but the timetable could not be connected to the invigilation system. Please contact an administrator.';
      }
    }

    // Notify the teacher
    try {
      const teacherRes = await pool.query(`
        SELECT u.user_id, c.course_code, e.exam_type
        FROM exam e
        JOIN course_offering co ON e.course_offering_id = co.course_offering_id
        JOIN teacher t ON co.teacher_id = t.teacher_id
        JOIN users u ON t.user_id = u.user_id
        JOIN course c ON co.course_id = c.course_id
        WHERE e.exam_id = $1
      `, [exam_id]);

      if (teacherRes.rows.length > 0) {
        const { user_id, course_code, exam_type } = teacherRes.rows[0];
        const title = newStatus === 'Approved' ? 'Exam Paper Approved' : 'Exam Paper Rejected';
        const message = newStatus === 'Approved'
          ? `Your ${course_code} ${exam_type} paper has been approved by the HOD. You can now share it with the Director Examination.`
          : `Your ${course_code} ${exam_type} paper was rejected.${comment ? ` HOD note: ${comment}` : ''}`;

        await pool.query(`
          INSERT INTO user_notification (user_id, title, message, notification_type)
          VALUES ($1, $2, $3, $4)
        `, [user_id, title, message, newStatus === 'Approved' ? 'Approved' : 'Exam']);

        if (newStatus === 'Approved') {
          const coordRes = await pool.query(`
            SELECT c.user_id
            FROM coordinator c
            JOIN teacher t ON t.teacher_id = (
              SELECT co.teacher_id FROM exam e JOIN course_offering co ON e.course_offering_id = co.course_offering_id WHERE e.exam_id = $1
            )
            WHERE c.department_id = t.department_id
          `, [exam_id]);

          for (const row of coordRes.rows) {
            await pool.query(`
              INSERT INTO user_notification (user_id, title, message, notification_type)
              VALUES ($1, $2, $3, 'Exam')
            `, [
              row.user_id,
              independentTimetableLinked ? 'Exam Approved — Timetable Connected' : 'Exam Approved — Ready to Schedule',
              independentTimetableLinked
                ? `${course_code} ${exam_type} has been approved by HOD and its coordinator timetable is now connected to the invigilation system.`
                : `${course_code} ${exam_type} has been approved by HOD and is ready for exam scheduling.`
            ]);
          }
        }
      }
    } catch (notifyErr) {
      console.error('Failed to notify teacher/coordinator of HOD decision:', notifyErr);
    }

    res.status(200).json({
      status: 'success',
      message: scheduleLinkWarning || `Exam paper ${newStatus.toLowerCase()} successfully.`,
      ...(scheduleLinkWarning ? { schedule_link_warning: scheduleLinkWarning } : {})
    });
  } catch (error) {
    console.error('Error updating exam review:', error);
    res.status(500).json({ status: 'error', message: 'Failed to submit review decision.' });
  }
};

/* ===========================================================
   GET HOD PAST DECISIONS
=========================================================== */
export const getDecisions = async (req, res) => {
  try {
    const departmentId = await getHodDepartmentId(req);
    const result = await pool.query(`
      SELECT e.exam_id, e.exam_type, e.status as decision, e.hod_comment as notes, e.approved_at as date,
             c.course_code, c.course_title,
             u.first_name || ' ' || u.last_name as teacher_name
      FROM exam e
      JOIN course_offering co ON e.course_offering_id = co.course_offering_id
      JOIN course c ON co.course_id = c.course_id
      JOIN program p ON c.program_id = p.program_id
      JOIN teacher t ON co.teacher_id = t.teacher_id
      JOIN users u ON t.user_id = u.user_id
      WHERE e.status IN ('Approved', 'Rejected') AND ($1::int IS NULL OR p.department_id=$1)
      ORDER BY e.approved_at DESC NULLS LAST
    `, [departmentId]);
    res.status(200).json({ status: 'success', decisions: result.rows });
  } catch (error) {
    console.error('Error fetching HOD decisions:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch review history.' });
  }
};
