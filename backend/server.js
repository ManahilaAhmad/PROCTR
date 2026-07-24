import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import pool from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// =====================================================================
// HEALTH & VERIFICATION ENDPOINTS
// =====================================================================

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'PROCTR Backend Server is healthy and running.',
  });
});

app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.status(200).json({
      status: 'success',
      message: 'Successfully queried PostgreSQL/Neon Database.',
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error('Database connection test failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to connect to Neon PostgreSQL.',
      error: error.message,
    });
  }
});

// =====================================================================
// A. AUTHENTICATION ENDPOINT
// =====================================================================

app.post('/api/auth/login', async (req, res) => {
  const { email, password, user_type } = req.body;
  try {
    if (!email || !password || !user_type) {
      return res.status(400).json({ status: 'error', message: 'All fields are required.' });
    }

    const result = await pool.query(
      'SELECT user_id, first_name, last_name, email, password_hash, user_type, is_active FROM users WHERE email = $1 AND user_type = $2',
      [email, user_type]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or user role.' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ status: 'error', message: 'Your account is currently disabled.' });
    }

    // Verify password with bcrypt
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ status: 'error', message: 'Incorrect password.' });
    }

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE user_id = $1', [user.user_id]);

    // ── Build role-specific extra fields ──────────────────────────────
    let extra = {};

    if (user_type === 'teacher') {
      const r = await pool.query(
        `SELECT t.teacher_id, d.department_name, d.department_code, t.designation
         FROM teacher t
         JOIN department d ON t.department_id = d.department_id
         WHERE t.user_id = $1`, [user.user_id]
      );
      if (r.rows.length) {
        extra = {
          teacherId: r.rows[0].teacher_id,
          departmentName: r.rows[0].department_name,
          departmentCode: r.rows[0].department_code,
          designation: r.rows[0].designation,
        };
      }
    }

    if (user_type === 'student') {
      const r = await pool.query(
        `SELECT s.student_id, s.registration_no, s.current_semester, s.status,
                b.batch_name, p.program_name, d.department_name
         FROM student s
         JOIN batch b ON s.batch_id = b.batch_id
         JOIN program p ON b.program_id = p.program_id
         JOIN department d ON p.department_id = d.department_id
         WHERE s.user_id = $1`, [user.user_id]
      );
      if (r.rows.length) {
        extra = {
          studentId: r.rows[0].student_id,
          rollNo: r.rows[0].registration_no,
          currentSemester: r.rows[0].current_semester,
          batchName: r.rows[0].batch_name,
          programName: r.rows[0].program_name,
          departmentName: r.rows[0].department_name,
        };
      }
    }

    if (user_type === 'hod') {
      const r = await pool.query(
        `SELECT h.hod_id, d.department_name, d.department_code
         FROM hod h
         JOIN department d ON h.department_id = d.department_id
         WHERE h.user_id = $1`, [user.user_id]
      );
      if (r.rows.length) {
        extra = {
          hodId: r.rows[0].hod_id,
          departmentName: r.rows[0].department_name,
          departmentCode: r.rows[0].department_code,
        };
      }
    }

    if (user_type === 'coordinator') {
      const r = await pool.query(
        `SELECT c.coordinator_id, d.department_name, d.department_code
         FROM coordinator c
         JOIN department d ON c.department_id = d.department_id
         WHERE c.user_id = $1`, [user.user_id]
      );
      if (r.rows.length) {
        extra = {
          coordinatorId: r.rows[0].coordinator_id,
          departmentName: r.rows[0].department_name,
          departmentCode: r.rows[0].department_code,
        };
      }
    }

    if (user_type === 'dec') {
      const r = await pool.query(
        `SELECT dm.dec_member_id, dm.role, d.department_name, d.department_code
         FROM dec_member dm
         JOIN department d ON dm.department_id = d.department_id
         WHERE dm.user_id = $1`, [user.user_id]
      );
      if (r.rows.length) {
        extra = {
          decMemberId: r.rows[0].dec_member_id,
          decRole: r.rows[0].role,
          departmentName: r.rows[0].department_name,
          departmentCode: r.rows[0].department_code,
        };
      }
    }

    if (user_type === 'director') {
      const r = await pool.query(
        'SELECT director_id, designation FROM director WHERE user_id = $1', [user.user_id]
      );
      if (r.rows.length) {
        extra = {
          directorId: r.rows[0].director_id,
          designation: r.rows[0].designation,
        };
      }
    }

    res.status(200).json({
      status: 'success',
      user: {
        userId: user.user_id,
        firstName: user.first_name,
        lastName: user.last_name,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        userType: user.user_type,
        ...extra,
      }
    });
  } catch (error) {
    console.error('Login API error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
});

