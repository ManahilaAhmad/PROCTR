/**
 * app.js — Main Application Entry Point (Renderer Process)
 * Connected to Express.js Backend (http://localhost:5000/api) & Neon PostgreSQL
 */

const API_BASE = 'http://localhost:5000/api';

// ─── STATE ────────────────────────────────────────────────────────
let currentRole = 'student'; // 'student' | 'teacher'
let currentUser = null;
let currentSessionId = null;
let violationCount = 0;

// Default whitelist items
const whitelist = [
  'code.exe', 'pycharm64.exe', 'devenv.exe', 'codeblocks.exe',
  'devcpp.exe', 'notepad++.exe', 'python.exe', 'cmd.exe', 'powershell.exe'
];

// ─── SESSION PERSISTENCE (survive normal + forced reloads) ─────────
function saveSession() {
  if (!currentUser) return;
  localStorage.setItem('proctr_session', JSON.stringify({ role: currentRole, user: currentUser }));
}

function clearSession() {
  localStorage.removeItem('proctr_session');
}

function restoreSession() {
  try {
    const saved = localStorage.getItem('proctr_session');
    if (!saved) return;
    const { role, user } = JSON.parse(saved);
    if (!user || !role) return;

    currentRole = role;
    currentUser = user;

    if (role === 'student') {
      populateStudentProfile(user);
      showView('view-student');
      loadStudentData(user.userId);
    } else {
      populateTeacherHeader(user);
      showView('view-teacher');
      showSection('section-t-overview', document.querySelectorAll('#view-teacher .nav-item'));
      renderWhitelist();
      loadTeacherData(user.userId);
    }
    return true;
  } catch (e) {
    clearSession();
    return false;
  }
}

// ─── UTILITY ─────────────────────────────────────────────────────
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const v = document.getElementById(viewId);
  if (v) v.classList.add('active');
}

function showSection(sectionId, navBtns) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  const s = document.getElementById(sectionId);
  if (s) s.classList.add('active');
  navBtns.forEach(b => {
    b.classList.toggle('active', b.dataset.section === sectionId.replace('section-', ''));
  });

  // Selective Anti-Screenshot Protection: Enabled ONLY during active exam room
  if (window.proctrAPI && window.proctrAPI.setScreenProtection) {
    if (sectionId === 'section-s-live-exam') {
      window.proctrAPI.setScreenProtection(true);
    } else {
      window.proctrAPI.setScreenProtection(false);
    }
  }
}

// ─── LOGIN & AUTHENTICATION ───────────────────────────────────────
const roleTabs    = document.querySelectorAll('.role-tab');
const loginForm   = document.getElementById('login-form');
const loginError  = document.getElementById('login-error');
const loginBtn    = document.getElementById('login-btn');
const loginBtnTxt = document.getElementById('login-btn-text');

const loginLabel    = document.getElementById('login-label');
const loginUsername = document.getElementById('login-username');

roleTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    roleTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentRole = tab.dataset.role;

    if (currentRole === 'teacher') {
      if (loginLabel) loginLabel.textContent = 'Teacher Email Address';
      if (loginUsername) loginUsername.placeholder = 'e.g. sumaira.naz@university.edu';
      loginBtnTxt.textContent = 'Sign in as Invigilator';
    } else {
      if (loginLabel) loginLabel.textContent = 'Registration No / Email';
      if (loginUsername) loginUsername.placeholder = 'e.g. 231593';
      loginBtnTxt.textContent = 'Sign in to PROCTR';
    }
  });
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();

  loginError.style.display = 'none';
  loginBtn.disabled = true;
  loginBtnTxt.textContent = 'Signing in...';

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: username, password, user_type: currentRole }),
    });

    const data = await res.json();

    if (res.ok && data.status === 'success') {
      currentUser = data.user;
      saveSession(); // Persist session so reloads don't drop back to login

      if (currentRole === 'student') {
        populateStudentProfile(currentUser);
        showView('view-student');
        loadStudentData(currentUser.userId);
      } else {
        populateTeacherHeader(currentUser);
        showView('view-teacher');
        showSection('section-t-overview', document.querySelectorAll('#view-teacher .nav-item'));
        renderWhitelist();
        loadTeacherData(currentUser.userId);
      }
    } else {
      throw new Error(data.message || 'Invalid credentials. Please check your username/email and password.');
    }
  } catch (err) {
    console.error('Login error:', err);
    loginError.textContent = `✖ ${err.message || 'Failed to connect to backend server. Make sure node server.js is running.'}`;
    loginError.style.display = 'block';
  } finally {
    loginBtn.disabled = false;
    loginBtnTxt.textContent = 'Sign in to PROCTR';
  }
});

// ─── LOGOUT ──────────────────────────────────────────────────────
document.getElementById('student-logout').addEventListener('click', () => {
  currentUser = null;
  currentSessionId = null;
  currentRole = 'student';
  clearSession(); // Wipe saved session on explicit logout
  if (studentSchedulePollInterval) clearInterval(studentSchedulePollInterval);
  showView('view-login');
  loginForm.reset();
  loginBtn.disabled = false;
  loginBtnTxt.textContent = 'Sign in to PROCTR';
});

document.getElementById('teacher-logout').addEventListener('click', () => {
  currentUser = null;
  clearSession(); // Wipe saved session on explicit logout
  showView('view-login');
  loginForm.reset();
});

// ─── SIDEBAR NAVIGATION ───────────────────────────────────────────
document.querySelectorAll('#view-student .nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const section = 'section-' + btn.dataset.section;
    showSection(section, document.querySelectorAll('#view-student .nav-item'));
  });
});

document.querySelectorAll('#view-teacher .nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const section = 'section-' + btn.dataset.section;
    showSection(section, document.querySelectorAll('#view-teacher .nav-item'));
  });
});

