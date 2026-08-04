import pool from '../db.js';
import bcrypt from 'bcryptjs';

/* ===========================================================
   LOGIN
=========================================================== */
export const login = async (req, res) => {
  const { email, password, user_type } = req.body;
  try {
    if (!email || !password || !user_type) {
      return res.status(400).json({ status: 'error', message: 'All fields are required.' });
    }

    let result;
    if (user_type === 'student') {
      result = await pool.query(
        `SELECT u.user_id, u.first_name, u.last_name, u.email, u.password_hash, u.user_type, u.is_active, u.profile_picture_url 
         FROM users u 
         LEFT JOIN student s ON u.user_id = s.user_id 
         WHERE (u.email = $1 OR s.registration_no = $1) AND u.user_type = $2`,
        [email, user_type]
      );
    } else {
      result = await pool.query(
        'SELECT user_id, first_name, last_name, email, password_hash, user_type, is_active, profile_picture_url FROM users WHERE email = $1 AND user_type = $2',
        [email, user_type]
      );
    }

    if (result.rows.length === 0) {
      return res.status(401).json({ status: 'error', message: 'Invalid email/registration number or user role.' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ status: 'error', message: 'Your account is currently disabled.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ status: 'error', message: 'Incorrect password.' });
    }

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE user_id = $1', [user.user_id]);

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
        profilePictureUrl: user.profile_picture_url,
        ...extra,
      }
    });
  } catch (error) {
    console.error('Login API error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

/* ===========================================================
   CHANGE PASSWORD
=========================================================== */
export const changePassword = async (req, res) => {
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
};

/* ===========================================================
   UPDATE PROFILE PICTURE (Multer Image Upload)
=========================================================== */
export const updateProfilePicture = async (req, res) => {
  const { user_id } = req.body;
  try {
    if (!user_id) {
      return res.status(400).json({ status: 'error', message: 'user_id is required.' });
    }
    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'No file uploaded.' });
    }

    const fileUrl = `http://localhost:${process.env.PORT || 5000}/uploads/${req.file.filename}`;

    // Ensure profile_picture_url column exists on users table
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url TEXT NULL');

    await pool.query('UPDATE users SET profile_picture_url = $1 WHERE user_id = $2', [fileUrl, user_id]);

    res.status(200).json({
      status: 'success',
      message: 'Profile picture updated successfully.',
      profilePictureUrl: fileUrl,
    });
  } catch (error) {
    console.error('Error updating profile picture:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update profile picture.' });
  }
};
