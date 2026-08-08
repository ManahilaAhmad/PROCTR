import pool from '../db.js';

/* ===========================================================
   1. CREATE LIVE EXAM SESSION (Invigilator Action)
   Invigilator clicks "Create Session" on a scheduled exam.
   Generates Session ID and 4-digit Passcode.
=========================================================== */
export const createLiveSession = async (req, res) => {
  const { exam_id, course_code, invigilator_id, duration } = req.body;
  try {
    const session_code = (course_code || 'EXAM').toUpperCase().trim();
    const passcode = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit random passcode

    // Ensure live_exam_session table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS live_exam_session (
        live_session_id SERIAL PRIMARY KEY,
        exam_id INT,
        session_code VARCHAR(50) UNIQUE NOT NULL,
        passcode VARCHAR(10) NOT NULL,
        invigilator_id INT,
        is_paper_revealed BOOLEAN DEFAULT FALSE,
        is_timer_started BOOLEAN DEFAULT FALSE,
        duration_minutes INT DEFAULT 90,
        status VARCHAR(30) DEFAULT 'CREATED',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Insert or update existing session for this code
    const result = await pool.query(
      `INSERT INTO live_exam_session (exam_id, session_code, passcode, invigilator_id, duration_minutes, is_paper_revealed, is_timer_started, status)
       VALUES ($1, $2, $3, $4, $5, FALSE, FALSE, 'ACTIVE')
       ON CONFLICT (session_code) DO UPDATE
       SET passcode = EXCLUDED.passcode,
           status = 'ACTIVE',
           is_paper_revealed = FALSE,
           is_timer_started = FALSE
       RETURNING live_session_id, session_code, passcode, duration_minutes, is_paper_revealed, is_timer_started, status`,
      [exam_id || null, session_code, passcode, invigilator_id || null, duration || 90]
    );

    res.status(200).json({
      status: 'success',
      message: 'Live exam session created successfully.',
      session: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating live exam session:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create live session.' });
  }
};

/* ===========================================================
   2. JOIN LIVE EXAM SESSION (Student Action)
   Student enters Session ID & Passcode on Desktop client
=========================================================== */
export const joinLiveSession = async (req, res) => {
  const { session_code, passcode, student_id } = req.body;
  try {
    if (!session_code || !passcode) {
      return res.status(400).json({ status: 'error', message: 'Session ID and Passcode are required.' });
    }

    const codeUpper = session_code.trim().toUpperCase();

    // Query active session
    const sessResult = await pool.query(
      `SELECT * FROM live_exam_session WHERE session_code = $1 AND status = 'ACTIVE'`,
      [codeUpper]
    );

    if (sessResult.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Exam Session ID not found or session has ended.' });
    }

    const session = sessResult.rows[0];

    // Verify passcode
    if (session.passcode !== passcode.trim()) {
      return res.status(401).json({ status: 'error', message: 'Incorrect exam passcode.' });
    }

    // ── LAB NETWORK & IP SUBNET VALIDATION ────────────────────────────
    const reqSimulatedIp = req.body.simulate_external_ip;
    const rawIp = reqSimulatedIp || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const clientIp = String(rawIp).replace('::ffff:', '').trim();

    const labRes = await pool.query(
      `SELECT l.lab_name, l.network_range
       FROM live_exam_session les
       JOIN exam e ON les.exam_id = e.exam_id
       JOIN exam_schedule es ON es.exam_id = e.exam_id
       JOIN lab l ON es.lab_id = l.lab_id
       WHERE les.session_code = $1`,
      [codeUpper]
    );

    if (labRes.rows.length > 0 && labRes.rows[0].network_range) {
      const allowedRange = (labRes.rows[0].network_range || '').trim();
      const labName = labRes.rows[0].lab_name || 'Assigned Lab';

      // If allowedRange is not wildcard '*' or '127.0.0.1'
      if (allowedRange && allowedRange !== '*' && allowedRange !== '127.0.0.1') {
        const allowedSubnet = allowedRange.split('/')[0].split('.').slice(0, 3).join('.');
        const clientSubnet = clientIp.split('.').slice(0, 3).join('.');

        const isMatch = clientIp === allowedRange || clientIp.includes(allowedRange) || (allowedSubnet && clientSubnet === allowedSubnet);

        // If simulated external IP or non-matching IP on restricted lab
        if (!isMatch && (reqSimulatedIp || (clientIp !== '127.0.0.1' && clientIp !== '::1'))) {
          return res.status(403).json({
            status: 'error',
            message: `Network Restriction Violation: Your device IP (${clientIp}) is outside the allowed lab subnet (${allowedRange}) for ${labName}. Joining from external network is blocked.`
          });
        }
      }
    }

    // Record student connected in desktop_exam_session
    await pool.query(`
      CREATE TABLE IF NOT EXISTS desktop_exam_session (
        session_id SERIAL PRIMARY KEY,
        student_id INT,
        exam_id INT,
        system_info JSONB,
        started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        status VARCHAR(30) DEFAULT 'ACTIVE'
      );
    `);

    if (student_id) {
      await pool.query(
        `INSERT INTO desktop_exam_session (student_id, exam_id, status)
         VALUES ($1, $2, 'ACTIVE')`,
        [student_id, session.exam_id]
      );
    }

    // Check if student has already submitted work
    if (student_id) {
      const subCheck = await pool.query(
        `SELECT submission_id FROM student_submission WHERE exam_id = $1 AND student_id = $2`,
        [session.exam_id, student_id]
      );
      if (subCheck.rows.length > 0) {
        return res.status(403).json({
          status: 'error',
          message: 'Exam Completed: You have already submitted your solution. Re-joining is disabled.'
        });
      }
    }

    res.status(200).json({
      status: 'success',
      message: 'Successfully connected to exam session!',
      session: {
        sessionCode: session.session_code,
        examId: session.exam_id,
        isPaperRevealed: session.is_paper_revealed,
        isTimerStarted: session.is_timer_started,
        durationMinutes: session.duration_minutes
      }
    });
  } catch (error) {
    console.error('Error joining live session:', error);
    res.status(500).json({ status: 'error', message: 'Failed to join live session.' });
  }
};

/* ===========================================================
   EXTEND EXAM TIME (Invigilator Action - Max 20 Mins)
=========================================================== */
export const extendTime = async (req, res) => {
  const { session_code, extra_minutes } = req.body;
  try {
    const codeUpper = (session_code || '').trim().toUpperCase();
    const minutesToAdd = Math.min(parseInt(extra_minutes || 10, 10), 20); // Cap at 20 mins

    const result = await pool.query(
      `UPDATE live_exam_session 
       SET duration_minutes = duration_minutes + $1 
       WHERE session_code = $2 RETURNING duration_minutes`,
      [minutesToAdd, codeUpper]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Active session not found.' });
    }

    res.status(200).json({
      status: 'success',
      message: `Exam duration extended by ${minutesToAdd} minutes (Max 20 mins limit).`,
      newDuration: result.rows[0].duration_minutes
    });
  } catch (error) {
    console.error('Error extending time:', error);
    res.status(500).json({ status: 'error', message: 'Failed to extend exam time.' });
  }
};

/* ===========================================================
   END LIVE EXAM SESSION (Invigilator / Time Up)
=========================================================== */
export const endLiveSession = async (req, res) => {
  const { session_code } = req.body;
  try {
    const codeUpper = (session_code || '').trim().toUpperCase();
    await pool.query(
      `UPDATE live_exam_session SET status = 'COMPLETED' WHERE session_code = $1`,
      [codeUpper]
    );
    res.status(200).json({ status: 'success', message: 'Live exam session ended. Submissions locked.' });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ status: 'error', message: 'Failed to end live session.' });
  }
};