// Change Password (any authenticated user)
app.post('/api/auth/change-password', async (req, res) => {
  const { user_id, current_password, new_password } = req.body;
  try {
    if (!user_id || !current_password || !new_password) {
      return res.status(400).json({ status: 'error', message: 'All fields are required.' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ status: 'error', message: 'New password must be at least 6 characters.' });
    }
    const userResult = await pool.query('SELECT password_hash FROM users WHERE user_id = $1', [user_id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }
    const isMatch = await bcrypt.compare(current_password, userResult.rows[0].password_hash);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Current password is incorrect.' });
    }
    const newHash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE user_id = $2', [newHash, user_id]);
    res.status(200).json({ status: 'success', message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update password.' });
  }
});

// =====================================================================
// B. LAB ALLOCATION ENDPOINTS
// =====================================================================

app.get('/api/labs', async (req, res) => {
  try {
    const result = await pool.query('SELECT lab_id, lab_name, total_pcs, capacity, network_range, status FROM lab ORDER BY lab_name ASC');
    res.status(200).json({ status: 'success', labs: result.rows });
  } catch (error) {
    console.error('Error fetching labs:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch labs.' });
  }
});

// =====================================================================
// C. DATE SHEET & SCHEDULING ENDPOINTS
// =====================================================================

// Get HOD-approved exams ready to be scheduled
app.get('/api/exams/approved', async (req, res) => {
  try {
    const query = `
      SELECT e.exam_id, e.exam_type, e.total_marks, e.duration, 
             c.course_code, c.course_title, s.section_name 
      FROM exam e 
      JOIN course_offering co ON e.course_offering_id = co.course_offering_id
      JOIN course c ON co.course_id = c.course_id
      JOIN section s ON co.section_id = s.section_id
      WHERE e.status = 'Approved'
    `;
    const result = await pool.query(query);
    res.status(200).json({ status: 'success', exams: result.rows });
  } catch (error) {
    console.error('Error fetching approved exams:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch approved exams.' });
  }
});

// Get complete exam schedule / Date Sheet
app.get('/api/schedule', async (req, res) => {
  try {
    const query = `
      SELECT es.schedule_id, es.exam_date, es.start_time, es.end_time, es.status,
             e.exam_type, e.total_marks, e.duration,
             c.course_code, c.course_title,
             s.section_name,
             l.lab_name, l.capacity,
             u.first_name || ' ' || u.last_name as invigilator_name,
             ia.assignment_status
      FROM exam_schedule es
      JOIN exam e ON es.exam_id = e.exam_id
      JOIN course_offering co ON e.course_offering_id = co.course_offering_id
      JOIN course c ON co.course_id = c.course_id
      JOIN section s ON co.section_id = s.section_id
      JOIN lab l ON es.lab_id = l.lab_id
      LEFT JOIN invigilator_assignment ia ON es.schedule_id = ia.schedule_id
      LEFT JOIN teacher t ON ia.teacher_id = t.teacher_id
      LEFT JOIN users u ON t.user_id = u.user_id
      ORDER BY es.exam_date ASC, es.start_time ASC
    `;
    const result = await pool.query(query);
    res.status(200).json({ status: 'success', schedule: result.rows });
  } catch (error) {
    console.error('Error fetching exam schedule:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch schedule.' });
  }
});

