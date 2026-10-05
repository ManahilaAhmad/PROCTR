import pool from '../db.js';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getFileUrl } from '../middleware/upload.js';
import { emitToSession } from '../socketRegistry.js';
import { isAllowedLabIp } from '../middleware/labNetwork.js';
import { auditSecurityEvent, clientIp as requestClientIp } from '../middleware/security.js';

/* ===========================================================
   Human-readable titles for hard violation codes (H1-H4b, H5, N1).
   Source of truth is python_sensors/config.py's VIOLATION_CODES —
   keep these two in sync if a code's meaning ever changes.
=========================================================== */
const HUMAN_MAP = {
  'H1': 'USB Hardware Insertion Detected',
  'H2': 'Unauthorized Application / Website Access',
  'H3': 'Window Focus Loss / Away Breach',
  'H4a': 'Clipboard Buffer Violation',
  'H4b': 'Workspace & Document Tampering',
  'H5': 'Unauthorized Domain / DNS Access',
  'N1': 'Unauthorized Network Subnet / Hotspot Breach'
};

/* ===========================================================
   1. CREATE LIVE EXAM SESSION (Invigilator Action)
   Invigilator clicks "Create Session" on a scheduled exam.
   Generates Session ID and 4-digit Passcode.
=========================================================== */
export const createLiveSession = async (req, res) => {
  const { exam_id, course_code, invigilator_id, duration } = req.body;
  try {
    const session_code = (course_code || 'EXAM').toUpperCase().trim();
    const passcode = crypto.randomInt(100000, 1000000).toString();
    const passcodeHash = await bcrypt.hash(passcode, 12);

    const completedSession = await pool.query(
      `SELECT 1 FROM live_exam_session WHERE exam_id=$1 AND status IN ('ENDED','COMPLETED') LIMIT 1`,
      [exam_id]
    ).catch(() => ({ rowCount: 0 }));
    if (completedSession.rowCount) {
      return res.status(409).json({ status: 'error', message: 'This exam has already been conducted and cannot be started again.' });
    }

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

    // Insert or update existing session for this code.
    // Reusing the same session_code (e.g. re-running the same course's exam)
    // reuses the same live_session_id row — reset every stateful field so
    // it behaves like a genuinely fresh session, not a continuation of
    // whatever was left over from the last time this code was used.
    const result = await pool.query(
      `INSERT INTO live_exam_session (exam_id, session_code, passcode, passcode_hash, passcode_expires_at, invigilator_id, duration_minutes, is_paper_revealed, is_timer_started, status)
       VALUES ($1, $2, '******', $3, NOW() + INTERVAL '8 hours', $4, $5, FALSE, FALSE, 'ACTIVE')
       ON CONFLICT (session_code) DO UPDATE
       SET exam_id = EXCLUDED.exam_id,
           passcode = '******',
           passcode_hash = EXCLUDED.passcode_hash,
           passcode_expires_at = EXCLUDED.passcode_expires_at,
           invigilator_id = EXCLUDED.invigilator_id,
           status = 'ACTIVE',
           is_paper_revealed = FALSE,
           is_timer_started = FALSE,
           timer_start_time = NULL,
           duration_minutes = EXCLUDED.duration_minutes
       WHERE live_exam_session.status <> 'ACTIVE'
       RETURNING live_session_id, session_code, duration_minutes, is_paper_revealed, is_timer_started, status`,
      [exam_id || null, session_code, passcodeHash, invigilator_id || null, duration || 90]
    );

    // A duplicate click/request must never rotate the passcode behind the
    // invigilator's screen. With the conditional upsert above, PostgreSQL
    // returns no row when this course code already has an active session.
    if (!result.rowCount) {
      return res.status(409).json({
        status: 'error',
        message: 'A live session for this course is already active. Continue using the existing session or end it first.'
      });
    }

    const newLiveSessionId = result.rows[0].live_session_id;

    // ── FRESH START: wipe any violations/connected-student rows left over
    //    from a PREVIOUS run of this exact session code. Without this, every
    //    "Create Live Session" click on a course code you've tested before
    //    would immediately flood the live feed with old historical data the
    //    moment the room opens — before any student has even joined this run.
    await pool.query(`DELETE FROM desktop_violation_log WHERE session_id = $1`, [newLiveSessionId]).catch(() => {});
    await pool.query(`DELETE FROM desktop_exam_session WHERE live_session_id = $1`, [newLiveSessionId]).catch(() => {});

    await auditSecurityEvent(req, { eventType: 'LIVE_SESSION_CREATED', outcome: 'SUCCESS', objectType: 'exam', objectId: exam_id });
    res.status(200).json({
      status: 'success',
      message: 'Live exam session created successfully.',
      session: { ...result.rows[0], passcode },
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
      await auditSecurityEvent(req, { eventType: 'EXAM_JOIN_FAILED', outcome: 'DENIED', metadata: { reason: 'unknown_session' } });
      return res.status(401).json({ status: 'error', message: 'Invalid exam session or passcode.' });
    }

    const session = sessResult.rows[0];

    const joinIp = requestClientIp(req) || 'unknown';
    const recentFailures = await pool.query(`
      SELECT COUNT(*)::int AS failures FROM exam_join_attempt
      WHERE live_session_id=$1 AND student_id=$2 AND ip_address=$3 AND succeeded=FALSE
        AND attempted_at > NOW() - INTERVAL '10 minutes'
    `, [session.live_session_id, student_id || null, joinIp]);
    if (recentFailures.rows[0].failures >= 5) {
      await auditSecurityEvent(req, { eventType: 'EXAM_JOIN_LOCKED', outcome: 'DENIED', objectType: 'exam', objectId: session.exam_id });
      return res.status(429).json({ status: 'error', message: 'Too many incorrect exam passcodes. Wait 10 minutes or contact the invigilator.' });
    }

    const passcodeExpired = session.passcode_expires_at && new Date(session.passcode_expires_at).getTime() <= Date.now();
    const passcodeMatches = session.passcode_hash
      ? await bcrypt.compare(passcode.trim(), session.passcode_hash)
      : session.passcode === passcode.trim();
    if (passcodeExpired || !passcodeMatches) {
      await pool.query(`INSERT INTO exam_join_attempt (live_session_id,student_id,ip_address,succeeded) VALUES ($1,$2,$3,FALSE)`, [session.live_session_id, student_id || null, joinIp]);
      await auditSecurityEvent(req, { eventType: 'EXAM_JOIN_FAILED', outcome: 'DENIED', objectType: 'exam', objectId: session.exam_id, metadata: { reason: passcodeExpired ? 'expired_passcode' : 'incorrect_passcode' } });
      return res.status(401).json({ status: 'error', message: 'Invalid exam session or passcode.' });
    }

    if (!student_id) {
      return res.status(400).json({ status: 'error', message: 'A valid student profile is required to join this exam.' });
    }
    const enrollment = await pool.query(`
      SELECT 1 FROM live_exam_session les
      JOIN exam e ON e.exam_id=les.exam_id
      JOIN enrollment en ON en.course_offering_id=e.course_offering_id
      WHERE les.live_session_id=$1 AND en.student_id=$2 AND en.status='Active'
    `, [session.live_session_id, student_id]);
    if (!enrollment.rowCount) {
      await auditSecurityEvent(req, { eventType: 'EXAM_JOIN_NOT_ENROLLED', outcome: 'DENIED', objectType: 'exam', objectId: session.exam_id });
      return res.status(403).json({ status: 'error', message: 'You are not actively enrolled in the course for this exam.' });
    }

    const previousCompletion = await pool.query(
      `SELECT 1 FROM desktop_exam_session WHERE live_session_id=$1 AND student_id=$2 AND status='COMPLETED' LIMIT 1`,
      [session.live_session_id, student_id]
    ).catch(() => ({ rowCount: 0 }));
    if (previousCompletion.rowCount) {
      return res.status(409).json({ status: 'error', message: 'You have already submitted and left this exam.' });
    }

    // ── LAB NETWORK & IP SUBNET VALIDATION ────────────────────────────
    const reqSimulatedIp = process.env.NODE_ENV === 'test' ? req.body.simulate_external_ip : null;
    const rawIp = reqSimulatedIp || req.ip || req.socket.remoteAddress || '127.0.0.1';
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

      if (allowedRange && allowedRange !== '*') {
        const settingsResult = await pool.query(`SELECT setting_key,setting_value FROM system_setting WHERE setting_key IN ('allow_loopback_exam_access','clipboard_threshold_chars','focus_loss_seconds')`).catch(() => ({ rows: [] }));
        const securitySettings = Object.fromEntries(settingsResult.rows.map(row => [row.setting_key, row.setting_value]));
        const isLoopback = clientIp === '127.0.0.1' || clientIp === '::1';
        const isMatch = isAllowedLabIp(clientIp, allowedRange) || (securitySettings.allow_loopback_exam_access === true && isLoopback);
        if (!isMatch) {
          const existingRequest = await pool.query(`
            SELECT request_id,status,requested_ip,expires_at
            FROM network_access_request
            WHERE live_session_id=$1 AND student_id=$2
          `, [session.live_session_id, student_id]);
          const existing = existingRequest.rows[0];
          const requestIsCurrent = existing && existing.requested_ip === clientIp
            && new Date(existing.expires_at).getTime() > Date.now();

          if (!(requestIsCurrent && existing.status === 'APPROVED')) {
            if (requestIsCurrent && existing.status === 'REJECTED') {
              return res.status(403).json({
                status: 'rejected',
                message: 'The invigilator rejected your request to join from this network.'
              });
            }

            const requestResult = await pool.query(`
              INSERT INTO network_access_request
                (live_session_id,student_id,requested_ip,allowed_network,lab_name,status,student_reason,requested_at,expires_at,decided_by,decided_at,decision_reason)
              VALUES ($1,$2,$3,$4,$5,'PENDING',$6,NOW(),NOW() + INTERVAL '10 minutes',NULL,NULL,NULL)
              ON CONFLICT (live_session_id,student_id) DO UPDATE
              SET requested_ip=EXCLUDED.requested_ip,
                  allowed_network=EXCLUDED.allowed_network,
                  lab_name=EXCLUDED.lab_name,
                  status=CASE
                    WHEN network_access_request.status='PENDING'
                     AND network_access_request.requested_ip=EXCLUDED.requested_ip
                     AND network_access_request.expires_at>NOW()
                    THEN network_access_request.status ELSE 'PENDING' END,
                  student_reason=EXCLUDED.student_reason,
                  requested_at=CASE
                    WHEN network_access_request.status='PENDING'
                     AND network_access_request.requested_ip=EXCLUDED.requested_ip
                     AND network_access_request.expires_at>NOW()
                    THEN network_access_request.requested_at ELSE NOW() END,
                  expires_at=CASE
                    WHEN network_access_request.status='PENDING'
                     AND network_access_request.requested_ip=EXCLUDED.requested_ip
                     AND network_access_request.expires_at>NOW()
                    THEN network_access_request.expires_at ELSE NOW() + INTERVAL '10 minutes' END,
                  decided_by=NULL,decided_at=NULL,decision_reason=NULL
              RETURNING request_id,status,expires_at
            `, [session.live_session_id, student_id, clientIp, allowedRange, labName, String(req.body?.network_reason || '').trim().slice(0, 500) || null]);
            const accessRequest = requestResult.rows[0];
            emitToSession(codeUpper, 'network_access_request', { requestId: accessRequest.request_id });
            await auditSecurityEvent(req, { eventType: 'NETWORK_ACCESS_REQUESTED', outcome: 'INFO', objectType: 'exam', objectId: session.exam_id, metadata: { requestedIp: clientIp, allowedRange } });
            return res.status(202).json({
              status: 'pending_network_approval',
              message: `Your IP (${clientIp}) is outside ${allowedRange}. Waiting for the invigilator's approval.`,
              requestId: accessRequest.request_id,
              expiresAt: accessRequest.expires_at
            });
          }
        }
      }
    }

    // Record student connected in desktop_exam_session
    await pool.query(`
      CREATE TABLE IF NOT EXISTS desktop_exam_session (
        session_id SERIAL PRIMARY KEY,
        student_id INT,
        exam_id INT,
        live_session_id INT,
        system_info JSONB,
        started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        status VARCHAR(30) DEFAULT 'ACTIVE'
      );
    `);
    // Migration safety: add live_session_id if the table pre-dates this column
    await pool.query(`
      ALTER TABLE desktop_exam_session ADD COLUMN IF NOT EXISTS live_session_id INT;
    `).catch(() => {});

    if (student_id) {
      // Close out any stale ACTIVE rows this student may have left behind
      // from a previous session for the same exam (e.g. a session that was
      // ended and re-created), so they don't leak into a new session's
      // connected-students list.
      await pool.query(
        `UPDATE desktop_exam_session SET status = 'STALE' 
         WHERE student_id = $1 AND exam_id = $2 AND status = 'ACTIVE' AND (live_session_id IS DISTINCT FROM $3)`,
        [student_id, session.exam_id, session.live_session_id]
      ).catch(() => {});

      await pool.query(
        `INSERT INTO desktop_exam_session (student_id, exam_id, live_session_id, status)
         VALUES ($1, $2, $3, 'ACTIVE')`,
        [student_id, session.exam_id, session.live_session_id]
      );
    }

    // NOTE: previously this blocked rejoining if a student_submission row
    // already existed for this exam. That conflicts with allowing both
    // auto-submit (at session end/timer expiry) AND manual resubmission —
    // a student needs to be able to rejoin and fix/redo their submission
    // as long as the live session itself is still ACTIVE (already
    // enforced above). The session ending is what should lock things,
    // not the mere existence of an earlier submission attempt.

    const policyResult = await pool.query(`SELECT setting_key,setting_value FROM system_setting WHERE setting_key IN ('clipboard_threshold_chars','focus_loss_seconds')`).catch(() => ({ rows: [] }));
    const securityPolicy = Object.fromEntries(policyResult.rows.map(row => [row.setting_key, row.setting_value]));

    await pool.query(`INSERT INTO exam_join_attempt (live_session_id,student_id,ip_address,succeeded) VALUES ($1,$2,$3,TRUE)`, [session.live_session_id, student_id, joinIp]);
    await auditSecurityEvent(req, { eventType: 'EXAM_JOIN_SUCCEEDED', outcome: 'SUCCESS', objectType: 'exam', objectId: session.exam_id });
    res.status(200).json({
      status: 'success',
      message: 'Successfully connected to exam session!',
      session: {
        session_id: session.live_session_id,
        sessionCode: session.session_code,
        examId: session.exam_id,
        isPaperRevealed: session.is_paper_revealed,
        isTimerStarted: session.is_timer_started,
        durationMinutes: session.duration_minutes,
        labNetworkRange: labRes.rows[0]?.network_range || null,
        securityPolicy
      }
    });
  } catch (error) {
    console.error('Error joining live session:', error);
    res.status(500).json({ status: 'error', message: 'Failed to join live session.' });
  }
};