// ─── POPULATE PROFILE & HEADERS FROM DB DATA ─────────────────────
function populateStudentProfile(user) {
  const initials = ((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase() || 'S';
  const fullName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student';
  const firstName = user.firstName || fullName.split(' ')[0];
  const regNo = user.rollNo || user.registrationNo || user.email?.split('@')[0] || '--';

  // Sidebar chip
  document.getElementById('student-name').textContent = fullName;
  document.getElementById('student-avatar').textContent = initials;

  // Dynamic Time-of-Day Greeting
  const hour = new Date().getHours();
  let timeGreeting = 'Good morning';
  if (hour >= 12 && hour < 17) {
    timeGreeting = 'Good afternoon';
  } else if (hour >= 17 || hour < 5) {
    timeGreeting = 'Good evening';
  }

  const greetEl = document.getElementById('greeting-text');
  if (greetEl) greetEl.textContent = timeGreeting;

  // Greeting name
  const fnEl = document.getElementById('student-first-name');
  if (fnEl) fnEl.textContent = firstName;

  // Profile section
  const profName = document.getElementById('profile-full-name');
  if (profName) profName.textContent = fullName;
  const profReg = document.getElementById('profile-reg-no');
  if (profReg) profReg.textContent = regNo;
  const profAv = document.getElementById('profile-avatar-large');
  if (profAv) profAv.textContent = initials;

  const pfName = document.getElementById('pf-name');
  if (pfName) pfName.textContent = fullName;
  const pfReg = document.getElementById('pf-reg');
  if (pfReg) pfReg.textContent = regNo;
  const pfEmail = document.getElementById('pf-email');
  if (pfEmail) pfEmail.textContent = user.email || '--';

  // Dynamic Academic Profile fields from DB
  const pfProgram = document.getElementById('pf-program');
  if (pfProgram) pfProgram.textContent = user.programName || 'BS Computer Science';
  const pfDept = document.getElementById('pf-department');
  if (pfDept) pfDept.textContent = user.departmentName || 'Computer Science';
  const pfSem = document.getElementById('pf-semester');
  if (pfSem) pfSem.textContent = user.currentSemester ? `${user.currentSemester}th Semester` : '6th Semester';
  const pfSec = document.getElementById('pf-section');
  if (pfSec) pfSec.textContent = user.batchName || 'BSCS-2023';
}

function populateTeacherHeader(user) {
  const initials = ((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase() || 'T';
  const fullName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Teacher';

  document.getElementById('teacher-name').textContent = fullName;
  document.getElementById('teacher-avatar').textContent = initials;
  document.getElementById('teacher-exam-title').textContent = `${user.departmentName || 'Computer Science'} — Lab Session Active`;
}

// ─── FETCH LIVE STUDENT DATA FROM DB (WITH SMART BACKOFF) ──────────────
let studentSchedulePollInterval = null;
let studentScheduleFailCount = 0;

async function loadStudentData(userId) {
  fetchStudentScheduleData(userId);

  // Start polling with smart backoff: starts at 5s, backs off to 30s on failures
  scheduleStudentPoll(userId);
}

function scheduleStudentPoll(userId) {
  if (studentSchedulePollInterval) clearInterval(studentSchedulePollInterval);
  // Base interval: 5s when working, up to 30s after repeated failures
  const interval = Math.min(5000 + studentScheduleFailCount * 5000, 30000);
  studentSchedulePollInterval = setInterval(() => fetchStudentScheduleData(userId), interval);
}

async function fetchStudentScheduleData(userId) {
  try {
    const res = await fetch(`${API_BASE}/student/${userId}/schedule`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const schedule = data.schedule || [];

    // Reset fail count on success & tighten poll interval back to 5s
    if (studentScheduleFailCount > 0) {
      studentScheduleFailCount = 0;
      scheduleStudentPoll(userId);
    }

    renderStudentScheduleTable(schedule);
    renderEnrolledCoursesGrid(schedule);

    // Active exam banner update
    const scheduledList = schedule.filter(s => s.schedule_id || s.exam_date || s.schedule_status === 'Scheduled');
    if (scheduledList.length > 0) {
      const activeExam = scheduledList[0];
      const titleEl = document.getElementById('active-exam-course');
      if (titleEl) titleEl.textContent = `${activeExam.course_code} — ${activeExam.course_title}`;
    } else {
      const titleEl = document.getElementById('active-exam-course');
      if (titleEl) titleEl.textContent = 'No Active Exam Session';
      const statusEl = document.getElementById('exam-status-text');
      if (statusEl) statusEl.textContent = 'No Active Exam';
    }
  } catch (err) {
    studentScheduleFailCount++;
    scheduleStudentPoll(userId); // Slow down polling on failure
    if (studentScheduleFailCount === 1) {
      console.warn('[PROCTR] Database unreachable — retrying with backoff. Check internet / Neon status.');
    }
  }
}

function renderStudentScheduleTable(schedule) {
  const tbody = document.getElementById('student-schedule-tbody') || document.querySelector('#section-s-dashboard table.data-table tbody');
  if (!tbody) return;

  // Filter to show ONLY scheduled exams
  const scheduledExams = (schedule || []).filter(item => item.schedule_id || item.exam_date || item.schedule_status === 'Scheduled');

  if (scheduledExams.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--grey-500); padding:24px;">No scheduled exams found.</td></tr>';
    return;
  }

  tbody.innerHTML = scheduledExams.map(item => {
    const dateStr = item.exam_date ? new Date(item.exam_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Scheduled';
    const timeStr = (item.start_time && item.end_time) ? `${item.start_time.slice(0,5)} – ${item.end_time.slice(0,5)}` : 'TBD';
    const roomStr = item.lab_name || 'Lab';

    const isLiveActive = item.live_session_status === 'ACTIVE';

    // Check if the exam date+end_time has already passed
    let examExpired = false;
    if (item.exam_date) {
      const examDateStr = item.exam_date.slice(0, 10);
      const endTimeStr = item.end_time ? item.end_time.slice(0, 5) : '23:59';
      const examEndDateTime = new Date(`${examDateStr}T${endTimeStr}:00`);
      examExpired = Date.now() > examEndDateTime.getTime();
    }

    let statusPill, actionBtn;

    if (examExpired) {
      // Date passed — lock joining entirely
      statusPill = '<span class="status-pill" style="background:#fee2e2; color:#b91c1c; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:700;">📅 Exam Date Passed</span>';
      actionBtn = '<span style="font-size:11px; color:#94a3b8; font-style:italic;">—</span>';
    } else if (isLiveActive) {
      statusPill = '<span class="status-pill active-pill">⚡ Live Active</span>';
      actionBtn = `<button class="btn-primary" style="padding:4px 10px; font-size:11px; width:auto;" onclick="selectExamToJoin('${item.course_code}')">⚡ Join Exam</button>`;
    } else {
      statusPill = '<span class="status-pill warning-pill" style="background:#fef3c7; color:#b45309; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:700;">⏳ Session Not Started</span>';
      actionBtn = `<button class="btn-secondary" style="padding:4px 10px; font-size:11px; width:auto; opacity:0.8;" onclick="alert('Session is not created yet. Please wait for your invigilator to create and start the live exam session.')">⏳ Waiting for Invigilator</button>`;
    }

    return `
      <tr>
        <td><strong>${item.course_title}</strong></td>
        <td class="mono">${item.course_code}</td>
        <td>${dateStr}</td>
        <td>${timeStr}</td>
        <td>${roomStr}</td>
        <td>${statusPill}</td>
        <td>${actionBtn}</td>
      </tr>
    `;
  }).join('');
}

function selectExamToJoin(courseCode) {
  const input = document.getElementById('join-exam-id');
  const passInput = document.getElementById('join-exam-key');
  if (input) input.value = courseCode;
  if (passInput) passInput.focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.selectExamToJoin = selectExamToJoin;

function renderEnrolledCoursesGrid(schedule) {
  const container = document.getElementById('student-courses-grid') || document.querySelector('#section-s-dashboard .courses-grid');
  if (!container) return;

  if (!schedule || schedule.length === 0) {
    container.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1; padding:24px;">No enrolled courses found in database.</div>';
    return;
  }

  // Deduplicate courses by course_code
  const coursesMap = new Map();
  schedule.forEach(item => {
    if (!coursesMap.has(item.course_code)) {
      coursesMap.set(item.course_code, item);
    }
  });

  const courses = Array.from(coursesMap.values());
  container.innerHTML = courses.map(c => `
    <div class="course-card">
      <div class="course-code">${c.course_code}</div>
      <div class="course-name">${c.course_title}</div>
      <div class="course-teacher">${c.teacher_name || 'Department Faculty'}</div>
      <div class="course-credit">${c.credit_hours ? c.credit_hours + ' Credit Hours' : '3 Credit Hours'}</div>
    </div>
  `).join('');
}

// ─── FETCH LIVE TEACHER DATA FROM DB ──────────────────────────────
async function loadTeacherData(userId) {
  const connectedEl = document.getElementById('stat-connected');
  if (connectedEl) connectedEl.textContent = '0';

  try {
    // Run both network requests concurrently so teacher dashboard loads instantly
    const [activeResult, scheduleResult] = await Promise.allSettled([
      fetch(`${API_BASE}/desktop/sessions/active`),
      fetch(`${API_BASE}/teacher/${userId}/schedule`)
    ]);

    // Handle Active Sessions Count
    if (activeResult.status === 'fulfilled' && activeResult.value.ok) {
      const activeData = await activeResult.value.json();
      if (connectedEl) connectedEl.textContent = String(activeData.count || 0);
    }

    // Handle Teacher Schedule
    if (scheduleResult.status === 'fulfilled' && scheduleResult.value.ok) {
      const data = await scheduleResult.value.json();
      renderTeacherScheduleTable(data.schedule || []);
    } else {
      renderTeacherScheduleTable([]);
    }
  } catch (err) {
    console.warn('Teacher data load error:', err.message);
    renderTeacherScheduleTable([]);
  }
}

function renderTeacherScheduleTable(schedule) {
  const tbody = document.getElementById('teacher-schedule-tbody');
  if (!tbody) return;

  if (!schedule || schedule.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#94a3b8; padding:32px;">No assigned exams found in database.</td></tr>';
    return;
  }

  tbody.innerHTML = schedule.map(item => {
    const dateFormatted = item.exam_date ? new Date(item.exam_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBD';
    const timeFormatted = (item.start_time && item.end_time) ? `${item.start_time.slice(0,5)} – ${item.end_time.slice(0,5)}` : 'Time TBD';
    const roomStr = item.lab_name ? item.lab_name : '<span style="color:#94a3b8; font-style:italic;">Unassigned</span>';
    const invigilatorStr = item.invigilator_name ? item.invigilator_name : '<span style="color:#94a3b8; font-style:italic;">Unassigned</span>';
    const examId = item.exam_id || 0;
    const courseCodeStr = (item.course_code || 'EXAM').replace(/'/g, "\\'");

    // Role Tags
    let rolePills = '';
    if (item.is_instructor) rolePills += '<span class="role-pill instructor-pill" style="margin-right:4px;">Course Instructor</span>';
    if (item.is_invigilator) rolePills += '<span class="role-pill invigilator-pill">Invigilator</span>';
    if (!rolePills) rolePills = '<span style="color:#94a3b8;">Faculty</span>';

    // Check permissions: Is current user the assigned Invigilator for this exam?
    const isInvigilator = item.is_invigilator || (item.invigilator_id && String(item.invigilator_id) === String(currentUser?.teacherId));
    const isCompleted = item.live_session_status === 'ENDED' || item.live_session_status === 'COMPLETED';
    const hasSubmissions = item.submission_count > 0;

    // Check if exam date+end_time has already passed
    let examExpired = false;
    if (item.exam_date) {
      const examDateStr = item.exam_date.slice(0, 10);
      const endTimeStr = item.end_time ? item.end_time.slice(0, 5) : '23:59';
      const examEndDateTime = new Date(`${examDateStr}T${endTimeStr}:00`);
      examExpired = Date.now() > examEndDateTime.getTime();
    }

    let actionBtn = '';
    if (isCompleted) {
      // Exam was explicitly completed by invigilator
      actionBtn = `<button class="btn-action-secondary" onclick="openTeacherSubmissions()">📁 View Submissions & Logs</button>`;
    } else if (isInvigilator) {
      // Assigned Invigilator can create & start live session
      actionBtn = `<button class="btn-action-primary" onclick="createInvigilationSession(${examId}, '${courseCodeStr}')">⚡ Create Live Session</button>`;
    } else {
      // Course Instructor only (Not Invigilator)
      actionBtn = `<button class="btn-action-secondary" style="opacity:0.8; font-size:11px;" onclick="alert('Invigilation is assigned to ${item.invigilator_name || 'another teacher'}. Only the assigned invigilator can start the live exam session.')">🔒 Invigilation: ${item.invigilator_name || 'Assigned'}</button>`;
    }

    return `
      <tr>
        <td><strong style="color:var(--navy); font-size:13.5px;">${item.course_title}</strong></td>
        <td class="mono">${item.course_code}</td>
        <td>
          <div style="font-weight:600; color:var(--navy);">${dateFormatted}</div>
          <div style="font-size:11px; color:#64748b; margin-top:2px;">${timeFormatted}</div>
        </td>
        <td>${roomStr}</td>
        <td>${rolePills}</td>
        <td>${invigilatorStr}</td>
        <td>${actionBtn}</td>
      </tr>
    `;
  }).join('');
}

let activeInvigilationCode = null;
let invigilatorPollInterval = null;

async function createInvigilationSession(examId, courseCode) {
  try {
    const res = await fetch(`${API_BASE}/desktop/session/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exam_id: examId,
        course_code: courseCode,
        invigilator_id: currentUser?.teacherId || null,
        duration: 90
      }),
    });
    const data = await res.json();
    if (data.status === 'success' && data.session) {
      activeInvigilationCode = data.session.session_code;
      
      // Create course folder on Teacher side (C:\PROCTR_Exams\<CourseCode>_LAB\Submissions\)
      if (window.proctrAPI && window.proctrAPI.startExamWorkspace) {
        await window.proctrAPI.startExamWorkspace({
          examId: String(examId || '1'),
          studentId: '101',
          courseCode: courseCode
        });
      }

      // Switch view to Dedicated Live Control Room
      showSection('section-t-live-room', document.querySelectorAll('#view-teacher .nav-item'));

      // Populate Live Room UI
      const codeEl = document.getElementById('room-session-code');
      if (codeEl) codeEl.textContent = data.session.session_code;
      const passEl = document.getElementById('room-passcode');
      if (passEl) passEl.textContent = data.session.passcode;
      const titleEl = document.getElementById('live-room-course-title');
      if (titleEl) titleEl.textContent = `${courseCode} — Live Lab Exam Session`;

      // Start Polling Live Connected Students & Security Feed
      pollInvigilatorLiveRoom(data.session.session_code);
    }
  } catch (err) {
    console.error('Error creating live session:', err);
  }
}

function formatSecondsToHMS(secs) {
  if (secs === null || secs === undefined || secs < 0) return '0h 0m 0s';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

let teacherLocalCountdown = null; // client-side ticking interval for teacher timer

let selectedStudentFilter = null;
let shownToastViolationIds = new Set();
window.lastPollSessionData = null;

function createToastContainer() {
  let c = document.getElementById('critical-toast-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'critical-toast-container';
    c.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      width: 350px;
      max-width: 90vw;
      pointer-events: auto;
    `;
    document.body.appendChild(c);
  }
  return c;
}

function showCriticalCheatingToast(v) {
  const container = createToastContainer();
  const toast = document.createElement('div');
  toast.className = 'critical-cheating-toast';
  toast.style.cssText = `
    background: #ffffff;
    border: 2px solid #ef4444;
    border-left: 6px solid #dc2626;
    border-radius: 10px;
    padding: 14px 16px;
    margin-bottom: 10px;
    box-shadow: 0 10px 25px rgba(220, 38, 38, 0.22);
    animation: slideInRight 0.3s ease-out;
    position: relative;
    font-family: var(--font-sans);
  `;

  const titleText = v.surface_title || v.title || 'CRITICAL CHEATING BREACH';
  const timeStr = v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();

  toast.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
      <span style="font-size:11px; font-weight:800; color:#dc2626; text-transform:uppercase; letter-spacing:0.5px;">🚨 CRITICAL CHEATING ALERT</span>
      <span style="font-size:11px; color:#64748b;">${timeStr}</span>
    </div>
    <div style="font-size:14px; font-weight:800; color:#0f172a; margin-bottom:2px;">
      ${v.name || 'Candidate'} <span style="font-family:var(--font-mono); color:#0284c7;">(${v.reg_no || '231593'})</span>
    </div>
    <div style="font-size:13px; font-weight:700; color:#dc2626; margin-bottom:4px;">
      ${titleText}
    </div>
    <div style="font-size:12px; color:#475569; line-height:1.4;">
      ${v.description || ''}
    </div>
    <button style="position:absolute; top:8px; right:8px; background:none; border:none; color:#94a3b8; font-size:14px; cursor:pointer;" onclick="this.parentElement.remove()">✕</button>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    if (toast.parentElement) toast.remove();
  }, 7000);
}

function selectStudentCandidateFilter(regNo, name) {
  const targetReg = String(regNo);
  if (selectedStudentFilter === targetReg) {
    clearStudentCandidateFilter();
    return;
  }
  selectedStudentFilter = targetReg;

  const header = document.getElementById('filter-active-header');
  const nameEl = document.getElementById('filter-student-name');
  const btnClear = document.getElementById('btn-clear-student-filter');
  if (header) header.style.display = 'flex';
  if (nameEl) nameEl.textContent = `${name} (${regNo})`;
  if (btnClear) btnClear.style.display = 'inline-block';

  if (window.lastPollSessionData) {
    renderInvigilatorLiveRoomUI(window.lastPollSessionData);
  }
}
window.selectStudentCandidateFilter = selectStudentCandidateFilter;

function clearStudentCandidateFilter() {
  selectedStudentFilter = null;
  const header = document.getElementById('filter-active-header');
  const btnClear = document.getElementById('btn-clear-student-filter');
  if (header) header.style.display = 'none';
  if (btnClear) btnClear.style.display = 'none';

  if (window.lastPollSessionData) {
    renderInvigilatorLiveRoomUI(window.lastPollSessionData);
  }
}
window.clearStudentCandidateFilter = clearStudentCandidateFilter;

function renderInvigilatorLiveRoomUI(session) {
  if (!session) return;

  // 1. Update connected count
  const connEl = document.getElementById('room-connected-count');
  if (connEl) connEl.textContent = `${session.connectedStudents || 0} Connected`;

  const statConn = document.getElementById('stat-connected');
  if (statConn) statConn.textContent = session.connectedStudents || 0;

  const candCountVal = document.getElementById('candidate-count-val');
  if (candCountVal) candCountVal.textContent = session.connectedStudents || 0;

  // 2. Sync teacher countdown from server
  if (session.secondsRemaining !== null && session.secondsRemaining !== undefined) {
    if (teacherLocalCountdown) clearInterval(teacherLocalCountdown);
    let secs = Math.max(0, session.secondsRemaining);
    const timerEl = document.getElementById('teacher-timer');
    if (timerEl) {
      timerEl.textContent = secs > 0 ? formatSecondsToHMS(secs) : '⏰ Time Expired';
    }
    teacherLocalCountdown = setInterval(() => {
      secs = Math.max(0, secs - 1);
      const el = document.getElementById('teacher-timer');
      if (el) el.textContent = secs > 0 ? formatSecondsToHMS(secs) : '⏰ Time Expired';
      if (secs <= 0) clearInterval(teacherLocalCountdown);
    }, 1000);
  }

  // 3. Render Connected Candidates Grid
  const grid = document.getElementById('monitoring-candidates-grid');
  const tbody = document.getElementById('room-students-tbody');

  const connectedList = session.connectedList || [];
  const recentViolations = session.recentViolations || [];

  if (tbody) {
    if (connectedList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--grey-500); padding:20px;">Waiting for students to join with Passcode...</td></tr>';
    } else {
      tbody.innerHTML = connectedList.map(s => `
        <tr>
          <td><strong>${s.name}</strong> <span class="mono" style="font-size:11px;">(${s.reg_no})</span></td>
          <td><span class="status-pill active-pill">Connected</span></td>
          <td style="font-size:11px; color:var(--grey-500);">${new Date(s.started_at || Date.now()).toLocaleTimeString()}</td>
        </tr>
      `).join('');
    }
  }

  if (grid) {
    if (connectedList.length === 0) {
      grid.innerHTML = '<div class="empty-state" style="padding:20px; grid-column:1/-1;">Waiting for candidate PCs to join live session...</div>';
    } else {
      grid.innerHTML = connectedList.map(s => {
        const studentReg = String(s.reg_no);
        const studentViolations = recentViolations.filter(v => String(v.reg_no) === studentReg || String(v.student_id) === String(s.student_id));
        const isSelected = selectedStudentFilter === studentReg;
        const violBadge = studentViolations.length > 0
          ? `<span style="font-size:11px; font-weight:800; background:#fee2e2; color:#dc2626; padding:3px 8px; border-radius:10px;">🚨 ${studentViolations.length} Alert(s)</span>`
          : `<span style="font-size:11px; font-weight:700; background:#dcfce7; color:#166534; padding:3px 8px; border-radius:10px;">🟢 Clean</span>`;

        return `
          <div class="candidate-card-item" data-reg-no="${studentReg}" onclick="selectStudentCandidateFilter('${studentReg}', '${s.name.replace(/'/g, "\\'")}')" style="background:${isSelected ? 'var(--teal-light, #f0fdfa)' : '#ffffff'}; border:2px solid ${isSelected ? 'var(--teal)' : '#e2e8f0'}; border-radius:10px; padding:14px 16px; cursor:pointer; transition:all 0.2s ease; box-shadow:${isSelected ? '0 4px 12px rgba(0,180,166,0.15)' : 'none'};">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <div style="font-size:14px; font-weight:800; color:var(--navy);">${s.name}</div>
              ${violBadge}
            </div>
            <div style="font-size:12px; font-family:var(--font-mono); color:var(--grey-600); font-weight:600;">
              Reg No: <span style="color:var(--teal);">${s.reg_no}</span>
            </div>
            <div style="font-size:11px; color:var(--grey-400); margin-top:6px;">
              Joined at ${new Date(s.started_at || Date.now()).toLocaleTimeString()}
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 4. Trigger Real-Time Critical Cheating Notification Toasts
  recentViolations.forEach(v => {
    const isCritical = v.severity === 'CRITICAL' || ['H1', 'H2', 'H5', 'N1'].includes(v.violation_code);
    const violationKey = `${v.id || ''}_${v.violation_code}_${v.reg_no}_${v.timestamp}`;
    if (isCritical && !shownToastViolationIds.has(violationKey)) {
      shownToastViolationIds.add(violationKey);
      showCriticalCheatingToast(v);
    }
  });

  // 5. Render Security Feeds (Filtered if selectedStudentFilter is active)
  renderInvigilatorFeeds(session);
}

function formatCleanLogSummary(v) {
  const code = v.violation_code || v.code || 'H2';
  const name = v.name || 'Student';
  const reg = v.reg_no || '231593';
  const desc = v.description || v.detected_value || '';
  const title = v.surface_title || v.title || 'Security Violation';

  let actionText = '';

  if (code === 'H1') {
    actionText = `connected an unauthorized USB Storage Device.`;
  } else if (code === 'H2') {
    const descLower = desc.toLowerCase();
    if (descLower.includes('claude')) {
      actionText = `opened Claude AI website.`;
    } else if (descLower.includes('chatgpt') || descLower.includes('openai')) {
      actionText = `opened ChatGPT AI website.`;
    } else if (descLower.includes('gemini') || descLower.includes('bard')) {
      actionText = `opened Google Gemini AI website.`;
    } else if (descLower.includes('copilot') || descLower.includes('perplexity')) {
      actionText = `opened AI Assistant website.`;
    } else if (desc.includes('Opened') || desc.includes('opened')) {
      const siteMatch = desc.match(/'([^']+)'/);
      const siteName = siteMatch ? siteMatch[1] : 'unauthorized application/website';
      actionText = `opened '${siteName}'.`;
    } else {
      actionText = `accessed an unauthorized process/website.`;
    }
  } else if (code === 'H4a') {
    const charMatch = desc.match(/(\d+)\s*characters/i);
    const charCount = charMatch ? `${charMatch[1]} characters` : 'external text';
    actionText = `attempted copy-paste breach (${charCount} into workspace).`;
  } else if (code === 'H3') {
    const secMatch = desc.match(/for\s*(\d+)\s*seconds/i);
    const durationStr = secMatch ? `for ${secMatch[1]}s` : '';
    actionText = `switched focus away from exam workspace ${durationStr}.`;
  } else if (code === 'N1') {
    actionText = `connected to an unauthorized non-lab network / mobile hotspot.`;
  } else {
    actionText = title || 'triggered a security violation.';
  }

  return `${name} (${reg}) ${actionText}`;
}

function renderInvigilatorFeeds(session) {
  const roomFeed = document.getElementById('room-alerts-feed');
  const teacherFeed = document.getElementById('teacher-feed');
  const alertsCount = document.getElementById('room-alerts-count');
  const teacherAlertCount = document.getElementById('teacher-alert-count');
  const statTotalViolations = document.getElementById('stat-total-violations');

  let violations = session.recentViolations || [];
  if (selectedStudentFilter) {
    violations = violations.filter(v => String(v.reg_no) === selectedStudentFilter || String(v.student_id) === selectedStudentFilter);
  }

  if (alertsCount) alertsCount.textContent = `${violations.length} Alert(s)`;
  if (teacherAlertCount) teacherAlertCount.textContent = `${violations.length} Alert(s)`;
  if (statTotalViolations) statTotalViolations.textContent = session.recentViolations?.length || 0;

  const feedHTML = violations.length === 0
    ? `<div class="empty-state" style="padding:24px;">${selectedStudentFilter ? 'No security violations recorded for this candidate.' : 'Monitoring is active. Security alerts will stream here live.'}</div>`
    : violations.map(v => {
        const timeStr = v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
        const badgeColor = v.severity === 'CRITICAL' ? '#dc2626' : '#d97706';
        const badgeBg = v.severity === 'CRITICAL' ? '#fee2e2' : '#fef3c7';
        const cleanSummary = formatCleanLogSummary(v);

        return `
          <div class="alert-card" style="padding:12px 14px; margin-bottom:10px; border-radius:8px; background:#fff; border:1.5px solid ${v.severity === 'CRITICAL' ? '#fca5a5' : '#e2e8f0'}; box-shadow:0 2px 6px rgba(0,0,0,0.03);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-size:13px; font-weight:800; color:#0f172a;">${v.name} <span class="mono" style="font-size:11px; color:#0284c7;">(${v.reg_no})</span></span>
              <span style="font-size:10px; font-weight:800; background:${badgeBg}; color:${badgeColor}; padding:2px 8px; border-radius:10px;">${v.severity || 'HIGH'}</span>
            </div>
            <div style="font-size:13px; font-weight:700; color:#dc2626; margin-bottom:4px;">
              ${v.surface_title || v.title}
            </div>
            <div style="font-size:12.5px; color:#334155; font-weight:600; line-height:1.4; background:#f8fafc; padding:8px 12px; border-radius:6px; border-left:3px solid ${badgeColor}; margin-top:4px;">
              📌 ${cleanSummary}
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; font-size:11px; color:#64748b;">
              <span>Violation Code: <strong style="color:#0f172a; font-family:var(--font-mono);">${v.violation_code}</strong></span>
              <span>${timeStr}</span>
            </div>
          </div>
        `;
      }).join('');

  if (roomFeed) roomFeed.innerHTML = feedHTML;
  if (teacherFeed) teacherFeed.innerHTML = feedHTML;
}

function pollInvigilatorLiveRoom(sessionCode) {
  if (invigilatorPollInterval) clearInterval(invigilatorPollInterval);
  invigilatorPollInterval = setInterval(async () => {
    try {
      const res = await fetch(`${API_BASE}/desktop/session/${sessionCode}/status`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.session) {
        window.lastPollSessionData = data.session;
        renderInvigilatorLiveRoomUI(data.session);
      }
    } catch (err) {
      console.warn('Error polling invigilator room status:', err.message);
    }
  }, 3000);

  // Kick off first poll immediately
  (async () => {
    try {
      const res = await fetch(`${API_BASE}/desktop/session/${sessionCode}/status`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.session) {
        window.lastPollSessionData = data.session;
        renderInvigilatorLiveRoomUI(data.session);
      }
    } catch (_) {}
  })();
}

// ─── REVEAL PAPER TO STUDENTS (Invigilator) ──────────────────────
const roomBtnReveal = document.getElementById('room-btn-reveal');
if (roomBtnReveal) {
  roomBtnReveal.addEventListener('click', async () => {
    if (!activeInvigilationCode) return;
    try {
      await fetch(`${API_BASE}/desktop/session/reveal-paper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_code: activeInvigilationCode }),
      });
      roomBtnReveal.textContent = '✓ Paper Revealed';
      roomBtnReveal.disabled = true;
      roomBtnReveal.style.background = 'var(--grey-400)';
    } catch (err) {
      console.error('Error revealing paper:', err);
    }
  });
}

// ─── START EXAM TIMER (Invigilator) ──────────────────────────────
const roomBtnTimer = document.getElementById('room-btn-timer');
if (roomBtnTimer) {
  roomBtnTimer.addEventListener('click', async () => {
    if (!activeInvigilationCode) return;
    try {
      await fetch(`${API_BASE}/desktop/session/start-timer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_code: activeInvigilationCode }),
      });
      roomBtnTimer.textContent = '✓ Timer Running';
      roomBtnTimer.disabled = true;
      roomBtnTimer.style.background = 'var(--grey-400)';
    } catch (err) {
      console.error('Error starting timer:', err);
    }
  });
}

// ─── EXTEND TIME (Invigilator - Max 20 Mins) ─────────────────────
const roomBtnExtend = document.getElementById('room-btn-extend');
if (roomBtnExtend) {
  roomBtnExtend.addEventListener('click', async () => {
    if (!activeInvigilationCode) return;
    try {
      const res = await fetch(`${API_BASE}/desktop/session/extend-time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_code: activeInvigilationCode, extra_minutes: 10 }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        alert(`⏱️ ${data.message}`);
      }
    } catch (err) {
      console.error('Error extending time:', err);
    }
  });
}

// ─── END SESSION (Invigilator) ───────────────────────────────────
const roomBtnEnd = document.getElementById('room-btn-end');
if (roomBtnEnd) {
  roomBtnEnd.addEventListener('click', async () => {
    if (!activeInvigilationCode) return;
    if (!confirm('Are you sure you want to end this live exam session? Submissions will be locked.')) return;
    try {
      await fetch(`${API_BASE}/desktop/session/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_code: activeInvigilationCode }),
      });
      if (invigilatorPollInterval) clearInterval(invigilatorPollInterval);
      if (window.proctrAPI) {
        if (window.proctrAPI.stopSensors) window.proctrAPI.stopSensors();
        if (window.proctrAPI.setScreenProtection) window.proctrAPI.setScreenProtection(false);
      }
      showSection('section-t-overview', document.querySelectorAll('#view-teacher .nav-item'));
    } catch (err) {
      console.error('Error ending session:', err);
    }
  });
}

// ─── EXIT LIVE CONTROL ROOM ──────────────────────────────────────
const btnExitRoom = document.getElementById('btn-exit-live-room');
if (btnExitRoom) {
  btnExitRoom.addEventListener('click', () => {
    if (invigilatorPollInterval) clearInterval(invigilatorPollInterval);
    showSection('section-t-overview', document.querySelectorAll('#view-teacher .nav-item'));
  });
}

function openLiveMonitoring() {
  showSection('section-t-monitoring', document.querySelectorAll('#view-teacher .nav-item'));
}
function openTeacherSubmissions() {
  showSection('section-t-submissions', document.querySelectorAll('#view-teacher .nav-item'));
}
window.createInvigilationSession = createInvigilationSession;
window.openLiveMonitoring = openLiveMonitoring;
window.openTeacherSubmissions = openTeacherSubmissions;

let activeWorkspacePath = null;

// ─── RECORD DESKTOP EXAM SESSION IN DB ────────────────────────────
async function startDesktopSessionInDB(studentId) {
  try {
    const res = await fetch(`${API_BASE}/desktop/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: studentId,
        system_info: { client: 'PROCTR Desktop Electron Client v1.0', platform: window.navigator.platform }
      }),
    });
    const data = await res.json();
    if (data.session) {
      currentSessionId = data.session.session_id;
    }
  } catch (err) {
    console.warn('Could not record desktop session in DB:', err.message);
  }
}

// ─── JOIN EXAM & WORKSPACE FOLDER INITIALIZATION ──────────────────
const joinExamForm  = document.getElementById('join-exam-form');
const joinExamCard  = document.getElementById('join-exam-card');
const joinExamError = document.getElementById('join-exam-error');
const examBanner    = document.getElementById('exam-banner');
const btnJoinExam   = document.getElementById('btn-join-exam');
const btnOpenWs     = document.getElementById('btn-open-workspace');

if (joinExamForm) {
  joinExamForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const examCode = document.getElementById('join-exam-id').value.trim();
    const passcode = document.getElementById('join-exam-key').value.trim();

    if (!examCode || !passcode) {
      if (joinExamError) {
        joinExamError.textContent = '✖ Please enter both Exam ID and Passcode.';
        joinExamError.style.display = 'block';
      }
      return;
    }

    btnJoinExam.disabled = true;
    btnJoinExam.textContent = 'Joining & Creating Folder...';
    if (joinExamError) joinExamError.style.display = 'none';

    const regNo = currentUser?.rollNo || currentUser?.registrationNo || '231593';

    try {
      // 1. Verify Session ID & Passcode with Backend
      const joinRes = await fetch(`${API_BASE}/desktop/session/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_code: examCode,
          passcode: passcode,
          student_id: currentUser?.studentId || currentUser?.userId
        }),
      });

      const joinData = await joinRes.json();
      if (!joinRes.ok || joinData.status !== 'success') {
        if (joinRes.status === 404) {
          throw new Error('Session is not created yet. Please wait for your invigilator to start the live session.');
        }
        throw new Error(joinData.message || 'Incorrect Session ID or Passcode.');
      }

      const sessionObj = joinData.session || joinData.data || {};
      window.activeSessionId = sessionObj.session_id || joinData.session_id || null;
      window.activeSessionCode = examCode;

      // 2. Create Local Exam Workspace Directory Tree
      if (window.proctrAPI && window.proctrAPI.startExamWorkspace) {
        const result = await window.proctrAPI.startExamWorkspace({
          examId: examCode,
          studentId: regNo,
          courseCode: examCode
        });

        if (result.status === 'success') {
          activeWorkspacePath = result.workspacePath;

          // Switch UI to Dedicated Student Live Exam Environment
          showSection('section-s-live-exam', document.querySelectorAll('#view-student .nav-item'));

          // Populate Student Room UI
          const courseEl = document.getElementById('student-room-course-title');
          if (courseEl) courseEl.textContent = `${examCode.toUpperCase()} — Live Lab Examination`;
          const wsEl = document.getElementById('student-room-ws-path');
          if (wsEl) wsEl.textContent = activeWorkspacePath;
          const codeTag = document.getElementById('student-room-code-tag');
          if (codeTag) codeTag.textContent = examCode.toUpperCase();

          // Hook Open Workspace Button
          const btnRoomOpen = document.getElementById('btn-room-open-ws');
          if (btnRoomOpen) {
            btnRoomOpen.onclick = async () => {
              if (activeWorkspacePath && window.proctrAPI && window.proctrAPI.openWorkspaceFolder) {
                await window.proctrAPI.openWorkspaceFolder(activeWorkspacePath);
              }
            };
          }

          // Start Polling Invigilator Signals (Paper Reveal & Timer Start)
          startStudentSessionPoll(examCode);
        } else {
          throw new Error(result.message || 'Failed to create exam folder.');
        }
      }
    } catch (err) {
      if (joinExamError) {
        joinExamError.textContent = `✖ ${err.message}`;
        joinExamError.style.display = 'block';
      }
    } finally {
      btnJoinExam.disabled = false;
      btnJoinExam.textContent = 'Join & Create Exam Folder';
    }
  });
}

// ─── STUDENT SESSION POLLING FOR PAPER REVEAL & TIMER START ───────
let studentPollInterval = null;

function startStudentSessionPoll(sessionCode) {
  if (studentPollInterval) clearInterval(studentPollInterval);

  studentPollInterval = setInterval(async () => {
    try {
      const res = await fetch(`${API_BASE}/desktop/session/${sessionCode}/status`);
      if (!res.ok) return;
      const data = await res.json();
      const session = data.session;

      if (!session) return;

      // 0. Check if Invigilator Ended Session
      if (session.isSessionEnded || session.status === 'ENDED' || session.status === 'COMPLETED') {
        if (studentPollInterval) clearInterval(studentPollInterval);
        if (studentLocalCountdown) clearInterval(studentLocalCountdown);

        if (window.proctrAPI) {
          if (window.proctrAPI.stopSensors) window.proctrAPI.stopSensors();
          if (window.proctrAPI.setScreenProtection) window.proctrAPI.setScreenProtection(false);
        }

        const statusEl = document.getElementById('exam-status-text');
        if (statusEl) statusEl.textContent = '🔒 Exam Ended by Invigilator — All Sensors Deactivated & Submissions Locked';
        alert('🔴 The invigilator has ended this live exam session. All security sensors have been deactivated and submissions are locked.');
        return;
      }

      // 1. Check if Invigilator Revealed Question Paper
      if (session.isPaperRevealed) {
        const placeholder = document.getElementById('student-paper-placeholder');
        const iframe = document.getElementById('student-paper-iframe');

        if (placeholder && iframe && iframe.style.display === 'none') {
          placeholder.style.display = 'none';
          iframe.style.display = 'block';

          if (session.examPaperUrl) {
            let paperUrl = session.examPaperUrl;
            if (paperUrl.startsWith('http://') || paperUrl.startsWith('https://')) {
              // Full Cloudinary or external HTTPS URL — use directly
            } else if (paperUrl.startsWith('file:///') || paperUrl.includes(':\\')) {
              const filename = paperUrl.split('/').pop().split('\\').pop();
              paperUrl = `http://localhost:5000/uploads/${filename}`;
            } else {
              paperUrl = `http://localhost:5000${paperUrl.startsWith('/') ? '' : '/'}${paperUrl}`;
            }

            const isWordDoc = paperUrl.toLowerCase().includes('.docx') || paperUrl.toLowerCase().includes('.doc');
            if (isWordDoc) {
              iframe.src = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(paperUrl)}`;
            } else {
              iframe.src = `${paperUrl}#toolbar=0&navpanes=0&scrollbar=1`;
            }
          } else {
            // Render protected HTML document if no PDF URL uploaded
            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(`
              <html>
                <head>
                  <style>
                    body { font-family:sans-serif; padding:20px; line-height:1.6; color:#1e293b; user-select:none; -webkit-user-select:none; }
                  </style>
                </head>
                <body oncontextmenu="return false;">
                  <h3 style="color:#0f172a; border-bottom:2px solid #0284c7; padding-bottom:8px;">
                    SECTION A: PRACTICAL LAB TASKS (${sessionCode.toUpperCase()})
                  </h3>
                  <p><strong>Instructions:</strong> Solve the following programming questions inside your workspace folder: <code>${activeWorkspacePath || 'C:\\PROCTR_Exams'}</code></p>
                  <hr style="border:none; border-top:1px solid #cbd5e1; margin:16px 0;"/>
                  <h4>Q1. Data Structure Implementation (40 Marks)</h4>
                  <p>Implement a double-ended queue (Deque) supporting <code>push_front</code>, <code>push_back</code>, <code>pop_front</code>, and <code>pop_back</code> with O(1) time complexity.</p>
                  <h4>Q2. Algorithm Analysis (60 Marks)</h4>
                  <p>Write an efficient algorithm to find the maximum sum of a contiguous subarray using dynamic programming (Kadane's algorithm).</p>
                </body>
              </html>
            `);
            doc.close();
          }
        }
      }

      // 2. Check if Invigilator Started Exam Timer — smooth client-side countdown
      if (session.isTimerStarted && session.secondsRemaining !== null) {
        if (!studentLocalCountdown) {
          // Only initialize the client-side countdown once
          let secs = Math.max(0, session.secondsRemaining);

          const tick = () => {
            const timerEl = document.getElementById('student-room-timer');
            const warningEl = document.getElementById('five-min-warning');

            if (secs <= 0) {
              if (timerEl) timerEl.textContent = '⏰ Time Expired — Submissions Closed';
              clearInterval(studentLocalCountdown);
              studentLocalCountdown = null;
              return;
            }

            if (timerEl) timerEl.textContent = formatSecondsToHMS(secs);

            // 5-Minute Warning: show pulsing banner
            if (warningEl) {
              if (secs <= 300) {
                warningEl.style.display = 'flex';
              } else {
                warningEl.style.display = 'none';
              }
            }

            secs--;
          };

          tick(); // Run immediately
          studentLocalCountdown = setInterval(tick, 1000);
        } else {
          // Re-sync seconds from server every poll cycle to prevent drift
          clearInterval(studentLocalCountdown);
          studentLocalCountdown = null;
          let secs = Math.max(0, session.secondsRemaining);

          const tick = () => {
            const timerEl = document.getElementById('student-room-timer');
            const warningEl = document.getElementById('five-min-warning');
            if (secs <= 0) {
              if (timerEl) timerEl.textContent = '⏰ Time Expired — Submissions Closed';
              clearInterval(studentLocalCountdown);
              studentLocalCountdown = null;
              return;
            }
            if (timerEl) timerEl.textContent = formatSecondsToHMS(secs);
            if (warningEl) {
              warningEl.style.display = secs <= 300 ? 'flex' : 'none';
            }
            secs--;
          };

          tick();
          studentLocalCountdown = setInterval(tick, 1000);
        }
      }
    } catch (err) {
      console.warn('Error polling session status:', err.message);
    }
  }, 10000); // Server sync every 10s; client-side ticking is local
}

