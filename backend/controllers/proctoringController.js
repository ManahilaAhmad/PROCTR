import pool from '../db.js';
import { getIO } from '../socketRegistry.js';

/* ===========================================================
   RECORD A PROCTORING EVENT (Hard violation or Fuzzy result)
=========================================================== */
export const recordEvent = async (req, res) => {
  const { exam_id, student_id, event_type, severity, description, metadata } = req.body;

  if (!exam_id || !student_id || !event_type || !severity || !description) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing required fields: exam_id, student_id, event_type, severity, description.'
    });
  }

  try {
    const result = await pool.query(`
      INSERT INTO proctoring_event (exam_id, student_id, event_type, severity, description, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [exam_id, student_id, event_type, severity, description, metadata ? JSON.stringify(metadata) : null]);

    const event = result.rows[0];

    // Fetch student info for real-time dashboard broadcast
    const studentInfo = await pool.query(`
      SELECT s.student_id, s.registration_no, u.first_name, u.last_name
      FROM student s
      JOIN users u ON s.user_id = u.user_id
      WHERE s.student_id = $1
    `, [student_id]);

    const payload = {
      ...event,
      student: studentInfo.rows[0] || null
    };

    // Broadcast live to teacher room for this exam
    const io = getIO();
    if (io) {
      io.to(`exam:${exam_id}`).emit('proctoring_event', payload);
    }

    res.status(201).json({ status: 'success', event: payload });
  } catch (error) {
    console.error('Error recording proctoring event:', error);
    res.status(500).json({ status: 'error', message: 'Failed to record proctoring event.' });
  }
};

/* ===========================================================
   EVALUATE FUZZY AI (Proxy to Python Sidecar on http://127.0.0.1:5050)
=========================================================== */
export const evaluateFuzzy = async (req, res) => {
  const { exam_id, student_id, paste_typing_mismatch, paste_source_trust, window_switch_pattern } = req.body;

  if (!exam_id || !student_id) {
    return res.status(400).json({ status: 'error', message: 'exam_id and student_id are required.' });
  }

  try {
    // Call Python scikit-fuzzy sidecar API
    const response = await fetch('http://127.0.0.1:5050/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paste_typing_mismatch,
        paste_source_trust,
        window_switch_pattern,
        student_id,
        exam_id
      })
    });

    if (!response.ok) {
      throw new Error(`Fuzzy AI sidecar returned HTTP ${response.status}`);
    }

    const data = await response.json();
    const evalResult = data.evaluation;

    // Log fuzzy event if risk level is Medium or High (or Low for record)
    const eventType = `FUZZY_${evalResult.level.toUpperCase()}`; // FUZZY_LOW, FUZZY_MEDIUM, FUZZY_HIGH
    
    const dbResult = await pool.query(`
      INSERT INTO proctoring_event (exam_id, student_id, event_type, severity, description, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      exam_id,
      student_id,
      eventType,
      evalResult.level,
      `Fuzzy AI (${evalResult.level} Risk, Score ${evalResult.score}): ${evalResult.reason}`,
      JSON.stringify({ ...evalResult, inputs: { paste_typing_mismatch, paste_source_trust, window_switch_pattern } })
    ]);

    const event = dbResult.rows[0];

    const studentInfo = await pool.query(`
      SELECT s.student_id, s.registration_no, u.first_name, u.last_name
      FROM student s
      JOIN users u ON s.user_id = u.user_id
      WHERE s.student_id = $1
    `, [student_id]);

    const payload = {
      ...event,
      student: studentInfo.rows[0] || null
    };

    const io = getIO();
    if (io) {
      io.to(`exam:${exam_id}`).emit('proctoring_event', payload);
    }

    res.status(200).json({ status: 'success', evaluation: evalResult, event: payload });
  } catch (error) {
    console.error('Error in fuzzy evaluation:', error.message);
    res.status(500).json({ status: 'error', message: `Fuzzy AI Sidecar error: ${error.message}` });
  }
};

/* ===========================================================
   GET ALL EVENTS FOR AN EXAM (for Live Dashboard & Reports)
=========================================================== */
export const getExamEvents = async (req, res) => {
  const { examId } = req.params;
  try {
    const result = await pool.query(`
      SELECT pe.*, s.registration_no, u.first_name || ' ' || u.last_name as student_name
      FROM proctoring_event pe
      JOIN student s ON pe.student_id = s.student_id
      JOIN users u ON s.user_id = u.user_id
      WHERE pe.exam_id = $1
      ORDER BY pe.created_at DESC
    `, [examId]);

    res.status(200).json({ status: 'success', events: result.rows });
  } catch (error) {
    console.error('Error fetching exam events:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch proctoring events.' });
  }
};

/* ===========================================================
   GET PER-STUDENT PROCTORING SUMMARY FOR AN EXAM
=========================================================== */
export const getExamSummary = async (req, res) => {
  const { examId } = req.params;
  try {
    const summaryRes = await pool.query(`
      SELECT 
        s.student_id,
        s.registration_no,
        u.first_name || ' ' || u.last_name as student_name,
        COUNT(pe.event_id) as total_violations,
        COUNT(CASE WHEN pe.severity = 'Hard' THEN 1 END) as hard_violations,
        COUNT(CASE WHEN pe.severity = 'High' THEN 1 END) as high_risk_count,
        COUNT(CASE WHEN pe.severity = 'Medium' THEN 1 END) as medium_risk_count,
        COUNT(CASE WHEN pe.severity = 'Low' THEN 1 END) as low_risk_count,
        MAX(pe.created_at) as last_event_at,
        CASE 
          WHEN COUNT(CASE WHEN pe.severity = 'Hard' THEN 1 END) > 0 THEN 'Hard'
          WHEN COUNT(CASE WHEN pe.severity = 'High' THEN 1 END) > 0 THEN 'High'
          WHEN COUNT(CASE WHEN pe.severity = 'Medium' THEN 1 END) > 0 THEN 'Medium'
          WHEN COUNT(CASE WHEN pe.severity = 'Low' THEN 1 END) > 0 THEN 'Low'
          ELSE 'Clean'
        END as overall_risk_tier
      FROM enrollment en
      JOIN course_offering co ON en.course_offering_id = co.course_offering_id
      JOIN exam e ON e.course_offering_id = co.course_offering_id
      JOIN student s ON en.student_id = s.student_id
      JOIN users u ON s.user_id = u.user_id
      LEFT JOIN proctoring_event pe ON pe.student_id = s.student_id AND pe.exam_id = e.exam_id
      WHERE e.exam_id = $1
      GROUP BY s.student_id, s.registration_no, u.first_name, u.last_name
      ORDER BY 
        CASE 
          WHEN COUNT(CASE WHEN pe.severity = 'Hard' THEN 1 END) > 0 THEN 1
          WHEN COUNT(CASE WHEN pe.severity = 'High' THEN 1 END) > 0 THEN 2
          WHEN COUNT(CASE WHEN pe.severity = 'Medium' THEN 1 END) > 0 THEN 3
          WHEN COUNT(CASE WHEN pe.severity = 'Low' THEN 1 END) > 0 THEN 4
          ELSE 5
        END ASC,
        COUNT(pe.event_id) DESC,
        u.last_name ASC
    `, [examId]);

    res.status(200).json({ status: 'success', summary: summaryRes.rows });
  } catch (error) {
    console.error('Error fetching exam summary:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch exam proctoring summary.' });
  }
};
