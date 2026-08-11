import pool from '../db.js';
import { upload, getFileUrl } from '../middleware/upload.js';

/* ===========================================================
   LIST ALL TEACHERS (for swap / assignment dropdowns)
=========================================================== */
export const listTeachers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.teacher_id as id, u.first_name || ' ' || u.last_name as name, t.designation
      FROM teacher t
      JOIN users u ON t.user_id = u.user_id
      WHERE u.is_active = TRUE
      ORDER BY name ASC
    `);
    res.status(200).json({ status: 'success', teachers: result.rows });
  } catch (error) {
    console.error('Error fetching teachers:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch teachers.' });
  }
};

/* ===========================================================
   GET COURSES TAUGHT BY A SPECIFIC TEACHER (only courses WITHOUT an exam created yet)
=========================================================== */
export const getTeacherCourses = async (req, res) => {
  const { userId } = req.params;
  try {
    const teacherQuery = await pool.query('SELECT teacher_id FROM teacher WHERE user_id = $1', [userId]);
    if (teacherQuery.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Teacher profile not found.' });
    }
    const teacherId = teacherQuery.rows[0].teacher_id;

    // Returns ONLY course offerings for which NO EXAM has been created yet
    const result = await pool.query(`
      SELECT co.course_offering_id, c.course_code, c.course_title, s.section_name
      FROM course_offering co
      JOIN course c ON co.course_id = c.course_id
      JOIN section s ON co.section_id = s.section_id
      LEFT JOIN exam e ON co.course_offering_id = e.course_offering_id
      WHERE co.teacher_id = $1 AND e.exam_id IS NULL
      ORDER BY c.course_title ASC
    `, [teacherId]);

    res.status(200).json({ status: 'success', courses: result.rows });
  } catch (error) {
    console.error('Error fetching teacher courses:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch courses.' });
  }
};

/* ===========================================================
   GET TEACHER SCHEDULE
=========================================================== */
export const getSchedule = async (req, res) => {
  const { userId } = req.params;
  try {
    const teacherQuery = await pool.query('SELECT teacher_id FROM teacher WHERE user_id = $1', [userId]);
    if (teacherQuery.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Teacher profile not found.' });
    }
    const teacherId = teacherQuery.rows[0].teacher_id;

    const result = await pool.query(`
      SELECT es.schedule_id, 
             COALESCE(es.exam_date, e.proposed_date, e.created_at) AS exam_date, 
             es.start_time, es.end_time, es.status,
             e.exam_id, e.exam_type, e.status AS exam_status, e.course_offering_id,
             qp.file_path AS exam_paper_url,
             qp.shared_with_dec_at,
             c.course_code, c.course_title, s.section_name, 
             COALESCE(l.lab_name, 'Unassigned') AS lab_name, 
             l.capacity,
             COALESCE(u_inv.first_name || ' ' || u_inv.last_name, 'Unassigned') AS invigilator_name,
             ia.assignment_status,
             CASE WHEN co.teacher_id = $1 OR e.teacher_id = $1 THEN TRUE ELSE FALSE END AS is_instructor,
             CASE WHEN ia.teacher_id = $1 THEN TRUE ELSE FALSE END AS is_invigilator,
             les.status AS live_session_status,
             les.session_code AS live_session_code,
             COALESCE(sub_count.cnt, 0) AS submission_count
      FROM exam e
      JOIN course_offering co ON e.course_offering_id = co.course_offering_id
      JOIN course c ON co.course_id = c.course_id
      JOIN section s ON co.section_id = s.section_id
      LEFT JOIN exam_schedule es ON es.exam_id = e.exam_id
      LEFT JOIN lab l ON es.lab_id = l.lab_id
      LEFT JOIN question_paper qp ON qp.exam_id = e.exam_id
      LEFT JOIN invigilator_assignment ia ON es.schedule_id = ia.schedule_id
      LEFT JOIN teacher t_inv ON ia.teacher_id = t_inv.teacher_id
      LEFT JOIN users u_inv ON t_inv.user_id = u_inv.user_id
      LEFT JOIN live_exam_session les ON les.exam_id = e.exam_id
      LEFT JOIN (
        SELECT exam_id, COUNT(*) AS cnt FROM student_submission GROUP BY exam_id
      ) sub_count ON sub_count.exam_id = e.exam_id
      WHERE co.teacher_id = $1 OR e.teacher_id = $1 OR ia.teacher_id = $1
      ORDER BY COALESCE(es.exam_date, e.proposed_date, e.created_at) DESC
    `, [teacherId]);

    res.status(200).json({ status: 'success', schedule: result.rows });
  } catch (error) {
    console.error('Error fetching teacher schedule:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch schedule.' });
  }
};

/* ===========================================================
   CREATE EXAM DRAFT
=========================================================== */
export const createExam = async (req, res) => {
  const { user_id, exam_type, course_code, course_offering_id, proposed_date } = req.body;
  try {
    const teacherQuery = await pool.query('SELECT teacher_id FROM teacher WHERE user_id = $1', [user_id]);
    if (teacherQuery.rows.length === 0) {
      return res.status(403).json({ status: 'error', message: 'Only teachers can create exams.' });
    }
    const teacher_id = teacherQuery.rows[0].teacher_id;

    // Ensure proposed_date column exists on exam table
    await pool.query('ALTER TABLE exam ADD COLUMN IF NOT EXISTS proposed_date DATE NULL');

    let targetCourseOfferingId = course_offering_id;

    if (!targetCourseOfferingId) {
      const coQuery = await pool.query(`
        SELECT co.course_offering_id FROM course_offering co
        JOIN course c ON co.course_id = c.course_id
        WHERE co.teacher_id = $1 AND c.course_code = $2
        LIMIT 1
      `, [teacher_id, course_code]);

      if (coQuery.rows.length === 0) {
        return res.status(404).json({ status: 'error', message: `No course offering found for course code "${course_code}" assigned to you.` });
      }
      targetCourseOfferingId = coQuery.rows[0].course_offering_id;
    }

    const result_check = await pool.query(
      'SELECT exam_id, status FROM exam WHERE course_offering_id = $1 LIMIT 1',
      [targetCourseOfferingId]
    );
    if (result_check.rows.length > 0) {
      const existing = result_check.rows[0];
      return res.status(409).json({
        status: 'error',
        message: `An exam already exists for this course (Status: ${existing.status}). You cannot create another exam for the same course offering.`,
      });
    }

    if (proposed_date) {
      const todayStr = new Date().toISOString().split('T')[0];
      const propDateStr = new Date(proposed_date).toISOString().split('T')[0];
      if (propDateStr < todayStr) {
        return res.status(400).json({ status: 'error', message: 'Invalid Date: Proposed exam date cannot be in the past.' });
      }
    }

    const result = await pool.query(`
      INSERT INTO exam (course_offering_id, teacher_id, exam_type, total_marks, duration, status, proposed_date)
      VALUES ($1, $2, $3, 100, 120, 'Draft', $4)
      RETURNING exam_id
    `, [targetCourseOfferingId, teacher_id, exam_type, proposed_date || null]);

    res.status(200).json({ status: 'success', message: 'Exam draft created.', examId: result.rows[0].exam_id });
  } catch (error) {
    console.error('Error creating exam:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create exam.' });
  }
};

/* ===========================================================
   UPLOAD EXAM PAPER (real file via multer)
=========================================================== */
export const uploadPaper = async (req, res) => {
  const { exam_id } = req.body;
  try {
    if (!exam_id) {
      return res.status(400).json({ status: 'error', message: 'exam_id is required.' });
    }
    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'No file uploaded.' });
    }

    // Resolve URL: Cloudinary URL if Cloudinary is active, local URL otherwise
    const fileUrl = getFileUrl(req, req.file.filename);

    const teacherRes = await pool.query(`
      SELECT co.teacher_id
      FROM exam e
      JOIN course_offering co ON e.course_offering_id = co.course_offering_id
      WHERE e.exam_id = $1
    `, [exam_id]);
    const teacherId = teacherRes.rows[0]?.teacher_id || null;

    await pool.query(`
      INSERT INTO question_paper (exam_id, uploaded_by, file_path, version)
      VALUES ($1, $2, $3, 1)
      ON CONFLICT DO NOTHING
    `, [exam_id, teacherId, fileUrl]);

    await pool.query(
      "UPDATE exam SET status = 'PendingHOD', submitted_at = NOW() WHERE exam_id = $1",
      [exam_id]
    );

    res.status(200).json({ status: 'success', message: 'Exam paper uploaded successfully.', fileUrl });
  } catch (error) {
    console.error('Error uploading exam paper:', error);
    res.status(500).json({ status: 'error', message: 'Failed to upload paper.' });
  }
};

/* ===========================================================
   SUBMIT EXAM TO HOD
=========================================================== */
export const submitToHOD = async (req, res) => {
  const { exam_id } = req.body;
  try {
    const result = await pool.query(
      "UPDATE exam SET status = 'PendingHOD', submitted_at = NOW() WHERE exam_id = $1 AND status IN ('Draft', 'Rejected') RETURNING exam_id",
      [exam_id]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Exam not found or cannot be submitted in its current status.' });
    }
    res.status(200).json({ status: 'success', message: 'Exam submitted to HOD for review.' });
  } catch (error) {
    console.error('Error submitting exam to HOD:', error);
    res.status(500).json({ status: 'error', message: 'Failed to submit exam to HOD.' });
  }
};

/* ===========================================================
   SHARE APPROVED PAPER WITH DEC
=========================================================== */
export const shareToDEC = async (req, res) => {
  const targetExamId = req.params.examId || req.body.exam_id || req.body.examId;
  try {
    const examRes = await pool.query(`
      SELECT e.status, c.course_code, e.exam_type
      FROM exam e
      JOIN course_offering co ON e.course_offering_id = co.course_offering_id
      JOIN course c ON co.course_id = c.course_id
      WHERE e.exam_id = $1
    `, [targetExamId]);

    if (examRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Exam not found.' });
    }

    const { status, course_code, exam_type } = examRes.rows[0];
    if (status !== 'Approved') {
      return res.status(400).json({ status: 'error', message: 'Exam must be HOD-approved before sharing with Director Exam.' });
    }

    const checkPaper = await pool.query('SELECT question_paper_id FROM question_paper WHERE exam_id = $1', [targetExamId]);
    if (checkPaper.rows.length === 0) {
      const tRes = await pool.query('SELECT teacher_id FROM exam WHERE exam_id = $1', [targetExamId]);
      const tId = tRes.rows[0]?.teacher_id || 1;
      await pool.query(
        `INSERT INTO question_paper (exam_id, uploaded_by, file_path, shared_with_dec_at)
         VALUES ($1, $2, '/uploads/sample_paper.pdf', NOW())`,
        [targetExamId, tId]
      );
    } else {
      await pool.query(
        `UPDATE question_paper SET shared_with_dec_at = NOW() WHERE exam_id = $1`,
        [targetExamId]
      );
    }

    const directors = await pool.query(`SELECT user_id FROM director`);
    for (const row of directors.rows) {
      await pool.query(`
        INSERT INTO user_notification (user_id, title, message, notification_type)
        VALUES ($1, $2, $3, 'Exam')
      `, [row.user_id, 'Exam Paper Shared', `${course_code} ${exam_type} paper has been shared with Director Exam for review.`]);
    }

    res.status(200).json({ status: 'success', message: 'Exam paper shared with Director Exam.' });
  } catch (error) {
    console.error('Error sharing exam with Director Exam:', error);
    res.status(500).json({ status: 'error', message: 'Failed to share exam paper.' });
  }
};

/* ===========================================================
   GET INCOMING SWAP REQUESTS (for replacement teacher)
=========================================================== */
export const getIncomingSwapRequests = async (req, res) => {
  const { userId } = req.params;
  try {
    const teacherQuery = await pool.query('SELECT teacher_id FROM teacher WHERE user_id = $1', [userId]);
    if (teacherQuery.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Teacher profile not found.' });
    }
    const teacherId = teacherQuery.rows[0].teacher_id;

    const result = await pool.query(`
      SELECT dsr.request_id, dsr.reason, dsr.replacement_status, dsr.dec_status, dsr.requested_at,
             e.exam_type, c.course_code, c.course_title, s.section_name, es.exam_date, es.start_time, l.lab_name,
             u_req.first_name || ' ' || u_req.last_name as requester_name
      FROM duty_swap_request dsr
      JOIN invigilator_assignment ia ON dsr.invigilator_assignment_id = ia.invigilator_assignment_id
      JOIN exam_schedule es ON ia.schedule_id = es.schedule_id
      JOIN exam e ON es.exam_id = e.exam_id
      JOIN course_offering co ON e.course_offering_id = co.course_offering_id
      JOIN course c ON co.course_id = c.course_id
      JOIN section s ON co.section_id = s.section_id
      JOIN lab l ON es.lab_id = l.lab_id
      JOIN teacher t_req ON dsr.requester_teacher_id = t_req.teacher_id
      JOIN users u_req ON t_req.user_id = u_req.user_id
      WHERE dsr.replacement_teacher_id = $1 AND dsr.replacement_status = 'Pending'
      ORDER BY dsr.requested_at DESC
    `, [teacherId]);

    res.status(200).json({ status: 'success', incoming: result.rows });
  } catch (error) {
    console.error('Error fetching incoming swap requests:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch incoming swap requests.' });
  }
};

/* ===========================================================
   RESPOND TO SWAP REQUEST (Replacement teacher accepts or declines)
=========================================================== */
export const respondToSwapRequest = async (req, res) => {
  const { requestId } = req.params;
  const { user_id, decision } = req.body; // decision: 'Accepted' | 'Declined'
  try {
    const teacherQuery = await pool.query('SELECT teacher_id FROM teacher WHERE user_id = $1', [user_id]);
    if (teacherQuery.rows.length === 0) {
      return res.status(403).json({ status: 'error', message: 'Teacher profile not found.' });
    }
    const teacherId = teacherQuery.rows[0].teacher_id;
    if (decision === 'Accepted') {
      const getSched = await pool.query(`
        SELECT ia.schedule_id, es.exam_date, es.start_time, es.end_time
        FROM duty_swap_request dsr
        JOIN invigilator_assignment ia ON dsr.invigilator_assignment_id = ia.invigilator_assignment_id
        JOIN exam_schedule es ON ia.schedule_id = es.schedule_id
        WHERE dsr.request_id = $1
      `, [requestId]);

      if (getSched.rows.length > 0) {
        const { schedule_id, exam_date, start_time, end_time } = getSched.rows[0];
        const conflictRes = await pool.query(`
          SELECT ia.invigilator_assignment_id, c.course_code, e.exam_type, l.lab_name,
                 es.exam_date, es.start_time, es.end_time
          FROM invigilator_assignment ia
          JOIN exam_schedule es ON ia.schedule_id = es.schedule_id
          JOIN exam e ON es.exam_id = e.exam_id
          JOIN course_offering co ON e.course_offering_id = co.course_offering_id
          JOIN course c ON co.course_id = c.course_id
          JOIN lab l ON es.lab_id = l.lab_id
          WHERE ia.teacher_id = $1
            AND ia.schedule_id <> $2
            AND es.exam_date = $3
            AND (es.start_time < $5 AND es.end_time > $4)
        `, [teacherId, schedule_id, exam_date, start_time, end_time]);

        if (conflictRes.rows.length > 0) {
          const conflict = conflictRes.rows[0];
          const startTimeStr = String(conflict.start_time).substring(0, 5);
          const endTimeStr = String(conflict.end_time).substring(0, 5);
          const dateStr = new Date(conflict.exam_date).toISOString().split('T')[0];
          return res.status(409).json({
            status: 'error',
            message: `Schedule Conflict: You are already assigned as invigilator for ${conflict.course_code} ${conflict.exam_type} in ${conflict.lab_name} on ${dateStr} from ${startTimeStr} to ${endTimeStr}. You cannot accept another duty during the same time slot.`
          });
        }
      }
    }

    const newStatus = decision === 'Accepted' ? 'Accepted' : 'Declined';

    const updateRes = await pool.query(`
      UPDATE duty_swap_request
      SET replacement_status = $1
      WHERE request_id = $2 AND replacement_teacher_id = $3
      RETURNING requester_teacher_id, invigilator_assignment_id
    `, [newStatus, requestId, teacherId]);

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Swap request not found or not assigned to you.' });
    }

    const { requester_teacher_id, invigilator_assignment_id } = updateRes.rows[0];

    // Notify original requester (Teacher A)
    try {
      const infoRes = await pool.query(`
        SELECT u_req.user_id as requester_user_id,
               u_rep.first_name || ' ' || u_rep.last_name as replacement_name,
               c.course_code, e.exam_type
        FROM teacher t_req
        JOIN users u_req ON t_req.user_id = u_req.user_id
        JOIN teacher t_rep ON t_rep.teacher_id = $1
        JOIN users u_rep ON t_rep.user_id = u_rep.user_id
        JOIN invigilator_assignment ia ON ia.invigilator_assignment_id = $2
        JOIN exam_schedule es ON ia.schedule_id = es.schedule_id
        JOIN exam e ON es.exam_id = e.exam_id
        JOIN course_offering co ON e.course_offering_id = co.course_offering_id
        JOIN course c ON co.course_id = c.course_id
        WHERE t_req.teacher_id = $3
      `, [teacherId, invigilator_assignment_id, requester_teacher_id]);

      if (infoRes.rows.length > 0) {
        const { requester_user_id, replacement_name, course_code, exam_type } = infoRes.rows[0];
        const title = newStatus === 'Accepted' ? 'Swap Request Agreed by Colleague' : 'Swap Request Declined';
        const msg = newStatus === 'Accepted'
          ? `${replacement_name} agreed to cover your ${course_code} ${exam_type} invigilation. Request is now awaiting DEC approval.`
          : `${replacement_name} declined your swap request for ${course_code} ${exam_type}.`;

        await pool.query(`
          INSERT INTO user_notification (user_id, title, message, notification_type)
          VALUES ($1, $2, $3, 'Invigilation')
        `, [requester_user_id, title, msg]);
      }

      // If accepted, notify DEC members
      if (newStatus === 'Accepted') {
        const decMembers = await pool.query(`SELECT user_id FROM dec_member`);
        for (const decRow of decMembers.rows) {
          await pool.query(`
            INSERT INTO user_notification (user_id, title, message, notification_type)
            VALUES ($1, $2, $3, 'Invigilation')
          `, [decRow.user_id, 'New Swap Request Pending DEC Review', `A swap request agreed by both teachers is awaiting your review.`]);
        }
      }
    } catch (notifErr) {
      console.error('Error sending swap decision notification:', notifErr);
    }

    res.status(200).json({ status: 'success', message: `Swap request ${newStatus.toLowerCase()}.` });
  } catch (error) {
    console.error('Error responding to swap request:', error);
    res.status(500).json({ status: 'error', message: 'Failed to process response.' });
  }
};

/* ===========================================================
   GET PAPERS SHARED WITH DIRECTOR EXAM
=========================================================== */
export const getSharedPapers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.exam_id, e.exam_type, e.total_marks, e.duration, e.status, e.approved_at,
             qp.file_path AS exam_paper_url, qp.shared_with_dec_at,
             c.course_code, c.course_title, s.section_name,
             u.first_name || ' ' || u.last_name AS teacher_name,
             d.department_name, d.department_code
      FROM exam e
      JOIN course_offering co ON e.course_offering_id = co.course_offering_id
      JOIN course c ON co.course_id = c.course_id
      JOIN section s ON co.section_id = s.section_id
      JOIN teacher t ON co.teacher_id = t.teacher_id
      JOIN users u ON t.user_id = u.user_id
      JOIN department d ON t.department_id = d.department_id
      JOIN question_paper qp ON qp.exam_id = e.exam_id
      WHERE qp.shared_with_dec_at IS NOT NULL
      ORDER BY qp.shared_with_dec_at DESC
    `);
    res.status(200).json({ status: 'success', papers: result.rows });
  } catch (error) {
    console.error('Error fetching shared papers for Director Exam:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch shared papers.' });
  }
};

