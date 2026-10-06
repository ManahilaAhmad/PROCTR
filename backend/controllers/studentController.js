import pool from '../db.js';
import ensureCoordinatorTimetableSchema from '../service/coordinatorTimetableSchema.js';

/* ===========================================================
   GET ALL ENROLLED LAB COURSES WITH EXAM INFO (if scheduled)
   Returns every enrolled lab course offering for the student.
   If an exam exists for that course, exam details are included.
   If no exam yet, exam fields are null — student still sees the course.
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

    // Fetch ALL enrolled course offerings for this student, then LEFT JOIN
    // through exam → exam_schedule so unscheduled courses still appear.
    const result = await pool.query(`
      SELECT
        co.course_offering_id,
        c.course_code,
        c.course_title,
        s.section_name,
        u_t.first_name || ' ' || u_t.last_name AS teacher_name,

        -- Exam info (null if no exam created yet)
        e.exam_id,
        e.exam_type,
        e.total_marks,
        e.duration,
        e.proposed_date,
        e.status AS exam_status,

        -- Schedule info (null if not scheduled yet)
        es.schedule_id,
        es.exam_date,
        es.start_time,
        es.end_time,
        es.status AS schedule_status,

        -- Lab info
        l.lab_name,
        l.capacity,

        -- Question paper
        qp.file_path AS exam_paper_url,

        -- Invigilator info
        u_inv.first_name || ' ' || u_inv.last_name AS invigilator_name,
        ia.assignment_status,

        -- Live Session Info
        les.status AS live_session_status,
        les.session_code AS live_session_code

      FROM enrollment en
      JOIN course_offering co ON en.course_offering_id = co.course_offering_id
      JOIN course c ON co.course_id = c.course_id
      JOIN section s ON co.section_id = s.section_id
      JOIN teacher t ON co.teacher_id = t.teacher_id
      JOIN users u_t ON t.user_id = u_t.user_id

      -- LEFT JOIN exams for this course offering
      LEFT JOIN exam e ON e.course_offering_id = co.course_offering_id

      -- LEFT JOIN exam schedule
      LEFT JOIN exam_schedule es ON es.exam_id = e.exam_id AND es.status <> 'Cancelled'

      -- LEFT JOIN live_exam_session
      LEFT JOIN live_exam_session les ON les.exam_id = e.exam_id AND les.status = 'ACTIVE'

      -- LEFT JOIN lab
      LEFT JOIN lab l ON es.lab_id = l.lab_id

      -- LEFT JOIN question paper
      LEFT JOIN question_paper qp ON qp.exam_id = e.exam_id

      -- LEFT JOIN invigilator assignment
      LEFT JOIN invigilator_assignment ia ON ia.schedule_id = es.schedule_id
      LEFT JOIN teacher t_inv ON ia.teacher_id = t_inv.teacher_id
      LEFT JOIN users u_inv ON t_inv.user_id = u_inv.user_id

      WHERE en.student_id = $1
      ORDER BY
        CASE WHEN es.exam_date IS NULL THEN 1 ELSE 0 END ASC,
        es.exam_date ASC NULLS LAST,
        c.course_code ASC
    `, [student_id]);

    res.status(200).json({ status: 'success', schedule: result.rows });
  } catch (error) {
    console.error('Error fetching student schedule:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch student schedule.' });
  }
};

export const getPlannedSchedule = async (req, res) => {
  const { userId } = req.params;
  try {
    await ensureCoordinatorTimetableSchema();
    const student = await pool.query('SELECT student_id FROM student WHERE user_id=$1', [userId]);
    if (!student.rowCount) return res.status(404).json({ status: 'error', message: 'Student profile not found.' });

    const result = await pool.query(`
      SELECT cet.timetable_id, cet.course_offering_id, cet.exam_type,
             cet.exam_date, cet.start_time, cet.end_time,
             e.exam_id,e.status AS exam_status,e.total_marks,e.duration,e.proposed_date,
             'Published'::text AS schedule_status,
             TRUE AS is_independent_schedule,
             c.course_code,c.course_title,s.section_name,
             u.first_name || ' ' || u.last_name AS teacher_name,
             l.lab_name,l.capacity
      FROM enrollment en
      JOIN coordinator_exam_timetable cet ON cet.course_offering_id=en.course_offering_id
      JOIN course_offering co ON co.course_offering_id=cet.course_offering_id
      JOIN course c ON c.course_id=co.course_id
      JOIN section s ON s.section_id=co.section_id
      JOIN teacher t ON t.teacher_id=co.teacher_id
      JOIN users u ON u.user_id=t.user_id
      JOIN lab l ON l.lab_id=cet.lab_id
      LEFT JOIN LATERAL (
        SELECT exam_id,status,total_marks,duration,proposed_date
        FROM exam
        WHERE course_offering_id=cet.course_offering_id AND exam_type=cet.exam_type
        ORDER BY created_at DESC,exam_id DESC
        LIMIT 1
      ) e ON TRUE
      WHERE en.student_id=$1 AND en.status='Active'
        AND cet.status='Published' AND cet.linked_schedule_id IS NULL
      ORDER BY cet.exam_date,cet.start_time,c.course_code
    `, [student.rows[0].student_id]);
    res.status(200).json({ status: 'success', schedule: result.rows });
  } catch (error) {
    console.error('Error fetching independent student exam timetable:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch planned exam timetable.' });
  }
};
