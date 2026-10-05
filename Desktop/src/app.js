/**
 * app.js — Main Application Entry Point (Renderer Process)
 * Connected to Express.js Backend (http://localhost:5000/api) & Neon PostgreSQL
 */

const API_BASE = window.proctrAPI?.apiBase || 'http://localhost:5000/api';
const SOCKET_BASE = API_BASE.replace(/\/api\/?$/, ''); // http://localhost:5000

// Attach the signed login session to every backend request while leaving
// downloads or other third-party URLs untouched.
const nativeFetch = window.fetch.bind(window);
window.fetch = (input, options = {}) => {
  const rawUrl = typeof input === 'string' ? input : input?.url;
  if (!String(rawUrl || '').startsWith(SOCKET_BASE)) return nativeFetch(input, options);

  const headers = new Headers(options.headers || (input instanceof Request ? input.headers : undefined));
  if (currentUser?.sessionToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${currentUser.sessionToken}`);
  }
  return nativeFetch(input, { ...options, headers });
};

// ─── LIVE SOCKET CONNECTION (instant violation push to teacher dashboard) ──
// Uses the socket.io client bundle vendored at src/vendor/socket.io.min.js
// (loaded as a plain <script> tag before this file — no bundler in this app).
let proctrSocket = null;
let joinedSessionRoom = null;

function getProctrSocket() {
  if (proctrSocket) return proctrSocket;
  if (typeof io === 'undefined') {
    console.warn('[Socket] socket.io client not loaded — live push disabled, falling back to polling only.');
    return null;
  }
  proctrSocket = io(SOCKET_BASE, {
    transports: ['websocket', 'polling'],
    auth: { token: currentUser?.sessionToken || '' }
  });

  proctrSocket.on('connect', () => {
    console.log('[Socket] Connected:', proctrSocket.id);
    // Re-join the session room on reconnect (e.g. after backend restart)
    if (joinedSessionRoom) {
      proctrSocket.emit('join_room', { sessionCode: joinedSessionRoom });
    }
  });

  proctrSocket.on('disconnect', () => {
    console.warn('[Socket] Disconnected — live push paused, polling continues as fallback.');
  });

  // Fired by the backend the instant a student's desktop client reports a
  // hard violation for a session this teacher client has joined.
  proctrSocket.on('live_violation', (v) => {
    handleLiveViolationPush(v);
  });

  proctrSocket.on('live_violation_update', (v) => {
    handleLiveViolationPush(v);
  });

  return proctrSocket;
}

function joinSessionRoom(sessionCode) {
  if (!sessionCode) return;
  const codeUpper = String(sessionCode).trim().toUpperCase();
  joinedSessionRoom = codeUpper;
  const socket = getProctrSocket();
  if (socket) {
    // If already connected, emit right away; otherwise the 'connect' handler above will do it.
    if (socket.connected) {
      socket.emit('join_room', { sessionCode: codeUpper });
    }
  }
}

// Merges a pushed violation into the currently-cached session data and
// re-renders immediately, so the teacher sees it with zero delay instead
// of waiting for the next 3s poll tick. The next poll will simply confirm
// the same data from the database (harmless, keeps things eventually consistent
// if a push is ever missed e.g. brief disconnect).
function handleLiveViolationPush(v) {
  if (!v) return;
  if (!window.lastPollSessionData) {
    // Live room UI hasn't done its first poll yet — it will pick this up shortly.
    return;
  }
  const violations = window.lastPollSessionData.recentViolations || [];
  const existingIndex = violations.findIndex(x => String(x.id) === String(v.id));
  if (existingIndex >= 0) {
    violations[existingIndex] = v;
  } else {
    violations.unshift(v);
  }
  window.lastPollSessionData.recentViolations = violations;
  if (typeof renderInvigilatorLiveRoomUI === 'function') {
    renderInvigilatorLiveRoomUI(window.lastPollSessionData);
  }
}

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
  window.proctrAPI?.setSubmissionUser(currentUser).catch(console.error);
  if (currentUser.sessionToken && window.proctrAPI?.storeSessionToken) {
    window.proctrAPI.storeSessionToken(currentUser.sessionToken).catch(() => {});
  }
  const persistedUser = { ...currentUser };
  delete persistedUser.sessionToken;
  delete persistedUser.accessToken;
  localStorage.setItem('proctr_session', JSON.stringify({ role: currentRole, user: persistedUser }));
}

function clearSession() {
  localStorage.removeItem('proctr_session');
  window.proctrAPI?.clearSessionToken?.().catch(() => {});
}

async function restoreSession() {
  try {
    const saved = localStorage.getItem('proctr_session');
    if (!saved) return;
    const { role, user } = JSON.parse(saved);
    if (!user || !role) return;

    const sessionToken = await window.proctrAPI?.getSessionToken?.();
    if (!sessionToken) throw new Error('Secure session token is unavailable.');
    currentRole = role;
    currentUser = { ...user, sessionToken };
    window.proctrAPI?.setSubmissionUser(currentUser).catch(console.error);

    const sessionResponse = await fetch(`${API_BASE}/auth/session`);
    const sessionData = await sessionResponse.json().catch(() => ({}));
    if (!sessionResponse.ok || Number(sessionData.session?.userId) !== Number(user.userId) || sessionData.session?.userType !== user.userType) {
      throw new Error('Saved session is no longer valid.');
    }

    // Sync the active role tab to match the restored session
    document.querySelectorAll('.role-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.role === role);
    });

    if (role === 'student') {
      populateStudentProfile(user);
      showView('view-student');
      showSection('section-s-dashboard', document.querySelectorAll('#view-student .nav-item'));
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

    // Clear any saved session so previous teacher/student session doesn't bleed into new login
    clearSession();
    loginError.style.display = 'none';
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';

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
      headers: { 'Content-Type': 'application/json', 'X-PROCTR-Client': 'desktop' },
      body: JSON.stringify({ email: username, password, user_type: currentRole }),
    });

    const data = await res.json();

    if (res.ok && data.status === 'success') {
      currentUser = data.user;
      saveSession(); // Persist session so reloads don't drop back to login

      if (currentRole === 'student') {
        populateStudentProfile(currentUser);
        showView('view-student');
        showSection('section-s-dashboard', document.querySelectorAll('#view-student .nav-item'));
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
async function revokeDesktopSession() {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: currentUser?.sessionToken ? { Authorization: `Bearer ${currentUser.sessionToken}` } : {},
    });
  } catch {}
  if (proctrSocket) {
    proctrSocket.disconnect();
    proctrSocket = null;
    joinedSessionRoom = null;
  }
}

document.getElementById('student-logout').addEventListener('click', async () => {
  const saved = await window.proctrAPI?.finishExamWork();
  if (saved?.status === 'error') { alert(saved.message); return; }
  if (saved?.pending) alert('Your backup is saved, but cloud confirmation is pending. PROCTR will keep retrying while running. Please notify the invigilator.');
  window.proctrAPI?.setSubmissionUser(null);
  if (window.proctrAPI && window.proctrAPI.stopSensors) window.proctrAPI.stopSensors();
  await revokeDesktopSession();
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

document.getElementById('teacher-logout').addEventListener('click', async () => {
  if (window.proctrAPI && window.proctrAPI.stopSensors) window.proctrAPI.stopSensors();
  await revokeDesktopSession();
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
    if (section === 'section-s-submission') loadStudentSubmittedWork();
  });
});

document.querySelectorAll('#view-teacher .nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const section = 'section-' + btn.dataset.section;
    showSection(section, document.querySelectorAll('#view-teacher .nav-item'));
    if (section === 'section-t-submissions') loadTeacherSubmissionLabs();
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
      actionBtn = `<button class="btn-primary join-scheduled-exam" data-course-code="${escapeHtmlJS(item.course_code)}" style="padding:4px 10px; font-size:11px; width:auto;">⚡ Join Exam</button>`;
    } else {
      statusPill = '<span class="status-pill warning-pill" style="background:#fef3c7; color:#b45309; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:700;">⏳ Session Not Started</span>';
      actionBtn = `<button class="btn-secondary" style="padding:4px 10px; font-size:11px; width:auto; opacity:0.8;" disabled title="Wait for your invigilator to create and start the session.">⏳ Waiting for Invigilator</button>`;
    }

    return `
      <tr>
        <td><strong>${escapeHtmlJS(item.course_title)}</strong></td>
        <td class="mono">${escapeHtmlJS(item.course_code)}</td>
        <td>${escapeHtmlJS(dateStr)}</td>
        <td>${escapeHtmlJS(timeStr)}</td>
        <td>${escapeHtmlJS(roomStr)}</td>
        <td>${statusPill}</td>
        <td>${actionBtn}</td>
      </tr>
    `;
  }).join('');
  tbody.querySelectorAll('.join-scheduled-exam').forEach(button => {
    button.addEventListener('click', () => selectExamToJoin(button.dataset.courseCode));
  });
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
      <div class="course-code">${escapeHtmlJS(c.course_code)}</div>
      <div class="course-name">${escapeHtmlJS(c.course_title)}</div>
      <div class="course-teacher">${escapeHtmlJS(c.teacher_name || 'Department Faculty')}</div>
      <div class="course-credit">${escapeHtmlJS(c.credit_hours ? c.credit_hours + ' Credit Hours' : '3 Credit Hours')}</div>
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
    const roomStr = item.lab_name ? escapeHtmlJS(item.lab_name) : '<span style="color:#94a3b8; font-style:italic;">Unassigned</span>';
    const invigilatorStr = item.invigilator_name ? escapeHtmlJS(item.invigilator_name) : '<span style="color:#94a3b8; font-style:italic;">Unassigned</span>';
    const examId = item.exam_id || 0;
    const courseCodeStr = escapeHtmlJS(item.course_code || 'EXAM');

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
      actionBtn = `<button class="btn-action-secondary view-teacher-submissions">📁 View Submissions & Logs</button>`;
    } else if (isInvigilator) {
      // Assigned Invigilator can create & start live session
      actionBtn = `<button class="btn-action-primary create-live-session" data-exam-id="${Number(examId)}" data-course-code="${courseCodeStr}">⚡ Create Live Session</button>`;
    } else {
      // Course Instructor only (Not Invigilator)
      actionBtn = `<button class="btn-action-secondary" style="opacity:0.8; font-size:11px;" disabled title="Only the assigned invigilator can start this session.">🔒 Invigilation: ${escapeHtmlJS(item.invigilator_name || 'Assigned')}</button>`;
    }

    return `
      <tr>
        <td><strong style="color:var(--navy); font-size:13.5px;">${escapeHtmlJS(item.course_title)}</strong></td>
        <td class="mono">${escapeHtmlJS(item.course_code)}</td>
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
  tbody.querySelectorAll('.create-live-session').forEach(button => {
    button.addEventListener('click', () => createInvigilationSession(Number(button.dataset.examId), button.dataset.courseCode));
  });
  tbody.querySelectorAll('.view-teacher-submissions').forEach(button => {
    button.addEventListener('click', openTeacherSubmissions);
  });
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
          courseCode: courseCode,
          isStudent: false // Teacher's own PC must NOT spawn the sensor engine
        });
      }

      // Switch view to the unified Live Monitoring workspace
      showSection('section-t-monitoring', document.querySelectorAll('#view-teacher .nav-item'));

      // Populate Live Room UI
      const codeEl = document.getElementById('room-session-code');
      if (codeEl) codeEl.textContent = data.session.session_code;
      const passEl = document.getElementById('room-passcode');
      if (passEl) passEl.textContent = data.session.passcode;
      const titleEl = document.getElementById('live-room-course-title');
      if (titleEl) titleEl.textContent = `${courseCode} — Live Lab Exam Session`;

      // Join the live socket room for this session so violations push instantly
      joinSessionRoom(data.session.session_code);

      // Start Polling Live Connected Students & Security Feed (fallback/backfill)
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
window.lastPollSessionData = null;

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
document.getElementById('btn-clear-student-filter')?.addEventListener('click', clearStudentCandidateFilter);
document.getElementById('clear-student-filter-inline')?.addEventListener('click', clearStudentCandidateFilter);

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
          <td><strong>${escapeHtmlJS(s.name)}</strong> <span class="mono" style="font-size:11px;">(${escapeHtmlJS(s.reg_no)})</span></td>
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
          <div class="candidate-card-item" data-reg-no="${escapeHtmlJS(studentReg)}" data-student-name="${escapeHtmlJS(s.name)}" style="background:${isSelected ? 'var(--teal-light, #f0fdfa)' : '#ffffff'}; border:2px solid ${isSelected ? 'var(--teal)' : '#e2e8f0'}; border-radius:10px; padding:14px 16px; cursor:pointer; transition:all 0.2s ease; box-shadow:${isSelected ? '0 4px 12px rgba(0,180,166,0.15)' : 'none'};">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <button type="button" title="View this student's notifications" style="padding:0; border:0; background:none; font-size:14px; font-weight:800; color:var(--navy); cursor:pointer; text-align:left;">
                ${escapeHtmlJS(s.name)}
              </button>
              ${violBadge}
            </div>
            <div style="font-size:12px; font-family:var(--font-mono); color:var(--grey-600); font-weight:600;">
              Reg No: <span style="color:var(--teal);">${escapeHtmlJS(s.reg_no)}</span>
            </div>
            <div style="font-size:11px; color:var(--grey-400); margin-top:6px;">
              Joined at ${new Date(s.started_at || Date.now()).toLocaleTimeString()}
            </div>
          </div>
        `;
      }).join('');
      grid.querySelectorAll('.candidate-card-item').forEach(card => {
        card.addEventListener('click', () => selectStudentCandidateFilter(card.dataset.regNo, card.dataset.studentName));
      });
    }
  }

  // Render Security Feeds (Filtered if selectedStudentFilter is active)
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

  const groupedViolations = Array.from(violations.reduce((groups, violation) => {
    const groupKey = `${violation.student_id || violation.reg_no}:${violation.violation_code || violation.code || 'H0'}`;
    const group = groups.get(groupKey);
    if (group) {
      group.occurrences.push({
        timestamp: violation.timestamp,
        title: violation.surface_title || violation.title,
        description: violation.description || violation.detected_value || '',
        severity: violation.severity || 'HIGH'
      });
      group.lastTimestamp = violation.timestamp || group.lastTimestamp;
    } else {
      groups.set(groupKey, {
        ...violation,
        id: `group-${groupKey}`,
        occurrences: [{
          timestamp: violation.timestamp,
          title: violation.surface_title || violation.title,
          description: violation.description || violation.detected_value || '',
          severity: violation.severity || 'HIGH'
        }],
        occurrenceCount: 1,
        lastTimestamp: violation.timestamp
      });
    }
    if (group) group.occurrenceCount += 1;
    return groups;
  }, new Map()).values());

  if (alertsCount) alertsCount.textContent = `${groupedViolations.length} Alert(s)`;
  if (teacherAlertCount) teacherAlertCount.textContent = `${groupedViolations.length} Alert(s)`;
  if (statTotalViolations) statTotalViolations.textContent = session.recentViolations?.length || 0;

  const openAlertDetails = new Set(
    Array.from(document.querySelectorAll('#teacher-feed details[data-alert-id][open]'))
      .map(details => details.dataset.alertId)
  );
  const alertFingerprint = JSON.stringify(groupedViolations.map(v => ({
    id: v.id,
    occurrenceCount: v.occurrenceCount,
    lastDetectedAt: v.lastDetectedAt,
    description: v.description,
    occurrences: v.occurrences
  })));

  const feedHTML = groupedViolations.length === 0
    ? `<div class="empty-state" style="padding:24px;">${selectedStudentFilter ? 'No security violations recorded for this candidate.' : 'Monitoring is active. Security alerts will stream here live.'}</div>`
    : groupedViolations.map(v => {
        const timeStr = v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
        const occurrences = Array.isArray(v.occurrences) && v.occurrences.length > 0
          ? v.occurrences
          : [{ timestamp: v.timestamp, description: v.description || '' }];
        const badgeColor = v.severity === 'CRITICAL' ? '#dc2626' : '#d97706';
        const badgeBg = v.severity === 'CRITICAL' ? '#fee2e2' : '#fef3c7';
        const cleanSummary = formatCleanLogSummary(v);
        const occurrenceDetails = occurrences.map((occurrence, index) => `
              <div style="padding:8px 0; border-top:1px solid #e2e8f0;">
                <strong>#${index + 1} · ${escapeHtmlJS(occurrence.timestamp ? new Date(occurrence.timestamp).toLocaleString() : 'Unknown time')}</strong>
                <div style="margin-top:3px; color:#475569;">${escapeHtmlJS(occurrence.description || 'Detection recorded.')}</div>
              </div>
            `).join('');
        const targetLabel = v.violation_code === 'H5' ? 'DNS/domain' : v.violation_code === 'H2' ? 'app/site' : 'violation';

        return `
          <div class="alert-card" data-alert-id="${escapeHtmlJS(v.id)}" style="padding:12px 14px; margin-bottom:10px; border-radius:8px; background:#fff; border:1.5px solid ${v.severity === 'CRITICAL' ? '#fca5a5' : '#e2e8f0'}; box-shadow:0 2px 6px rgba(0,0,0,0.03);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-size:13px; font-weight:800; color:#0f172a;">${escapeHtmlJS(v.name)} <span class="mono" style="font-size:11px; color:#0284c7;">(${escapeHtmlJS(v.reg_no)})</span></span>
              <span style="font-size:10px; font-weight:800; background:${badgeBg}; color:${badgeColor}; padding:2px 8px; border-radius:10px;">${escapeHtmlJS(v.severity || 'HIGH')}</span>
            </div>
            <div style="font-size:13px; font-weight:700; color:#dc2626; margin-bottom:4px;">
              ${escapeHtmlJS(v.surface_title || v.title)}
            </div>
            <div style="font-size:12.5px; color:#334155; font-weight:600; line-height:1.4; background:#f8fafc; padding:8px 12px; border-radius:6px; border-left:3px solid ${badgeColor}; margin-top:4px;">
              📌 ${escapeHtmlJS(cleanSummary)}
            </div>
            <div style="margin-top:8px; font-size:11px; color:#64748b;">
              Opened at <strong>${v.timestamp ? new Date(v.timestamp).toLocaleString() : 'Unknown time'}</strong>
            </div>
            <details data-alert-id="${escapeHtmlJS(v.id)}" ${openAlertDetails.has(String(v.id)) ? 'open' : ''} style="margin-top:8px; font-size:12px; color:#334155;">
              <summary style="cursor:pointer; font-weight:800; color:#0284c7;">View ${v.occurrenceCount || occurrences.length} ${targetLabel} detection${(v.occurrenceCount || occurrences.length) === 1 ? '' : 's'}</summary>
              <div style="margin-top:5px;">${occurrenceDetails}</div>
            </details>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; font-size:11px; color:#64748b;">
              <span>Violation Code: <strong style="color:#0f172a; font-family:var(--font-mono);">${escapeHtmlJS(v.violation_code)}</strong></span>
              <span>${timeStr}</span>
            </div>
          </div>
        `;
      }).join('');

  const renderFeed = (feed) => {
    if (!feed) return;
    if (feed.dataset.alertFingerprint === alertFingerprint) return;
    feed.dataset.alertFingerprint = alertFingerprint;
    feed.innerHTML = feedHTML;
  };

  renderFeed(roomFeed);
  renderFeed(teacherFeed);
}

function pollInvigilatorLiveRoom(sessionCode) {
  joinSessionRoom(sessionCode); // ensure the live-push socket room is joined even if called directly
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
      if (proctrSocket && joinedSessionRoom) {
        proctrSocket.emit('leave_room', { sessionCode: joinedSessionRoom });
        joinedSessionRoom = null;
      }
      if (window.proctrAPI) {
        if (window.proctrAPI.stopSensors) window.proctrAPI.stopSensors();
        if (window.proctrAPI.setScreenProtection) window.proctrAPI.setScreenProtection(false);
      }
      showSection('section-t-overview', document.querySelectorAll('#view-teacher .nav-item'));
      await loadTeacherData(currentUser.userId);
    } catch (err) {
      console.error('Error ending session:', err);
    }
  });
}

function openLiveMonitoring() {
  showSection('section-t-monitoring', document.querySelectorAll('#view-teacher .nav-item'));
}
function openTeacherSubmissions() {
  showSection('section-t-submissions', document.querySelectorAll('#view-teacher .nav-item'));
  loadTeacherSubmissionLabs();
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
      window.activeExamId = sessionObj.examId || null;
      autoSubmitTriggered = false; // fresh exam session — allow auto-submit to fire again
      starterCodeInstalledForSession = null;
      questionPaperLoadedForSession = null;

      // 2. Create Local Exam Workspace Directory Tree
      if (window.proctrAPI && window.proctrAPI.startExamWorkspace) {
        const result = await window.proctrAPI.startExamWorkspace({
          examId: sessionObj.examId || window.activeExamId,
          studentId: currentUser.studentId,
          courseCode: examCode,
          sessionCode: examCode,
          securityPolicy: {
            ...(sessionObj.securityPolicy || {}),
            allowed_subnet: sessionObj.labNetworkRange || null
          }
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
let studentLocalCountdown = null;
let starterCodeInstalledForSession = null;
let questionPaperLoadedForSession = null;

async function loadQuestionPaperPreview(iframe, paperUrl, sessionCode) {
  const parsed = new URL(paperUrl, SOCKET_BASE);
  const hostname = parsed.hostname.toLowerCase();
  const isBackend = parsed.origin === new URL(SOCKET_BASE).origin;
  const isCloudinary = parsed.protocol === 'https:' && (hostname === 'res.cloudinary.com' || hostname.endsWith('.cloudinary.com') || hostname.endsWith('.cloudinary.net'));
  if (!isBackend && !isCloudinary) throw new Error('Question paper uses an untrusted file location.');

  const response = await fetch(parsed.toString());
  if (!response.ok) throw new Error('Question paper could not be downloaded.');
  const blob = await response.blob();
  const fileName = decodeURIComponent(parsed.pathname.split('/').pop() || 'question-paper');
  const isWordDoc = /\.(docx?|rtf)$/i.test(fileName) || /wordprocessingml|msword/.test(blob.type);
  if (isWordDoc) {
    await downloadAuthenticatedResource(parsed.toString(), fileName);
    iframe.srcdoc = '<html><body style="font-family:Segoe UI,sans-serif;padding:32px;color:#0f172a"><h3>Question paper downloaded</h3><p>Open the downloaded Word document using the approved exam application. The paper was fetched securely without sharing its URL with a third-party viewer.</p></body></html>';
  } else {
    const objectUrl = URL.createObjectURL(blob);
    iframe.src = `${objectUrl}#toolbar=0&navpanes=0&scrollbar=1`;
  }
  questionPaperLoadedForSession = sessionCode;
}

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

        // Auto-submit whatever's in the workspace the moment the session ends
        if (!autoSubmitTriggered) {
          autoSubmitTriggered = true;
          performExamSubmission('AUTO').then(r => {
            console.log('[AutoSubmit] Session ended:', r);
            if (r?.status === 'success') enableLeaveExamButton();
          });
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

        if (placeholder && iframe && questionPaperLoadedForSession !== sessionCode) {
          placeholder.style.display = 'none';
          iframe.style.display = 'block';

          if (session.examPaperUrl) {
            let paperUrl = session.examPaperUrl;
            if (paperUrl.startsWith('http://') || paperUrl.startsWith('https://')) {
              // Full Cloudinary or external HTTPS URL — use directly
            } else if (paperUrl.startsWith('file:///') || paperUrl.includes(':\\')) {
              const filename = paperUrl.split('/').pop().split('\\').pop();
              paperUrl = `${SOCKET_BASE}/uploads/${filename}`;
            } else {
              paperUrl = `${SOCKET_BASE}${paperUrl.startsWith('/') ? '' : '/'}${paperUrl}`;
            }

            try {
              await loadQuestionPaperPreview(iframe, paperUrl, sessionCode);
            } catch (error) {
              questionPaperLoadedForSession = sessionCode;
              iframe.srcdoc = `<html><body style="font-family:Segoe UI,sans-serif;padding:32px;color:#991b1b"><h3>Unable to open question paper</h3><p>${escapeHtmlJS(error.message)}</p></body></html>`;
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
            questionPaperLoadedForSession = sessionCode;
          }
        }

        if (session.starterFileUrl && activeWorkspacePath && starterCodeInstalledForSession !== sessionCode) {
          starterCodeInstalledForSession = sessionCode;
          const installed = await window.proctrAPI?.installStarterCode?.({
            workspacePath: activeWorkspacePath,
            fileUrl: session.starterFileUrl,
            originalName: session.starterFileName
          });
          if (!installed || installed.status !== 'success') {
            starterCodeInstalledForSession = null;
            console.error('Starter-code installation failed:', installed?.message);
          } else {
            console.log(`Starter code installed at ${installed.starterPath}`);
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
              if (!autoSubmitTriggered) {
                autoSubmitTriggered = true;
                performExamSubmission('AUTO').then(r => {
                  console.log('[AutoSubmit] Timer expired:', r);
                  if (r?.status === 'success') enableLeaveExamButton();
                });
              }
              return;
            }

            if (timerEl) timerEl.textContent = formatSecondsToHMS(secs);

            // 5-Minute Warning: show pulsing banner
            if (warningEl) {
              if (secs <= (session.warningSeconds || 300)) {
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
              if (!autoSubmitTriggered) {
                autoSubmitTriggered = true;
                performExamSubmission('AUTO').then(r => {
                  console.log('[AutoSubmit] Timer expired:', r);
                  if (r?.status === 'success') enableLeaveExamButton();
                });
              }
              return;
            }
            if (timerEl) timerEl.textContent = formatSecondsToHMS(secs);
            if (warningEl) {
              warningEl.style.display = secs <= (session.warningSeconds || 300) ? 'flex' : 'none';
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
// The actual upload — reads the student's local Submissions folder (via the
// Electron main process, which has real filesystem access) and posts it to
// the backend. Called automatically at session end / timer expiry, and
// manually via the Submit button. Safe to call more than once — the backend
// upserts on (exam_id, student_id), so a later call just replaces the files.
let autoSubmitTriggered = false;
let submissionInFlight = null;

function enableLeaveExamButton() {
  const button = document.getElementById('btn-leave-exam');
  if (button) button.style.display = 'inline-flex';
}

async function leaveStudentExamEnvironment() {
  const studentId = currentUser?.studentId || currentUser?.userId;
  if (window.activeSessionCode && studentId) {
    const response = await fetch(`${API_BASE}/desktop/session/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-PROCTR-Client': 'desktop' },
      body: JSON.stringify({ session_code: window.activeSessionCode, student_id: studentId })
    });
    if (!response.ok && response.status !== 404) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Could not leave the exam environment.');
    }
  }
  if (studentPollInterval) clearInterval(studentPollInterval);
  if (studentLocalCountdown) clearInterval(studentLocalCountdown);
  if (window.proctrAPI?.stopSensors) await window.proctrAPI.stopSensors();
  if (window.proctrAPI?.setScreenProtection) await window.proctrAPI.setScreenProtection(false);
  const leaveButton = document.getElementById('btn-leave-exam');
  if (leaveButton) leaveButton.style.display = 'none';
  window.activeSessionCode = null;
  window.activeSessionId = null;
  window.activeExamId = null;
  activeWorkspacePath = null;
  showSection('section-s-dashboard', document.querySelectorAll('#view-student .nav-item'));
  await loadStudentData(currentUser.userId);
}

async function performExamSubmission(type) {
  if (submissionInFlight) return submissionInFlight;
  submissionInFlight = submitExamAndShowResult(type);
  try {
    return await submissionInFlight;
  } finally {
    submissionInFlight = null;
  }
}

async function submitExamAndShowResult(type) {
  const button = document.getElementById('btn-submit-exam');
  const status = document.getElementById('submit-status');
  if (button) {
    button.disabled = true;
    button.textContent = 'Submitting...';
  }
  if (status) {
    status.textContent = 'Uploading your submission...';
    status.style.display = 'block';
    status.style.color = 'var(--grey-500)';
  }

  let result;
  try {
    result = await uploadExamSubmission(type);
    if (!result || !['success', 'pending'].includes(result.status)) {
      throw new Error(result?.message || 'Submission failed — you can try again.');
    }
  } catch (error) {
    result = { status: 'error', message: error.message || 'Submission failed — you can try again.' };
  }

  const succeeded = result.status === 'success';
  if (button) {
    button.disabled = succeeded;
    button.textContent = succeeded ? '✓ Submitted' : result.status === 'pending' ? 'Retry saved submission' : '✓ Submit Solution';
  }
  if (status) {
    status.textContent = succeeded
      ? `✅ ${result.message || 'Your submission has been saved successfully.'}`
      : `${result.status === 'pending' ? 'Saved copy: ' : '✖ '}${result.message}`;
    status.style.color = succeeded ? 'var(--teal)' : result.status === 'pending' ? '#b45309' : '#dc2626';
  }
  return result;
}

async function uploadExamSubmission(type) {
  if (!window.proctrAPI || !window.proctrAPI.submitExamWork) {
    return { status: 'error', message: 'Submission is not available in this environment.' };
  }
  const examId = window.activeExamId;
  const studentId = currentUser?.studentId || currentUser?.userId;
  if (!examId || !studentId) {
    return { status: 'error', message: 'No active exam to submit — join a session first.' };
  }
  return window.proctrAPI.submitExamWork({
    examId,
    studentId,
    sessionCode: window.activeSessionCode,
    workspacePath: activeWorkspacePath,
    submissionType: type,
    apiBase: API_BASE,
    sessionToken: currentUser?.sessionToken
  });
}

const submitExamBtn = document.getElementById('btn-submit-exam');
if (submitExamBtn) {
  submitExamBtn.addEventListener('click', async () => {
    const status = document.getElementById('submit-status');
    submitExamBtn.disabled = true;
    submitExamBtn.textContent = 'Submitting...';

    const result = await performExamSubmission('MANUAL');

    if (result.status === 'success') {
      submitExamBtn.textContent = '✓ Submitted';
      if (status) {
        status.textContent = `✅ ${result.message || 'Your submission has been sent successfully.'}`;
        status.style.display = 'block';
        status.style.color = 'var(--teal)';
      }
      enableLeaveExamButton();
    } else {
      submitExamBtn.disabled = false;
      submitExamBtn.textContent = '✓ Submit Solution';
      if (status) {
        status.textContent = `✖ ${result.message || 'Submission failed — you can try again.'}`;
        status.style.display = 'block';
        status.style.color = '#dc2626';
      }
    }
  });
}

const leaveExamBtn = document.getElementById('btn-leave-exam');
if (leaveExamBtn) {
  leaveExamBtn.addEventListener('click', async () => {
    if (!confirm('Leave the secure exam environment? Make sure your final work has been submitted.')) return;
    leaveExamBtn.disabled = true;
    try {
      await leaveStudentExamEnvironment();
    } catch (error) {
      alert(error.message);
    } finally {
      leaveExamBtn.disabled = false;
    }
  });
}

// ─── SUBMITTED WORK VIEWER (Student) ──────────────────────────────
function escapeHtmlJS(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function formatFileSize(bytes) {
  bytes = Number(bytes) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function loadStudentSubmittedWork() {
  const root = document.getElementById('student-submitted-work-root');
  if (!root) return;
  const studentId = currentUser?.studentId || currentUser?.userId;
  if (!studentId) { root.innerHTML = '<div class="empty-state">Not logged in.</div>'; return; }

  root.innerHTML = '<div class="empty-state">Loading your submitted work…</div>';
  try {
    const res = await submissionFetch(`${API_BASE}/submission/student/${studentId}/labs`);
    const data = await res.json();
    if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Failed to load.');
    renderStudentLabsList(data.labs || []);
  } catch (err) {
    root.innerHTML = `<div class="empty-state">Could not load submitted work: ${escapeHtmlJS(err.message)}</div>`;
  }
  const backups = await window.proctrAPI?.getSubmissionBackups().catch(() => []) || [];
  const pending = backups.filter(job => job.state !== 'synced');
  if (pending.length) root.insertAdjacentHTML('afterbegin', `<div class="empty-state" style="color:#b45309">
    <strong>${pending.length} saved backup(s) still need cloud confirmation.</strong>
    <p>Keep PROCTR running to retry. Ask the invigilator for help before leaving if this remains pending.</p>
    ${pending.map(job => `<p>Exam ${escapeHtmlJS(job.examId)}: ${escapeHtmlJS(job.message || 'Waiting to upload')}</p>`).join('')}
    <p>Use the PROCTR tray menu to open the backup folder.</p>
  </div>`);
}

function renderStudentLabsList(labs) {
  const root = document.getElementById('student-submitted-work-root');
  if (!labs.length) {
    root.innerHTML = '<div class="empty-state">You haven\'t submitted any work yet. It will appear here automatically once your exam session ends, or once you submit manually.</div>';
    return;
  }
  root.innerHTML = `
    <div class="folder-grid">
      ${labs.map((lab, i) => `
        <button class="folder-card" data-co-id="${lab.course_offering_id}" data-idx="${i}">
          <div class="folder-icon">📁</div>
          <div class="folder-name">${escapeHtmlJS(lab.label)}</div>
          <div class="folder-meta">Submitted ${new Date(lab.submitted_at).toLocaleString()}</div>
        </button>
      `).join('')}
    </div>
  `;
  root.querySelectorAll('.folder-card').forEach((card, i) => {
    card.addEventListener('click', () => loadStudentLabFiles(labs[i].course_offering_id, labs[i].label));
  });
}

async function loadStudentLabFiles(courseOfferingId, labLabel) {
  const root = document.getElementById('student-submitted-work-root');
  const studentId = currentUser?.studentId || currentUser?.userId;
  root.innerHTML = '<div class="empty-state">Loading files…</div>';
  try {
    const res = await submissionFetch(`${API_BASE}/submission/student/${studentId}/lab/${courseOfferingId}/files`);
    const data = await res.json();
    if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Failed to load files.');
    const files = data.files || [];
    root.innerHTML = `
      <div class="breadcrumb-bar">
        <button class="crumb-link" id="back-to-labs">Submitted Work</button>
        <span class="crumb-sep">/</span>
        <span class="crumb-current">${escapeHtmlJS(labLabel)}</span>
      </div>
      ${files.length === 0 ? '<div class="empty-state">No files found in this submission.</div>' : `
      <table class="file-list-table">
        <thead><tr><th>File</th><th>Size</th><th></th></tr></thead>
        <tbody>
          ${files.map(f => {
            const downloadUrl = `${API_BASE}/submission/file/${f.submission_id}?relativePath=${encodeURIComponent(f.relative_path)}&studentId=${studentId}&download=true`;
            return `
              <tr>
                <td class="file-name">${escapeHtmlJS(f.relative_path)}</td>
                <td>${formatFileSize(f.file_size)}</td>
                <td><button type="button" class="file-download authenticated-download" data-url="${escapeHtmlJS(downloadUrl)}" data-name="${escapeHtmlJS(f.relative_path)}">Download</button></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>`}
    `;
    document.getElementById('back-to-labs').addEventListener('click', loadStudentSubmittedWork);
    root.querySelectorAll('.authenticated-download').forEach(button => {
      button.addEventListener('click', () => downloadAuthenticatedResource(button.dataset.url, button.dataset.name));
    });
  } catch (err) {
    root.innerHTML = `<div class="empty-state">Could not load files: ${escapeHtmlJS(err.message)}</div>`;
  }
}

function getPreviewKind(name) {
  const fileName = String(name || '').toLowerCase();

  if (/\.(html?|xhtml|svg)$/.test(fileName)) return 'html';
  if (/\.(pdf)$/.test(fileName)) return 'pdf';
  if (/\.(png|jpe?g|gif|bmp|webp|ico)$/.test(fileName)) return 'image';
  if (/\.(txt|md|csv|log|json|xml|yaml|yml|ini|cfg|toml|sql|java|c|cc|cpp|h|hpp|cs|php|rb|go|rs|swift|kt|scala|js|jsx|ts|tsx|py|sh|bash|zsh|ps1|bat|cmd|css)$/.test(fileName)) return 'text';
  return 'unsupported';
}

async function downloadAuthenticatedResource(resourceUrl, suggestedName) {
  try {
    const parsed = new URL(resourceUrl, window.location.href);
    const hostname = parsed.hostname.toLowerCase();
    const isBackend = parsed.origin === new URL(SOCKET_BASE).origin;
    const isCloudinary = parsed.protocol === 'https:' && (hostname === 'res.cloudinary.com' || hostname.endsWith('.cloudinary.com') || hostname.endsWith('.cloudinary.net'));
    if (!isBackend && !isCloudinary) throw new Error('Untrusted resource origin.');
    const response = await fetch(parsed.toString());
    if (!response.ok) throw new Error('The file could not be downloaded.');
    const blobUrl = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = String(suggestedName || 'download').split(/[\\/]/).pop() || 'download';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (error) {
    alert(error.message || 'The file could not be downloaded.');
  }
}

function openResourceInViewer(resourceUrl, title) {
  const modal = document.getElementById('submission-viewer-modal');
  const iframe = document.getElementById('submission-viewer-iframe');
  const message = document.getElementById('submission-viewer-message');
  const titleEl = document.getElementById('submission-viewer-title');

  let parsedResource;
  try {
    parsedResource = new URL(resourceUrl, window.location.href);
    if (parsedResource.origin !== new URL(SOCKET_BASE).origin) throw new Error('Untrusted resource origin.');
  } catch {
    alert('This file location is not trusted and cannot be opened.');
    return;
  }
  const safeResourceUrl = parsedResource.toString();
  const downloadResource = new URL(safeResourceUrl);
  downloadResource.searchParams.set('download', 'true');
  const safeDownloadUrl = downloadResource.toString();

  if (!modal || !iframe || !message || !titleEl) {
    void downloadSubmission(safeResourceUrl);
    return;
  }

  iframe.setAttribute('sandbox', 'allow-scripts allow-downloads');
  titleEl.textContent = title || 'Submission Viewer';
  iframe.src = 'about:blank';
  iframe.srcdoc = '';
  iframe.style.display = 'none';
  message.style.display = 'none';
  modal.style.display = 'flex';

  submissionFetch(safeResourceUrl, { credentials: 'include' })
    .then(async (res) => {
      if (!res.ok) throw new Error('The file could not be opened.');

      const mimeType = (res.headers.get('content-type') || '').toLowerCase();
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const previewKind = getPreviewKind(title || safeResourceUrl);

      if (previewKind === 'html' || mimeType.includes('text/html') || mimeType.includes('application/xhtml+xml')) {
        const html = await blob.text();
        const safeText = escapeHtmlJS(html);
        iframe.srcdoc = `<html><body style="font-family:ui-monospace,Consolas,monospace;padding:20px;line-height:1.5;white-space:pre-wrap;background:#fff;color:#0f172a;"><strong>HTML source preview (scripts are not executed)</strong><hr>${safeText}</body></html>`;
        iframe.style.display = 'block';
        return;
      }

      if (previewKind === 'image' || mimeType.includes('image/')) {
        iframe.src = objectUrl;
        iframe.style.display = 'block';
        return;
      }

      if (previewKind === 'pdf' || mimeType.includes('application/pdf')) {
        iframe.src = objectUrl;
        iframe.style.display = 'block';
        return;
      }

      if (
        previewKind === 'text' ||
        mimeType.startsWith('text/') ||
        mimeType.includes('json') ||
        mimeType.includes('xml') ||
        mimeType.includes('javascript') ||
        mimeType.includes('typescript') ||
        mimeType.includes('x-python')
      ) {
        const text = await blob.text();
        if (!text || text.trim().length === 0) {
          message.innerHTML = `
            <div style="padding:26px; line-height:1.7;">
              <strong>This file is empty.</strong>
              <p>There is no content to preview yet.</p>
              <p><a href="${escapeHtmlJS(safeDownloadUrl)}" target="_blank" rel="noopener noreferrer">Download file</a></p>
            </div>
          `;
          message.style.display = 'block';
          return;
        }

        const safeText = escapeHtmlJS(text).replace(/\n/g, '<br>');
        iframe.srcdoc = `
          <html>
            <body style="font-family:Segoe UI, sans-serif; padding:20px; line-height:1.6; white-space:pre-wrap; background:#fff; color:#0f172a;">
              ${safeText}
            </body>
          </html>
        `;
        iframe.style.display = 'block';
        return;
      }

      message.innerHTML = `
        <div style="padding:26px; line-height:1.7;">
          <strong>Preview is not available for this file type.</strong>
          <p>Download the file to inspect it with the appropriate application.</p>
          <p><a href="${escapeHtmlJS(safeDownloadUrl)}" target="_blank" rel="noopener noreferrer">Download</a></p>
        </div>
      `;
      message.style.display = 'block';
    })
    .catch((err) => {
      message.innerHTML = `
        <div style="padding:26px; line-height:1.7;">
          <strong>Unable to open this file.</strong>
          <p>${escapeHtmlJS(err.message || 'The preview could not be generated.')}</p>
          <p><a href="${escapeHtmlJS(safeDownloadUrl)}" target="_blank" rel="noopener noreferrer">Download</a></p>
        </div>
      `;
      message.style.display = 'block';
    });
}

const submissionViewerCloseBtn = document.getElementById('submission-viewer-close');
if (submissionViewerCloseBtn) {
  submissionViewerCloseBtn.addEventListener('click', () => {
    const modal = document.getElementById('submission-viewer-modal');
    const iframe = document.getElementById('submission-viewer-iframe');
    const message = document.getElementById('submission-viewer-message');
    if (modal) modal.style.display = 'none';
    if (iframe) iframe.src = 'about:blank';
    if (message) message.style.display = 'none';
  });
}

// ─── STUDENT SUBMISSIONS BROWSER (Teacher) ────────────────────────
async function loadTeacherSubmissionLabs() {
  const root = document.getElementById('teacher-submissions-root');
  if (!root) return;
  const teacherId = currentUser?.teacherId;
  if (!teacherId) { root.innerHTML = '<div class="empty-state">Not logged in as a teacher.</div>'; return; }

  root.innerHTML = '<div class="empty-state">Loading your submission folders…</div>';
  try {
    const res = await submissionFetch(`${API_BASE}/submission/teacher/${teacherId}/labs`);
    const data = await res.json();
    if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Failed to load.');
    renderTeacherLabsList(data.labs || []);
  } catch (err) {
    root.innerHTML = `<div class="empty-state">Could not load submissions: ${escapeHtmlJS(err.message)}</div>`;
  }
}

function renderTeacherLabsList(labs) {
  const root = document.getElementById('teacher-submissions-root');
  if (!labs.length) {
    root.innerHTML = '<div class="empty-state">You have no course labs assigned yet.</div>';
    return;
  }
  root.innerHTML = `
    <div class="folder-grid">
      ${labs.map(lab => `
        <button class="folder-card" data-co-id="${lab.course_offering_id}">
          <div class="folder-icon">📁</div>
          <div class="folder-name">${escapeHtmlJS(lab.label)}</div>
          <div class="folder-meta">${lab.submission_count} submission${lab.submission_count === 1 ? '' : 's'}</div>
        </button>
      `).join('')}
    </div>
  `;
  root.querySelectorAll('.folder-card').forEach((card, i) => {
    card.addEventListener('click', () => loadLabStudents(labs[i].course_offering_id, labs[i].label));
  });
}

async function loadLabStudents(courseOfferingId, labLabel) {
  const root = document.getElementById('teacher-submissions-root');
  const teacherId = currentUser?.teacherId;
  root.innerHTML = '<div class="empty-state">Loading students…</div>';
  try {
    const res = await submissionFetch(`${API_BASE}/submission/teacher/${teacherId}/lab/${courseOfferingId}/students`);
    const data = await res.json();
    if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Failed to load students.');
    const students = data.students || [];
    root.innerHTML = `
      <div class="breadcrumb-bar">
        <button class="crumb-link" id="back-to-teacher-labs">Student Submissions</button>
        <span class="crumb-sep">/</span>
        <span class="crumb-current">${escapeHtmlJS(labLabel)}</span>
      </div>
      ${students.length === 0 ? '<div class="empty-state">No students have submitted for this lab yet.</div>' : `
      <div class="folder-grid">
        ${students.map(s => `
          <button class="folder-card" data-student-id="${s.student_id}">
            <div class="folder-icon">🧑‍🎓</div>
            <div class="folder-name">${escapeHtmlJS(s.registration_no)}</div>
            <div class="folder-meta">${escapeHtmlJS(s.name)} · ${s.file_count} file${s.file_count === 1 ? '' : 's'}</div>
          </button>
        `).join('')}
      </div>`}
    `;
    document.getElementById('back-to-teacher-labs').addEventListener('click', loadTeacherSubmissionLabs);
    root.querySelectorAll('.folder-card[data-student-id]').forEach((card, i) => {
      card.addEventListener('click', () => loadStudentSubmissionDetail(courseOfferingId, students[i].student_id, labLabel, students[i].registration_no));
    });
  } catch (err) {
    root.innerHTML = `<div class="empty-state">Could not load students: ${escapeHtmlJS(err.message)}</div>`;
  }
}

async function loadStudentSubmissionDetail(courseOfferingId, studentId, labLabel, regNo) {
  const root = document.getElementById('teacher-submissions-root');
  const teacherId = currentUser?.teacherId;
  root.innerHTML = '<div class="empty-state">Loading submission…</div>';
  try {
    const res = await submissionFetch(`${API_BASE}/submission/teacher/${teacherId}/lab/${courseOfferingId}/student/${studentId}/files`);
    const data = await res.json();
    if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Failed to load submission.');
    const files = data.files || [];
    const submission = data.submission || {};
    root.innerHTML = `
      <div class="breadcrumb-bar">
        <button class="crumb-link" id="back-to-teacher-labs2">Student Submissions</button>
        <span class="crumb-sep">/</span>
        <button class="crumb-link" id="back-to-lab-students">${escapeHtmlJS(labLabel)}</button>
        <span class="crumb-sep">/</span>
        <span class="crumb-current">${escapeHtmlJS(regNo)}</span>
      </div>
      ${submission.has_report ? `
      <div class="report-download-bar">
        <div>
          <div style="font-weight:800; font-size:13px; color:var(--navy);">📋 Security Log Report</div>
          <div style="font-size:11.5px; color:var(--grey-500); margin-top:2px;">Filterable by severity (Critical / High / Medium / Low) — open in browser or download at any time.</div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="report-btn open-secure-resource" data-url="${escapeHtmlJS(`${API_BASE}/submission/teacher/${teacherId}/report/${submission.submission_id}?download=false`)}" data-title="Security Log Report">📖 Open Security Log Report</button>
          <button type="button" class="file-download authenticated-download" data-url="${escapeHtmlJS(`${API_BASE}/submission/teacher/${teacherId}/report/${submission.submission_id}?download=true`)}" data-name="security_log_report.html">⬇ Download</button>
        </div>
      </div>` : ''}
      ${files.length === 0 ? '<div class="empty-state">No files in this submission.</div>' : `
      <table class="file-list-table">
        <thead><tr><th>File</th><th>Size</th><th></th></tr></thead>
        <tbody>
          ${files.map(f => {
            const fileUrl = `${API_BASE}/submission/file/${submission.submission_id}?relativePath=${encodeURIComponent(f.relative_path)}&teacherId=${teacherId}`;
            return `
              <tr>
                <td class="file-name">${escapeHtmlJS(f.relative_path)}</td>
                <td>${formatFileSize(f.file_size)}</td>
                <td style="display:flex; gap:8px; justify-content:flex-end; align-items:center; flex-wrap:wrap;">
                  <button type="button" class="file-download open-secure-resource" data-url="${escapeHtmlJS(`${fileUrl}&download=false`)}" data-title="${escapeHtmlJS(f.relative_path)}">Open</button>
                  <button type="button" class="file-download authenticated-download" data-url="${escapeHtmlJS(`${fileUrl}&download=true`)}" data-name="${escapeHtmlJS(f.relative_path)}">Download</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>`}
    `;
    document.getElementById('back-to-teacher-labs2').addEventListener('click', loadTeacherSubmissionLabs);
    document.getElementById('back-to-lab-students').addEventListener('click', () => loadLabStudents(courseOfferingId, labLabel));
    root.querySelectorAll('.open-secure-resource').forEach(button => {
      button.addEventListener('click', () => openResourceInViewer(button.dataset.url, button.dataset.title));
    });
    root.querySelectorAll('.authenticated-download').forEach(button => {
      button.addEventListener('click', () => downloadAuthenticatedResource(button.dataset.url, button.dataset.name));
    });
  } catch (err) {
    root.innerHTML = `<div class="empty-state">Could not load submission: ${escapeHtmlJS(err.message)}</div>`;
  }
}

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
    div.innerHTML = `<span>🔓 ${escapeHtmlJS(item)}</span><button class="btn-remove" data-index="${i}">Remove</button>`;
    div.querySelector('.btn-remove').addEventListener('click', () => removeWhitelistItem(i));
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
  const detValue = v.detected_value ? `<div style="font-family:monospace;font-size:11px;background:rgba(239,68,68,0.1);padding:4px 8px;border-radius:4px;margin-top:6px;word-break:break-all;">${escapeHtmlJS(v.detected_value)}</div>` : '';
  card.innerHTML = `
    <div style="flex:1">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span class="alert-title-text">${escapeHtmlJS(v.title || 'Security Violation')}</span>
        <span class="alert-code-badge">${escapeHtmlJS(v.code || 'H?')}</span>
      </div>
      <div class="alert-desc-text">${escapeHtmlJS(v.description || '')}</div>
      ${detValue}
      <div style="display:flex;justify-content:space-between;margin-top:8px;">
        <span class="alert-severity">${escapeHtmlJS(v.severity || 'HIGH')}</span>
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
    event_key: v.event_key || '',
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


// Submission credentials stay in headers, including downloads (never in URLs).
function submissionFetch(url, options = {}) {
  const target = new URL(url, API_BASE);
  const base = new URL(API_BASE);
  const headers = new Headers(options.headers);
  if (target.origin === base.origin && target.pathname.startsWith(`${base.pathname}/submission/`) && currentUser?.sessionToken) {
    headers.set('Authorization', `Bearer ${currentUser.sessionToken}`);
  }
  return fetch(url, { ...options, headers });
}
async function downloadSubmission(url) {
  try {
    const response = await submissionFetch(url);
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.message || 'Could not download the submitted file.');
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = new URL(url).searchParams.get('relativePath')?.split('/').pop() || 'security_log_report.html';
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
  } catch (error) { alert(error.message); }
}
document.addEventListener('click', event => {
  const anchor = event.target.closest('a');
  if (anchor?.href?.startsWith(`${API_BASE}/submission/`)) {
    event.preventDefault();
    void downloadSubmission(anchor.href);
  }
}, true);
window.proctrAPI?.onSubmissionState(job => {
  if (String(job.studentId) !== String(currentUser?.studentId) || String(job.examId) !== String(window.activeExamId)) return;
  const status = document.getElementById('submit-status');
  const button = document.getElementById('btn-submit-exam');
  if (status) {
    status.style.display = 'block';
    status.textContent = job.state === 'synced' ? 'Submitted: cloud receipt confirmed. Backup copy retained.' : job.message;
    status.style.color = job.state === 'synced' ? 'var(--teal)' : '#b45309';
  }
  if (button) { button.disabled = job.state === 'synced'; button.textContent = job.state === 'synced' ? 'Submitted' : 'Retry saved submission'; }
});
window.proctrAPI?.onSubmissionStorageError(message => alert(message));