// Create new exam schedule record (Allocate lab)
app.post('/api/schedule', async (req, res) => {
  const { exam_id, lab_id, user_id, exam_date, start_time, end_time } = req.body;
  try {
    // 1. Get coordinator_id from user_id
    const coordQuery = await pool.query('SELECT coordinator_id FROM coordinator WHERE user_id = $1', [user_id]);
    if (coordQuery.rows.length === 0) {
      return res.status(403).json({ status: 'error', message: 'Only coordinators can schedule exams.' });
    }
    const coordinator_id = coordQuery.rows[0].coordinator_id;

    // 2. Insert schedule
    const insertQuery = `
      INSERT INTO exam_schedule (exam_id, lab_id, coordinator_id, exam_date, start_time, end_time, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'Published')
      RETURNING schedule_id
    `;
    const result = await pool.query(insertQuery, [exam_id, lab_id, coordinator_id, exam_date, start_time, end_time]);
    res.status(200).json({ status: 'success', message: 'Exam scheduled successfully.', scheduleId: result.rows[0].schedule_id });
  } catch (error) {
    console.error('Error scheduling exam:', error);
    res.status(500).json({ status: 'error', message: 'Failed to schedule exam.' });
  }
});

// =====================================================================
// D. INVIGILATOR ASSIGNMENTS & SWAPS ENDPOINTS
// =====================================================================

// Get available invigilators pool
app.get('/api/teachers', async (req, res) => {
  try {
    const query = `
      SELECT t.teacher_id as id, u.first_name || ' ' || u.last_name as name, t.designation
      FROM teacher t
      JOIN users u ON t.user_id = u.user_id
      WHERE u.is_active = TRUE
      ORDER BY name ASC
    `;
    const result = await pool.query(query);
    res.status(200).json({ status: 'success', teachers: result.rows });
  } catch (error) {
    console.error('Error fetching teachers:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch teachers.' });
  }
});

// Assign invigilator (DEC panel)
app.post('/api/invigilator/assign', async (req, res) => {
  const { schedule_id, teacher_id, user_id } = req.body;
  try {
    // 1. Get dec_member_id from user_id
    const decQuery = await pool.query('SELECT dec_member_id FROM dec_member WHERE user_id = $1', [user_id]);
    if (decQuery.rows.length === 0) {
      return res.status(403).json({ status: 'error', message: 'Only DEC members can assign invigilators.' });
    }
    const dec_member_id = decQuery.rows[0].dec_member_id;

    // 2. Clear any existing assignment for this schedule to avoid duplicates
    await pool.query('DELETE FROM invigilator_assignment WHERE schedule_id = $1', [schedule_id]);

    // 3. Insert new assignment
    const insertQuery = `
      INSERT INTO invigilator_assignment (schedule_id, teacher_id, assigned_by, assignment_status)
      VALUES ($1, $2, $3, 'Confirmed')
      RETURNING invigilator_assignment_id
    `;
    await pool.query(insertQuery, [schedule_id, teacher_id, dec_member_id]);
    res.status(200).json({ status: 'success', message: 'Invigilator assigned successfully.' });
  } catch (error) {
    console.error('Error assigning invigilator:', error);
    res.status(500).json({ status: 'error', message: 'Failed to assign invigilator.' });
  }
});

// Post duty swap request (Teacher panel)
app.post('/api/swap-request', async (req, res) => {
  const { schedule_id, user_id, replacement_teacher_id, reason } = req.body;
  try {
    // 1. Get teacher_id from user_id
    const teacherQuery = await pool.query('SELECT teacher_id FROM teacher WHERE user_id = $1', [user_id]);
    if (teacherQuery.rows.length === 0) {
      return res.status(403).json({ status: 'error', message: 'Only teachers can request duty swaps.' });
    }
    const requester_teacher_id = teacherQuery.rows[0].teacher_id;

    // 2. Get invigilator_assignment_id for this schedule and teacher
    const assignQuery = await pool.query(
      'SELECT invigilator_assignment_id FROM invigilator_assignment WHERE schedule_id = $1 AND teacher_id = $2',
      [schedule_id, requester_teacher_id]
    );
    if (assignQuery.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No invigilation assignment found for this exam.' });
    }
    const invigilator_assignment_id = assignQuery.rows[0].invigilator_assignment_id;

    // 3. Insert swap request
    const insertQuery = `
      INSERT INTO duty_swap_request (invigilator_assignment_id, requester_teacher_id, replacement_teacher_id, reason, replacement_status, dec_status)
      VALUES ($1, $2, $3, $4, 'Pending', 'Pending')
    `;
    await pool.query(insertQuery, [invigilator_assignment_id, requester_teacher_id, replacement_teacher_id, reason]);
    res.status(200).json({ status: 'success', message: 'Duty swap request submitted to colleague and DEC.' });
  } catch (error) {
    console.error('Error submitting swap request:', error);
    res.status(500).json({ status: 'error', message: 'Failed to submit swap request.' });
  }
});