/* ===========================================================
   3. REVEAL EXAM PAPER (Invigilator Action)
=========================================================== */
export const revealPaper = async (req, res) => {
  const { session_code } = req.body;
  try {
    const codeUpper = (session_code || '').trim().toUpperCase();
    await pool.query(
      `UPDATE live_exam_session SET is_paper_revealed = TRUE WHERE session_code = $1`,
      [codeUpper]
    );
    res.status(200).json({ status: 'success', message: 'Exam paper is now revealed to students!' });
  } catch (error) {
    console.error('Error revealing paper:', error);
    res.status(500).json({ status: 'error', message: 'Failed to reveal paper.' });
  }
};

/* ===========================================================
   4. START EXAM TIMER (Invigilator Action)
=========================================================== */
export const startTimer = async (req, res) => {
  const { session_code } = req.body;
  try {
    const codeUpper = (session_code || '').trim().toUpperCase();
    await pool.query(
      `UPDATE live_exam_session 
       SET is_timer_started = TRUE, timer_start_time = COALESCE(timer_start_time, NOW()) 
       WHERE session_code = $1`,
      [codeUpper]
    );
    res.status(200).json({ status: 'success', message: 'Exam timer started!' });
  } catch (error) {
    console.error('Error starting timer:', error);
    res.status(500).json({ status: 'error', message: 'Failed to start timer.' });
  }
};