export const getNetworkAccessRequestStatus = async (req, res) => {
  try {
    const requestId = Number(req.params.requestId);
    if (!Number.isInteger(requestId) || requestId < 1) {
      return res.status(400).json({ status: 'error', message: 'Invalid network access request.' });
    }
    const result = await pool.query(`
      SELECT nar.request_id,nar.status,nar.expires_at,les.session_code,s.user_id
      FROM network_access_request nar
      JOIN live_exam_session les ON les.live_session_id=nar.live_session_id
      JOIN student s ON s.student_id=nar.student_id
      WHERE nar.request_id=$1
    `, [requestId]);
    const request = result.rows[0];
    if (!request || (req.sessionUser.role !== 'admin' && Number(request.user_id) !== Number(req.sessionUser.sub))) {
      return res.status(404).json({ status: 'error', message: 'Network access request was not found.' });
    }
    let status = request.status;
    if (status === 'PENDING' && new Date(request.expires_at).getTime() <= Date.now()) {
      status = 'EXPIRED';
      await pool.query(`UPDATE network_access_request SET status='EXPIRED' WHERE request_id=$1 AND status='PENDING'`, [requestId]);
    }
    return res.json({ status: 'success', request: { requestId: request.request_id, decision: status, sessionCode: request.session_code, expiresAt: request.expires_at } });
  } catch (error) {
    console.error('Error checking network access request:', error);
    return res.status(500).json({ status: 'error', message: 'Unable to check the network access request.' });
  }
};

