import pool from '../db.js';

/* ===========================================================
   GET HOD REVIEW QUEUE (PendingHOD exams)
=========================================================== */
export const getQueue = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.exam_id, e.exam_type, e.total_marks, e.duration, e.status, e.submitted_at,
             qp.file_path AS exam_paper_url,
             c.course_code, c.course_title, s.section_name,
             u.first_name || ' ' || u.last_name as teacher_name
      FROM exam e
      JOIN course_offering co ON e.course_offering_id = co.course_offering_id
      JOIN course c ON co.course_id = c.course_id
      JOIN section s ON co.section_id = s.section_id
      JOIN teacher t ON co.teacher_id = t.teacher_id
      JOIN users u ON t.user_id = u.user_id
      LEFT JOIN question_paper qp ON qp.exam_id = e.exam_id
      WHERE e.status = 'PendingHOD'
      ORDER BY e.submitted_at DESC NULLS LAST
    `);
    res.status(200).json({ status: 'success', queue: result.rows });
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
    const newStatus = decision === 'Approved' ? 'Approved' : 'Rejected';
    const approvedAt = newStatus === 'Approved' ? new Date() : null;

    const result = await pool.query(`
      UPDATE exam
      SET status = $1, hod_comment = $2, approved_at = $3
      WHERE exam_id = $4
      RETURNING exam_id
    `, [newStatus, comment || null, approvedAt, exam_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Exam paper not found.' });
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
              'Exam Approved — Ready to Schedule',
              `${course_code} ${exam_type} has been approved by HOD and is ready for exam scheduling.`
            ]);
          }
        }
      }
    } catch (notifyErr) {
      console.error('Failed to notify teacher/coordinator of HOD decision:', notifyErr);
    }

    res.status(200).json({ status: 'success', message: `Exam paper ${newStatus.toLowerCase()} successfully.` });
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
    const result = await pool.query(`
      SELECT e.exam_id, e.exam_type, e.status as decision, e.hod_comment as notes, e.approved_at as date,
             c.course_code, c.course_title,
             u.first_name || ' ' || u.last_name as teacher_name
      FROM exam e
      JOIN course_offering co ON e.course_offering_id = co.course_offering_id
      JOIN course c ON co.course_id = c.course_id
      JOIN teacher t ON co.teacher_id = t.teacher_id
      JOIN users u ON t.user_id = u.user_id
      WHERE e.status IN ('Approved', 'Rejected')
      ORDER BY e.approved_at DESC NULLS LAST
    `);
    res.status(200).json({ status: 'success', decisions: result.rows });
  } catch (error) {
    console.error('Error fetching HOD decisions:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch review history.' });
  }
};