/* ===========================================================
   5. GET LIVE SESSION STATUS (Poll Endpoint)
=========================================================== */
export const getSessionStatus = async (req, res) => {
  const { sessionCode } = req.params;
  try {
    const codeUpper = (sessionCode || '').trim().toUpperCase();
    const result = await pool.query(
      `SELECT les.*, qp.file_path AS exam_paper_url
       FROM live_exam_session les
       LEFT JOIN exam e ON les.exam_id = e.exam_id
       LEFT JOIN question_paper qp ON qp.exam_id = e.exam_id
       WHERE les.session_code = $1`,
      [codeUpper]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Session not found.' });
    }

    const session = result.rows[0];

    // Calculate real-time seconds remaining
    let secondsRemaining = null;
    if (session.is_timer_started && session.timer_start_time) {
      const startTime = new Date(session.timer_start_time).getTime();
      const durationMs = (session.duration_minutes || 90) * 60 * 1000;
      const elapsedMs = Date.now() - startTime;
      secondsRemaining = Math.max(0, Math.floor((durationMs - elapsedMs) / 1000));
    }

    // Fetch connected student details
    const studentsRes = await pool.query(
      `SELECT des.student_id, COALESCE(u.first_name || ' ' || u.last_name, 'Student') AS name, COALESCE(s.registration_no, '231593') AS reg_no, des.started_at
       FROM desktop_exam_session des
       LEFT JOIN student s ON des.student_id = s.student_id
       LEFT JOIN users u ON s.user_id = u.user_id
       WHERE des.status = 'ACTIVE'`
    );

    res.status(200).json({
      status: 'success',
      session: {
        sessionCode: session.session_code,
        passcode: session.passcode,
        isPaperRevealed: session.is_paper_revealed,
        isTimerStarted: session.is_timer_started,
        durationMinutes: session.duration_minutes,
        timerStartTime: session.timer_start_time,
        secondsRemaining: secondsRemaining,
        examPaperUrl: session.exam_paper_url || null,
        connectedStudents: studentsRes.rows.length,
        connectedList: studentsRes.rows
      }
    });
  } catch (error) {
    console.error('Error fetching session status:', error);
    res.status(500).json({ status: 'error', message: 'Error fetching session status.' });
  }
};

/* ===========================================================
   START DESKTOP EXAM SESSION (Legacy / Direct)
=========================================================== */
export const startSession = async (req, res) => {
  const { student_id, exam_id, system_info } = req.body;
  try {
    if (!student_id) {
      return res.status(400).json({ status: 'error', message: 'student_id is required.' });
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS desktop_exam_session (
        session_id SERIAL PRIMARY KEY,
        student_id INT,
        exam_id INT,
        system_info JSONB,
        started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        status VARCHAR(30) DEFAULT 'ACTIVE'
      );
    `);

    const result = await pool.query(
      `INSERT INTO desktop_exam_session (student_id, exam_id, system_info, status)
       VALUES ($1, $2, $3, 'ACTIVE')
       RETURNING session_id, started_at`,
      [student_id, exam_id || null, JSON.stringify(system_info || {})]
    );

    res.status(200).json({
      status: 'success',
      message: 'Desktop exam session started successfully.',
      session: result.rows[0],
    });
  } catch (error) {
    console.error('Error starting desktop exam session:', error);
    res.status(500).json({ status: 'error', message: 'Failed to record desktop session start.' });
  }
};

/* ===========================================================
   LOG DESKTOP SENSOR VIOLATION
=========================================================== */
export const logViolation = async (req, res) => {
  const { session_id, student_id, violation_code, title, description, severity } = req.body;
  try {
    if (!violation_code || !title) {
      return res.status(400).json({ status: 'error', message: 'violation_code and title are required.' });
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS desktop_violation_log (
        violation_id SERIAL PRIMARY KEY,
        session_id INT,
        student_id INT,
        violation_code VARCHAR(20) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        severity VARCHAR(20) DEFAULT 'HIGH',
        detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    const result = await pool.query(
      `INSERT INTO desktop_violation_log (session_id, student_id, violation_code, title, description, severity)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING violation_id, detected_at`,
      [session_id || null, student_id || null, violation_code, title, description, severity || 'HIGH']
    );

    res.status(200).json({
      status: 'success',
      message: 'Violation logged to DB.',
      violation: result.rows[0],
    });
  } catch (error) {
    console.error('Error logging desktop violation:', error);
    res.status(500).json({ status: 'error', message: 'Failed to record violation log.' });
  }
};

/* ===========================================================
   GET ACTIVE SESSIONS COUNT
=========================================================== */
export const getActiveSessionsCount = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(DISTINCT student_id) AS count FROM desktop_exam_session WHERE status = 'ACTIVE'`
    );
    res.status(200).json({ status: 'success', count: parseInt(result.rows[0].count, 10) || 0 });
  } catch (error) {
    res.status(200).json({ status: 'success', count: 0 });
  }
};