// Get swap requests list (DEC panel)
app.get('/api/swap-requests/dec', async (req, res) => {
  try {
    const query = `
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
      JOIN section s ON co.section_id = s.section_id
      JOIN lab l ON es.lab_id = l.lab_id
      JOIN teacher t_req ON dsr.requester_teacher_id = t_req.teacher_id
      JOIN users u_req ON t_req.user_id = u_req.user_id
      JOIN teacher t_rep ON dsr.replacement_teacher_id = t_rep.teacher_id
      JOIN users u_rep ON t_rep.user_id = u_rep.user_id
      ORDER BY dsr.requested_at DESC
    `;
    const result = await pool.query(query);
    res.status(200).json({ status: 'success', requests: result.rows });
  } catch (error) {
    console.error('Error fetching DEC swap requests:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch swap requests.' });
  }
});

// Process swap request decision (DEC panel)
app.post('/api/swap-requests/dec/review', async (req, res) => {
  const { request_id, user_id, status } = req.body; // status: Approved / Rejected
  try {
    // 1. Update the request status
    const updateRequestQuery = `
      UPDATE duty_swap_request
      SET dec_status = $1, approved_by_user_id = $2, processed_at = NOW()
      WHERE request_id = $3
      RETURNING invigilator_assignment_id, replacement_teacher_id
    `;
    const requestResult = await pool.query(updateRequestQuery, [status, user_id, request_id]);
    
    if (requestResult.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Swap request not found.' });
    }

    const { invigilator_assignment_id, replacement_teacher_id } = requestResult.rows[0];

    // 2. If approved, swap the teacher in the invigilator_assignment table
    if (status === 'Approved') {
      await pool.query(
        `UPDATE invigilator_assignment 
         SET teacher_id = $1, assignment_status = 'Swapped', updated_at = NOW() 
         WHERE invigilator_assignment_id = $2`,
        [replacement_teacher_id, invigilator_assignment_id]
      );
    }

    res.status(200).json({ status: 'success', message: `Swap request has been ${status.toLowerCase()}.` });
  } catch (error) {
    console.error('Error processing DEC swap request:', error);
    res.status(500).json({ status: 'error', message: 'Failed to process swap request.' });
  }
});

// =====================================================================
// E. BROADCAST NOTIFICATIONS ENDPOINTS
// =====================================================================

// Create announcement broadcast (Coordinator panel)
app.post('/api/notifications/broadcast', async (req, res) => {
  const { user_id, subject, message, audience_type } = req.body;
  try {
    const insertQuery = `
      INSERT INTO broadcast_announcement (sender_user_id, subject, message, audience_type)
      VALUES ($1, $2, $3, $4)
      RETURNING announcement_id
    `;
    await pool.query(insertQuery, [user_id, subject, message, audience_type]);
    res.status(200).json({ status: 'success', message: 'Broadcast announcement sent successfully.' });
  } catch (error) {
    console.error('Error creating broadcast:', error);
    res.status(500).json({ status: 'error', message: 'Failed to send broadcast announcement.' });
  }
});

// Get broadcast notifications list
app.get('/api/notifications', async (req, res) => {
  try {
    const query = `
      SELECT ba.announcement_id, ba.subject, ba.message, ba.audience_type, ba.created_at,
             u.first_name || ' ' || u.last_name as sender_name
      FROM broadcast_announcement ba
      LEFT JOIN users u ON ba.sender_user_id = u.user_id
      ORDER BY ba.created_at DESC
    `;
    const result = await pool.query(query);
    res.status(200).json({ status: 'success', notifications: result.rows });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch notifications.' });
  }
});