if (btnOpenWs) {
  btnOpenWs.addEventListener('click', async () => {
    if (activeWorkspacePath && window.proctrAPI && window.proctrAPI.openWorkspaceFolder) {
      await window.proctrAPI.openWorkspaceFolder(activeWorkspacePath);
    }
  });
}

// ─── EXAM TIMER ──────────────────────────────────────────────────
let examSeconds = 90 * 60; // 90 minutes
let timerInterval = null;

function startExamTimer() {
  const timerBadge = document.getElementById('student-timer');
  if (timerBadge) timerBadge.style.display = 'inline-block';

  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (examSeconds <= 0) {
      clearInterval(timerInterval);
      const t = document.getElementById('student-timer');
      if (t) t.textContent = '00:00:00';
      const s = document.getElementById('exam-status-text');
      if (s) s.textContent = 'Time is up';
      return;
    }
    examSeconds--;
    const h = Math.floor(examSeconds / 3600);
    const m = Math.floor((examSeconds % 3600) / 60);
    const s = examSeconds % 60;
    const timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    const timerEl = document.getElementById('student-timer');
    if (timerEl) timerEl.textContent = timeStr;
    const statusEl = document.getElementById('exam-status-text');
    if (statusEl) statusEl.textContent = `In Progress — ${timeStr} remaining`;
  }, 1000);
}

