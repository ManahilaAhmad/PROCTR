import pool from '../db.js';

/* ===========================================================
   GET STUDENT EXAM SCHEDULE / DATE SHEET
=========================================================== */
export const getSchedule = async (req, res) => {
  const { userId } = req.params;
  try {
    const studentQuery = await pool.query(
      'SELECT student_id, registration_no FROM student WHERE user_id = $1',
      [userId]
    );
    if (studentQuery.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Student profile not found.' });
    }
    const { student_id } = studentQuery.rows[0];

    const result = await pool.query(`
      SELECT es.schedule_id, es.exam_date, es.start_time, es.end_time, es.status,
             e.exam_id, e.exam_type, e.total_marks, e.duration,
             qp.file_path AS exam_paper_url,
             c.course_code, c.course_title,
             s.section_name, l.lab_name, l.capacity,
             u_inv.first_name || ' ' || u_inv.last_name as invigilator_name,
             ia.assignment_status
      FROM exam_schedule es
      JOIN exam e ON es.exam_id = e.exam_id
      JOIN course_offering co ON e.course_offering_id = co.course_offering_id
      JOIN course c ON co.course_id = c.course_id
      JOIN section s ON co.section_id = s.section_id
      JOIN lab l ON es.lab_id = l.lab_id
      LEFT JOIN question_paper qp ON qp.exam_id = e.exam_id
      LEFT JOIN invigilator_assignment ia ON es.schedule_id = ia.schedule_id
      LEFT JOIN teacher t_inv ON ia.teacher_id = t_inv.teacher_id
      LEFT JOIN users u_inv ON t_inv.user_id = u_inv.user_id
      WHERE co.section_id = (
        SELECT section_id FROM enrollment se
        JOIN course_offering co2 ON se.course_offering_id = co2.course_offering_id
        WHERE se.student_id = $1
        LIMIT 1
      )
      ORDER BY es.exam_date ASC
    `, [student_id]);

    res.status(200).json({ status: 'success', schedule: result.rows });
  } catch (error) {
    console.error('Error fetching student schedule:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch student schedule.' });
  }
};