// Get teacher-specific schedule (exams they teach or invigilate)
app.get('/api/teacher/:userId/schedule', async (req, res) => {
  const { userId } = req.params;
  try {
    const teacherQuery = await pool.query('SELECT teacher_id FROM teacher WHERE user_id = $1', [userId]);
    if (teacherQuery.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Teacher profile not found.' });
    }
    const teacherId = teacherQuery.rows[0].teacher_id;

    const query = `
      SELECT es.schedule_id, es.exam_date, es.start_time, es.end_time, es.status,
             e.exam_id, e.exam_type, e.status as exam_status,
             qp.file_path AS exam_paper_url,
             c.course_code, c.course_title, s.section_name, l.lab_name, l.capacity,
             COALESCE(u_inv.first_name || ' ' || u_inv.last_name, 'Unassigned') as invigilator_name,
             ia.assignment_status,
             CASE WHEN co.teacher_id = $1 THEN TRUE ELSE FALSE END as is_instructor,
             CASE WHEN ia.teacher_id = $1 THEN TRUE ELSE FALSE END as is_invigilator
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
      WHERE co.teacher_id = $1 OR ia.teacher_id = $1
      ORDER BY es.exam_date ASC
    `;
    const result = await pool.query(query, [teacherId]);
    res.status(200).json({ status: 'success', schedule: result.rows });
  } catch (error) {
    console.error('Error fetching teacher schedule:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch schedule.' });
  }
});

// Upload exam paper URL (Teacher panel) — stores in question_paper table
app.post('/api/exams/upload', async (req, res) => {
  const { exam_id, paper_url, teacher_id } = req.body;
  try {
    // Get teacher_id from exam if not provided
    let tid = teacher_id;
    if (!tid) {
      const tRes = await pool.query('SELECT teacher_id FROM exam WHERE exam_id = $1', [exam_id]);
      if (tRes.rows.length) tid = tRes.rows[0].teacher_id;
    }
    // Upsert into question_paper table
    await pool.query(
      `INSERT INTO question_paper (exam_id, uploaded_by, file_path, version)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT DO NOTHING`,
      [exam_id, tid, paper_url]
    );
    // Update exam status to PendingHOD
    await pool.query("UPDATE exam SET status = 'PendingHOD', submitted_at = NOW() WHERE exam_id = $1", [exam_id]);
    res.status(200).json({ status: 'success', message: 'Exam paper uploaded successfully.' });
  } catch (error) {
    console.error('Error uploading exam paper:', error);
    res.status(500).json({ status: 'error', message: 'Failed to upload paper.' });
  }
});


// =====================================================================
// F. TEACHER EXAM MANAGEMENT ENDPOINTS
// =====================================================================

// Create a new exam draft (Teacher)
app.post('/api/exams', async (req, res) => {
  const { user_id, exam_type, course_code, proposed_date } = req.body;
  try {
    // Get teacher_id
    const teacherQuery = await pool.query('SELECT teacher_id FROM teacher WHERE user_id = $1', [user_id]);
    if (teacherQuery.rows.length === 0) {
      return res.status(403).json({ status: 'error', message: 'Only teachers can create exams.' });
    }
    const teacher_id = teacherQuery.rows[0].teacher_id;

    // Find course_offering_id by course_code and teacher_id
    const coQuery = await pool.query(`
      SELECT co.course_offering_id FROM course_offering co
      JOIN course c ON co.course_id = c.course_id
      WHERE co.teacher_id = $1 AND c.course_code = $2
      LIMIT 1
    `, [teacher_id, course_code]);

    if (coQuery.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: `No course offering found for course code "${course_code}" assigned to you.` });
    }
    const course_offering_id = coQuery.rows[0].course_offering_id;

    const insertQuery = `
      INSERT INTO exam (course_offering_id, exam_type, total_marks, duration, status)
      VALUES ($1, $2, 100, 120, 'Draft')
      RETURNING exam_id
    `;
    const result = await pool.query(insertQuery, [course_offering_id, exam_type]);
    res.status(200).json({ status: 'success', message: 'Exam draft created.', examId: result.rows[0].exam_id });
  } catch (error) {
    console.error('Error creating exam:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create exam.' });
  }
});