export const decideNetworkAccessRequest = async (req, res) => {
  try {
    const requestId = Number(req.params.requestId);
    const decision = String(req.body?.decision || '').trim().toUpperCase();
    const reason = String(req.body?.reason || '').trim().slice(0, 500) || null;
    if (!Number.isInteger(requestId) || !['APPROVED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ status: 'error', message: 'A valid request and decision are required.' });
    }
    const result = await pool.query(`
      UPDATE network_access_request nar
      SET status=$2,decision_reason=$3,decided_by=$4,decided_at=NOW(),
          expires_at=CASE WHEN $2='APPROVED' THEN NOW() + INTERVAL '8 hours' ELSE expires_at END
      FROM live_exam_session les
      WHERE nar.request_id=$1 AND les.live_session_id=nar.live_session_id
        AND les.status='ACTIVE' AND nar.status='PENDING' AND nar.expires_at>NOW()
        AND UPPER(les.session_code)=UPPER($5)
      RETURNING nar.request_id,nar.student_id,nar.requested_ip,nar.status,les.session_code,les.exam_id
    `, [requestId, decision, reason, req.sessionUser.sub, req.body.session_code]);
    if (!result.rowCount) {
      return res.status(409).json({ status: 'error', message: 'This request is no longer pending or the session has ended.' });
    }
    const decided = result.rows[0];
    emitToSession(decided.session_code, 'network_access_decision', { requestId, decision });
    await auditSecurityEvent(req, {
      eventType: decision === 'APPROVED' ? 'NETWORK_ACCESS_APPROVED' : 'NETWORK_ACCESS_REJECTED',
      outcome: 'SUCCESS', objectType: 'exam', objectId: decided.exam_id,
      metadata: { requestId, studentId: decided.student_id, requestedIp: decided.requested_ip, reason }
    });
    return res.json({ status: 'success', message: decision === 'APPROVED' ? 'Student network access approved.' : 'Student network access rejected.' });
  } catch (error) {
    console.error('Error deciding network access request:', error);
    return res.status(500).json({ status: 'error', message: 'Unable to process the network access request.' });
  }
};

/* ===========================================================
   EXTEND EXAM TIME (Invigilator Action - Max 20 Mins)
=========================================================== */
export const extendTime = async (req, res) => {
  const { session_code, extra_minutes } = req.body;
  try {
    const codeUpper = (session_code || '').trim().toUpperCase();
    const settingResult = await pool.query(`SELECT setting_value FROM system_setting WHERE setting_key='max_exam_extension_minutes'`).catch(() => ({ rows: [] }));
    const maxExtension = Number(settingResult.rows[0]?.setting_value ?? 20);
    if (maxExtension < 1) {
      return res.status(403).json({ status: 'error', message: 'Exam time extensions are disabled by the system administrator.' });
    }
    const requestedMinutes = parseInt(extra_minutes || 10, 10);
    if (!Number.isInteger(requestedMinutes) || requestedMinutes < 1) {
      return res.status(400).json({ status: 'error', message: 'Extension must be a positive number of minutes.' });
    }
    const minutesToAdd = Math.min(requestedMinutes, maxExtension);

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
      message: `Exam duration extended by ${minutesToAdd} minutes (maximum ${maxExtension} minutes).`,
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
    await pool.query(`
      UPDATE network_access_request SET status='EXPIRED'
      WHERE live_session_id=(SELECT live_session_id FROM live_exam_session WHERE session_code=$1)
        AND status IN ('PENDING','APPROVED')
    `, [codeUpper]).catch(() => {});
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
      `SELECT les.*, qp.file_path AS exam_paper_url,
              e.starter_files_path AS starter_file_url,
              (SELECT ef.original_name FROM exam_file ef
               WHERE ef.exam_id=e.exam_id AND ef.file_type='starter_file'
               ORDER BY ef.uploaded_at DESC LIMIT 1) AS starter_file_name
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
    const warningResult = await pool.query(`SELECT setting_value FROM system_setting WHERE setting_key='exam_warning_minutes'`).catch(() => ({ rows: [] }));
    const warningSeconds = Number(warningResult.rows[0]?.setting_value ?? 5) * 60;

    // Calculate real-time seconds remaining
    let secondsRemaining = null;
    if (session.is_timer_started && session.timer_start_time) {
      const startTime = new Date(session.timer_start_time).getTime();
      const durationMs = (session.duration_minutes || 90) * 60 * 1000;
      const elapsedMs = Date.now() - startTime;
      secondsRemaining = Math.max(0, Math.floor((durationMs - elapsedMs) / 1000));
    }

    // Fetch connected student details — STRICTLY for this live session only,
    // so students from a different/older exam session never leak in.
    const studentsRes = await pool.query(
      `SELECT DISTINCT ON (des.student_id) des.student_id, COALESCE(u.first_name || ' ' || u.last_name, 'Candidate') AS name, COALESCE(s.registration_no, '231593') AS reg_no, des.started_at
       FROM desktop_exam_session des
       LEFT JOIN student s ON des.student_id = s.student_id
       LEFT JOIN users u ON s.user_id = u.user_id
       WHERE des.status = 'ACTIVE' AND des.live_session_id = $1
       ORDER BY des.student_id, des.started_at DESC`,
      [session.live_session_id]
    );

    // Fetch recent violation logs specifically for THIS live exam session.
    // STRICT match only — no "show everything" fallback. A violation only
    // ever belongs to one live_exam_session (by its real PK, live_session_id).
    const violationsRes = await pool.query(
      `SELECT dvl.*, COALESCE(u.first_name || ' ' || u.last_name, 'Candidate') AS student_name, COALESCE(s.registration_no, '231593') AS reg_no
       FROM desktop_violation_log dvl
       LEFT JOIN student s ON dvl.student_id = s.student_id
       LEFT JOIN users u ON s.user_id = u.user_id
       WHERE dvl.session_id = $1
      ORDER BY dvl.detected_at DESC`,
      [session.live_session_id]
    ).catch(() => ({ rows: [] }));

    const formattedViolations = (violationsRes.rows || []).map(v => ({
      id: v.violation_id,
      violation_code: v.violation_code,
      student_id: v.student_id,
      reg_no: v.reg_no || '231593',
      name: v.student_name || 'Candidate',
      surface_title: HUMAN_MAP[v.violation_code] || v.title || 'Security Violation',
      description: v.description || '',
      severity: v.severity || 'HIGH',
      timestamp: v.detected_at,
      lastDetectedAt: v.last_detected_at || v.detected_at,
      occurrenceCount: v.occurrence_count || 1,
      occurrences: Array.isArray(v.occurrences) && v.occurrences.length > 0
        ? v.occurrences
        : [{ timestamp: v.detected_at, title: v.title, description: v.description || '', severity: v.severity || 'HIGH' }],
    }));

    const canMonitor = ['teacher', 'admin'].includes(req.sessionUser?.role);
    const networkRequests = canMonitor ? await pool.query(`
      SELECT nar.request_id,nar.student_id,nar.requested_ip,nar.allowed_network,nar.lab_name,
             nar.student_reason,nar.requested_at,nar.expires_at,
             COALESCE(u.first_name || ' ' || u.last_name,'Candidate') AS student_name,
             s.registration_no
      FROM network_access_request nar
      JOIN student s ON s.student_id=nar.student_id
      JOIN users u ON u.user_id=s.user_id
      WHERE nar.live_session_id=$1 AND nar.status='PENDING' AND nar.expires_at>NOW()
      ORDER BY nar.requested_at
    `, [session.live_session_id]) : { rows: [] };
    res.status(200).json({
      status: 'success',
      session: {
        sessionCode: session.session_code,
        status: session.status,
        isSessionEnded: session.status === 'ENDED' || session.status === 'COMPLETED',
        isPaperRevealed: session.is_paper_revealed,
        isTimerStarted: session.is_timer_started,
        durationMinutes: session.duration_minutes,
        timerStartTime: session.timer_start_time,
        secondsRemaining: secondsRemaining,
        warningSeconds,
        examPaperUrl: session.is_paper_revealed && session.exam_paper_url ? getFileUrl(req, session.exam_paper_url) : null,
        starterFileUrl: session.is_paper_revealed && session.starter_file_url ? getFileUrl(req, session.starter_file_url) : null,
        starterFileName: session.is_paper_revealed ? session.starter_file_name : null,
        connectedStudents: canMonitor ? studentsRes.rows.length : undefined,
        connectedList: canMonitor ? studentsRes.rows : undefined,
        recentViolations: canMonitor ? formattedViolations : undefined,
        pendingNetworkRequests: canMonitor ? networkRequests.rows : undefined
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
  const { session_code, student_id, violation_code, title, description, severity } = req.body;
  try {
    if (!violation_code || !title) {
      return res.status(400).json({ status: 'error', message: 'violation_code and title are required.' });
    }
    if (!session_code) {
      return res.status(400).json({ status: 'error', message: 'session_code is required to log a violation.' });
    }
    if (!student_id) {
      return res.status(400).json({ status: 'error', message: 'student_id is required to log a violation.' });
    }

    const resolvedSessionCode = session_code.trim().toUpperCase();

    // ── STRICT RESOLUTION #1: the session must actually exist and be ACTIVE ──
    // No "fall back to most recent session" — a violation that can't be tied
    // to a real, currently-running session is rejected outright.
    const sessLookup = await pool.query(
      `SELECT live_session_id FROM live_exam_session WHERE session_code = $1 AND status = 'ACTIVE'`,
      [resolvedSessionCode]
    );
    if (sessLookup.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: `No active live session found for code "${resolvedSessionCode}" — violation discarded.`
      });
    }
    const targetSessionId = sessLookup.rows[0].live_session_id;

    // ── STRICT RESOLUTION #2: the student must have actually joined THIS
    //    session (an ACTIVE desktop_exam_session row for this live_session_id).
    //    This is what enforces "no violations before the student joins" —
    //    if there's no join record yet, the sensor event is dropped, not shown.
    const joinCheck = await pool.query(
      `SELECT 1 FROM desktop_exam_session WHERE student_id = $1 AND live_session_id = $2 AND status = 'ACTIVE' LIMIT 1`,
      [student_id, targetSessionId]
    ).catch(() => ({ rows: [] }));

    if (joinCheck.rows.length === 0) {
      return res.status(403).json({
        status: 'error',
        message: 'Violation rejected: this student has not joined this live session.'
      });
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
        detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    const result = await pool.query(
      `INSERT INTO desktop_violation_log
         (session_id, student_id, violation_code, title, description, severity)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING violation_id, session_id, student_id, violation_code, title, description, severity, detected_at`,
      [targetSessionId, student_id, violation_code, title, description || '', severity || 'HIGH']
    );

    const savedRow = result.rows[0];

    // ── Look up student name/reg_no so the teacher's live feed can render
    //    immediately without needing a separate lookup ────────────────
    let studentName = 'Candidate';
    let regNo = '231593';
    const studentInfo = await pool.query(
      `SELECT COALESCE(u.first_name || ' ' || u.last_name, 'Candidate') AS name, COALESCE(s.registration_no, '231593') AS reg_no
       FROM student s
       LEFT JOIN users u ON s.user_id = u.user_id
       WHERE s.student_id = $1`,
      [student_id]
    ).catch(() => ({ rows: [] }));
    if (studentInfo.rows && studentInfo.rows.length > 0) {
      studentName = studentInfo.rows[0].name || studentName;
      regNo = studentInfo.rows[0].reg_no || regNo;
    }

    // ── Push instantly to any teacher dashboard(s) watching this session ──
    const liveViolation = {
      id: savedRow.violation_id,
      violation_code: savedRow.violation_code,
      student_id: savedRow.student_id,
      reg_no: regNo,
      name: studentName,
      surface_title: HUMAN_MAP[savedRow.violation_code] || savedRow.title || 'Security Violation',
      description: savedRow.description || '',
      severity: savedRow.severity || 'HIGH',
      timestamp: savedRow.detected_at,
    };
    emitToSession(resolvedSessionCode, 'live_violation', liveViolation);

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

export const leaveLiveSession = async (req, res) => {
  const { session_code, student_id } = req.body;
  try {
    const result = await pool.query(`
      UPDATE desktop_exam_session des
      SET status='COMPLETED'
      FROM live_exam_session les
      WHERE des.live_session_id=les.live_session_id
        AND les.session_code=$1 AND des.student_id=$2 AND des.status='ACTIVE'
      RETURNING des.session_id
    `, [(session_code || '').trim().toUpperCase(), student_id]);
    if (!result.rowCount) {
      return res.status(404).json({ status: 'error', message: 'No active student exam session was found.' });
    }
    return res.status(200).json({ status: 'success', message: 'You have safely left the exam environment.' });
  } catch (error) {
    console.error('Error leaving live session:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to leave the exam environment.' });
  }
};