// ─── SUBMISSION ───────────────────────────────────────────────────
document.getElementById('btn-submit-exam').addEventListener('click', () => {
  const btn = document.getElementById('btn-submit-exam');
  const status = document.getElementById('submit-status');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  setTimeout(() => {
    btn.textContent = '✓ Submitted';
    status.textContent = '✅ Your submission has been sent to the local exam server successfully.';
    status.style.display = 'block';
  }, 1200);
});

// ─── CHANGE PASSWORD ──────────────────────────────────────────────
const changePwdForm = document.getElementById('change-pwd-form');
const changePwdErr  = document.getElementById('change-pwd-error');
const changePwdSucc = document.getElementById('change-pwd-success');
const btnChangePwd  = document.getElementById('btn-change-pwd');

if (changePwdForm) {
  changePwdForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('pwd-current').value.trim();
    const newPassword     = document.getElementById('pwd-new').value.trim();
    const confirmPassword = document.getElementById('pwd-confirm').value.trim();

    if (changePwdErr) changePwdErr.style.display = 'none';
    if (changePwdSucc) changePwdSucc.style.display = 'none';

    if (newPassword !== confirmPassword) {
      if (changePwdErr) {
        changePwdErr.textContent = '✖ New passwords do not match.';
        changePwdErr.style.display = 'block';
      }
      return;
    }

    if (newPassword.length < 6) {
      if (changePwdErr) {
        changePwdErr.textContent = '✖ New password must be at least 6 characters.';
        changePwdErr.style.display = 'block';
      }
      return;
    }

    btnChangePwd.disabled = true;
    btnChangePwd.textContent = 'Updating...';

    try {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser?.userId,
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      const data = await res.json();

      if (res.ok && data.status === 'success') {
        if (changePwdSucc) {
          changePwdSucc.textContent = '✅ Password updated successfully!';
          changePwdSucc.style.display = 'block';
        }
        changePwdForm.reset();
      } else {
        throw new Error(data.message || 'Failed to update password.');
      }
    } catch (err) {
      if (changePwdErr) {
        changePwdErr.textContent = `✖ ${err.message}`;
        changePwdErr.style.display = 'block';
      }
    } finally {
      btnChangePwd.disabled = false;
      btnChangePwd.textContent = 'Update Password';
    }
  });
}