// Teacher submits exam to HOD (changes status from Draft -> Pending HOD)
app.post('/api/exams/submit-hod', async (req, res) => {
  const { exam_id } = req.body;
  try {
    const result = await pool.query(
      "UPDATE exam SET status = 'Pending HOD' WHERE exam_id = $1 AND status = 'Draft' RETURNING exam_id",
      [exam_id]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Exam not found or not in Draft status.' });
    }
    res.status(200).json({ status: 'success', message: 'Exam submitted to HOD for review.' });
  } catch (error) {
    console.error('Error submitting exam to HOD:', error);
    res.status(500).json({ status: 'error', message: 'Failed to submit exam to HOD.' });
  }
});

// =====================================================================
// H. HOD EXAM REVIEW ENDPOINTS
// =====================================================================

// Get exams pending HOD review
app.get('/api/hod/queue', async (req, res) => {
  try {
    const query = `
      SELECT e.exam_id, e.exam_type, e.total_marks, e.duration, e.status, e.submitted_at, e.exam_paper_url,
             c.course_code, c.course_title, s.section_name,
             u.first_name || ' ' || u.last_name as teacher_name
      FROM exam e
      JOIN course_offering co ON e.course_offering_id = co.course_offering_id
      JOIN course c ON co.course_id = c.course_id
      JOIN section s ON co.section_id = s.section_id
      JOIN teacher t ON co.teacher_id = t.teacher_id
      JOIN users u ON t.user_id = u.user_id
      WHERE e.status = 'Pending HOD'
      ORDER BY e.submitted_at DESC NULLS LAST
    `;
    const result = await pool.query(query);
    res.status(200).json({ status: 'success', queue: result.rows });
  } catch (error) {
    console.error('Error fetching HOD queue:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch HOD review queue.' });
  }
});

// HOD Approve or Reject an exam paper
app.post('/api/hod/review', async (req, res) => {
  const { exam_id, decision, comment } = req.body;
  try {
    const newStatus = decision === 'Approved' ? 'Approved' : 'Rejected';
    const result = await pool.query(
      `UPDATE exam
       SET status = $1, hod_comment = $2, approved_at = CASE WHEN $1 = 'Approved' THEN NOW() ELSE NULL END
       WHERE exam_id = $3
       RETURNING exam_id`,
      [newStatus, comment || null, exam_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Exam paper not found.' });
    }
    res.status(200).json({ status: 'success', message: `Exam paper ${newStatus.toLowerCase()} successfully.` });
  } catch (error) {
    console.error('Error updating exam review:', error);
    res.status(500).json({ status: 'error', message: 'Failed to submit review decision.' });
  }
});

// Get HOD decision history
app.get('/api/hod/decisions', async (req, res) => {
  try {
    const query = `
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
    `;
    const result = await pool.query(query);
    res.status(200).json({ status: 'success', decisions: result.rows });
  } catch (error) {
    console.error('Error fetching HOD decisions:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch review history.' });
  }
});

// =====================================================================
// G. STUDENT ENDPOINTS
// =====================================================================

// Get student exam schedule
app.get('/api/student/:userId/schedule', async (req, res) => {
  const { userId } = req.params;
  try {
    // Get student_id
    const studentQuery = await pool.query('SELECT student_id, registration_no FROM student WHERE user_id = $1', [userId]);
    if (studentQuery.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Student profile not found.' });
    }
    const { student_id } = studentQuery.rows[0];

    const query = `
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
    `;
    const result = await pool.query(query, [student_id]);
    res.status(200).json({ status: 'success', schedule: result.rows });
  } catch (error) {
    console.error('Error fetching student schedule:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch student schedule.' });
  }
});

app.listen(PORT, () => {
  console.log(`PROCTR Backend Server is listening on port ${PORT}`);
});
