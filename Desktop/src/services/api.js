/**
 * PROCTR Desktop — API Service Client
 * Connects Desktop client to the Express.js Backend (http://localhost:5000)
 */

const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Perform login against PostgreSQL database
 */
export async function loginUser(email, password, userType) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, user_type: userType }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Login failed. Please check your credentials.');
  }
  return data; // { status: 'success', user: { userId, firstName, lastName, userType, rollNo, ... } }
}

/**
 * Fetch student schedule & enrolled courses from backend
 */
export async function getStudentSchedule(userId) {
  const response = await fetch(`${API_BASE_URL}/student/${userId}/schedule`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch student schedule.');
  }
  return data.schedule || [];
}

/**
 * Fetch teacher exam schedule
 */
export async function getTeacherSchedule(userId) {
  const response = await fetch(`${API_BASE_URL}/teacher/${userId}/schedule`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch teacher schedule.');
  }
  return data.schedule || [];
}

/**
 * Start a desktop exam session log in DB
 */
export async function startDesktopSession(studentId, examId, systemInfo = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}/desktop/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId, exam_id: examId, system_info: systemInfo }),
    });
    return await response.json();
  } catch (err) {
    console.warn('Could not record desktop session start to backend:', err.message);
    return null;
  }
}

/**
 * Stream violation event to database
 */
export async function logDesktopViolation(sessionId, studentId, violation) {
  try {
    const response = await fetch(`${API_BASE_URL}/desktop/violation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        student_id: studentId,
        violation_code: violation.code || 'H0',
        title: violation.title || 'Security Violation',
        description: violation.description || '',
        severity: violation.severity || 'HIGH',
      }),
    });
    return await response.json();
  } catch (err) {
    console.warn('Could not log violation to database:', err.message);
    return null;
  }
}