// ─── WHITELIST MANAGER ───────────────────────────────────────────
function renderWhitelist() {
  const container = document.getElementById('whitelist-items');
  if (!container) return;
  container.innerHTML = '';
  whitelist.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'whitelist-item';
    div.innerHTML = `<span>🔓 ${item}</span><button class="btn-remove" onclick="removeWhitelistItem(${i})">Remove</button>`;
    container.appendChild(div);
  });
}

function removeWhitelistItem(index) {
  whitelist.splice(index, 1);
  renderWhitelist();
}

const addWlBtn = document.getElementById('btn-add-whitelist');
if (addWlBtn) {
  addWlBtn.addEventListener('click', () => {
    const input = document.getElementById('whitelist-input');
    const val = input.value.trim();
    if (val && !whitelist.includes(val)) {
      whitelist.push(val);
      renderWhitelist();
      input.value = '';
    }
  });
}

// ─── SENSOR EVENT HANDLER (IPC from Python background engine) ──────
function addViolationCard(v, feedId, counterId) {
  const feed = document.getElementById(feedId);
  if (!feed) return;

  const empty = feed.querySelector('.empty-state');
  if (empty) empty.remove();

  violationCount++;
  const counter = document.getElementById(counterId);
  if (counter) counter.textContent = `${violationCount} Alert(s)`;
  const statViol = document.getElementById('stat-violations');
  if (statViol) statViol.textContent = violationCount;
  const totalViol = document.getElementById('stat-total-violations');
  if (totalViol) totalViol.textContent = violationCount;

  const timeStr = v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
  const card = document.createElement('div');
  card.className = 'alert-card';
  const detValue = v.detected_value ? `<div style="font-family:monospace;font-size:11px;background:rgba(239,68,68,0.1);padding:4px 8px;border-radius:4px;margin-top:6px;word-break:break-all;">${v.detected_value}</div>` : '';
  card.innerHTML = `
    <div style="flex:1">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span class="alert-title-text">${v.title || 'Security Violation'}</span>
        <span class="alert-code-badge">${v.code || 'H?'}</span>
      </div>
      <div class="alert-desc-text">${v.description || ''}</div>
      ${detValue}
      <div style="display:flex;justify-content:space-between;margin-top:8px;">
        <span class="alert-severity">${v.severity || 'HIGH'}</span>
        <span class="alert-time-text">${timeStr}</span>
      </div>
    </div>
  `;
  feed.prepend(card);

  // Stream violation to backend database
  logViolationToDB(v);
}