/* ===========================================================
   GET OUTGOING SWAP REQUESTS (for requester teacher)
=========================================================== */
export const getOutgoingSwapRequests = async (req, res) => {
  const { userId } = req.params;
  try {
    const teacherQuery = await pool.query('SELECT teacher_id FROM teacher WHERE user_id = $1', [userId]);
    if (teacherQuery.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Teacher profile not found.' });
    }
    const teacherId = teacherQuery.rows[0].teacher_id;

    const result = await pool.query(`
      SELECT dsr.request_id, dsr.reason, dsr.replacement_status, dsr.dec_status, dsr.requested_at,
             ia.schedule_id,
             e.exam_type, c.course_code, c.course_title, s.section_name, es.exam_date, es.start_time, l.lab_name,
             u_rep.first_name || ' ' || u_rep.last_name as replacement_name
      FROM duty_swap_request dsr
      JOIN invigilator_assignment ia ON dsr.invigilator_assignment_id = ia.invigilator_assignment_id
      JOIN exam_schedule es ON ia.schedule_id = es.schedule_id
      JOIN exam e ON es.exam_id = e.exam_id
      JOIN course_offering co ON e.course_offering_id = co.course_offering_id
      JOIN course c ON co.course_id = c.course_id
      JOIN section s ON co.section_id = s.section_id
      JOIN lab l ON es.lab_id = l.lab_id
      JOIN teacher t_rep ON dsr.replacement_teacher_id = t_rep.teacher_id
      JOIN users u_rep ON t_rep.user_id = u_rep.user_id
      WHERE dsr.requester_teacher_id = $1
      ORDER BY dsr.requested_at DESC
    `, [teacherId]);

    res.status(200).json({ status: 'success', requests: result.rows });
  } catch (error) {
    console.error('Error fetching outgoing swap requests:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch swap requests.' });
  }
};
