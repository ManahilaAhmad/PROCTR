import pool from '../db.js';
import { auditSecurityEvent } from './security.js';

async function resolveExamId(req, { source = 'params', field = 'examId', sessionField = null } = {}) {
  const direct = req[source]?.[field];
  if (direct && /^\d+$/.test(String(direct))) return Number(direct);
  if (sessionField) {
    const sessionCode = req[source]?.[sessionField];
    if (!sessionCode) return null;
    const result = await pool.query('SELECT exam_id FROM live_exam_session WHERE UPPER(session_code)=UPPER($1)', [String(sessionCode).trim()]);
    return result.rows[0]?.exam_id || null;
  }
  return null;
}

export async function userHasExamAccess(userId, role, examId, mode = 'read') {
  if (role === 'admin') return true;
  if (role === 'director') return mode === 'read';

  if (role === 'teacher') {
    const result = await pool.query(`
      SELECT 1 FROM exam e
      JOIN teacher actor ON actor.user_id=$1
      LEFT JOIN exam_schedule es ON es.exam_id=e.exam_id
      LEFT JOIN invigilator_assignment ia ON ia.schedule_id=es.schedule_id AND ia.teacher_id=actor.teacher_id
      WHERE e.exam_id=$2 AND (e.teacher_id=actor.teacher_id OR ia.invigilator_assignment_id IS NOT NULL)
    `, [userId, examId]);
    return result.rowCount > 0;
  }

  if (role === 'student') {
    if (mode !== 'read' && mode !== 'participate') return false;
    const result = await pool.query(`
      SELECT 1 FROM exam e
      JOIN enrollment en ON en.course_offering_id=e.course_offering_id AND en.status='Active'
      JOIN student s ON s.student_id=en.student_id
      WHERE e.exam_id=$1 AND s.user_id=$2
    `, [examId, userId]);
    return result.rowCount > 0;
  }

  const profileTable = role === 'hod' ? 'hod' : role === 'dec' ? 'dec_member' : role === 'coordinator' ? 'coordinator' : null;
  if (!profileTable || mode !== 'read') return false;
  const result = await pool.query(`
    SELECT 1 FROM exam e
    JOIN course_offering co ON co.course_offering_id=e.course_offering_id
    JOIN course c ON c.course_id=co.course_id
    JOIN program p ON p.program_id=c.program_id
    JOIN ${profileTable} actor ON actor.user_id=$2 AND actor.department_id=p.department_id
    WHERE e.exam_id=$1
  `, [examId, userId]);
  return result.rowCount > 0;
}

export function requireExamAccess(options = {}) {
  const mode = options.mode || 'read';
  return async (req, res, next) => {
    try {
      const examId = await resolveExamId(req, options);
      if (!examId) return res.status(404).json({ status: 'error', message: 'Exam was not found.' });
      if (!await userHasExamAccess(req.sessionUser.sub, req.sessionUser.role, examId, mode)) {
        await auditSecurityEvent(req, {
          eventType: 'EXAM_OBJECT_ACCESS_DENIED',
          outcome: 'DENIED',
          objectType: 'exam',
          objectId: examId,
          metadata: { mode },
        });
        return res.status(403).json({ status: 'error', message: 'You do not have access to this exam.' });
      }
      req.authorizedExamId = examId;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const requireBodyExamManage = requireExamAccess({ source: 'body', field: 'exam_id', mode: 'manage' });
export const requireExamAccessByBody = (field = 'exam_id', mode = 'read') => requireExamAccess({ source: 'body', field, mode });
export const requireParamExamRead = requireExamAccess({ source: 'params', field: 'examId', mode: 'read' });
export const requireParamExamManage = requireExamAccess({ source: 'params', field: 'examId', mode: 'manage' });
export const requireBodySessionManage = requireExamAccess({ source: 'body', field: '_unused', sessionField: 'session_code', mode: 'manage' });
export const requireParamSessionRead = requireExamAccess({ source: 'params', field: '_unused', sessionField: 'sessionCode', mode: 'read' });