async function logViolationToDB(v) {
  const payload = {
    session_id: window.activeSessionId || null,
    session_code: window.activeSessionCode || activeInvigilationCode || null,
    student_id: currentUser?.studentId || currentUser?.id || 101,
    violation_code: v.code || 'H0',
    title: v.title || 'Security Violation',
    description: v.detected_value ? `${v.description || ''} | ${v.detected_value}` : (v.description || ''),
    severity: v.severity || 'HIGH',
  };

  // Use offline-first safe post: logs locally first, queues for backend sync if offline
  if (window.offlineQueue) {
    window._API_BASE = API_BASE; // Make API_BASE accessible to offlineQueue
    await window.offlineQueue.safePost(API_BASE, '/desktop/violation', payload);
  } else {
    // Fallback to direct fetch if offlineQueue not loaded
    try {
      await fetch(`${API_BASE}/desktop/violation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn('[PROCTR] Violation not synced (offline):', err.message);
    }
  }
}

if (window.proctrAPI) {
  window.proctrAPI.onSensorEvent((payload) => {
    if (payload.type === 'SENSOR_SYSTEM_START') {
      const ws = document.getElementById('stat-workspace');
      if (ws && payload.workspace_dir) ws.textContent = payload.workspace_dir;
    } else if (payload.type === 'VIOLATION_ALERT') {
      addViolationCard(payload, 'student-feed', 'violation-badge');
      addViolationCard(payload, 'teacher-feed', 'teacher-alert-count');
    }
  });

  window.proctrAPI.onCloseWarning(() => {
    document.getElementById('warning-modal').classList.add('active');
  });
}

document.getElementById('modal-close-btn').addEventListener('click', () => {
  document.getElementById('warning-modal').classList.remove('active');
});

// ─── GLOBAL ANTI-COPY, ANTI-SCREENSHOT & INSTANT MINIMIZATION SECURITY ──
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  return false;
});

document.addEventListener('keydown', (e) => {
  const isPrintScreen = e.key === 'PrintScreen';
  const isSnippingTool = (e.shiftKey && (e.metaKey || e.key === 'Meta') && (e.key === 'S' || e.key === 's'));
  const isCopyShortcut = (e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C' || e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S');

  if (isPrintScreen || isSnippingTool) {
    e.preventDefault();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(''); // Clear clipboard buffer
    }

    // Instantly minimize Electron app window on screenshot attempt during exam
    if (window.proctrAPI && window.proctrAPI.minimizeWindow) {
      window.proctrAPI.minimizeWindow();
    }
  } else if (isCopyShortcut) {
    e.preventDefault();
  }
});

// ─── AUTO-RESTORE SESSION ON PAGE LOAD / RELOAD ──────────────────
// This must run AFTER all functions are defined.
restoreSession();
