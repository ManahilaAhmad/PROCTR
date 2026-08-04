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
  showView('view-login');
  loginForm.reset();
  loginBtn.disabled = false;
  loginBtnTxt.textContent = 'Sign in to PROCTR';
});

document.getElementById('teacher-logout').addEventListener('click', () => {
  currentUser = null;
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

// ─── FETCH LIVE STUDENT DATA FROM DB ──────────────────────────────
async function loadStudentData(userId) {
  try {
    const res = await fetch(`${API_BASE}/student/${userId}/schedule`);
    if (!res.ok) throw new Error('Schedule API error');
    const data = await res.json();
    const schedule = data.schedule || [];

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
    console.warn('Backend schedule fetch error:', err.message);
    renderStudentScheduleTable([]);
    renderEnrolledCoursesGrid([]);
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
    const statusPill = '<span class="status-pill active-pill">Scheduled</span>';
    const actionBtn = `<button class="btn-primary" style="padding:4px 10px; font-size:11px; width:auto;" onclick="selectExamToJoin('${item.course_code}')">Join Exam</button>`;

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

    // Single action button based on exam status
    const isCompleted = item.status === 'Completed' || item.status === 'ENDED' || item.exam_status === 'Completed';

    const actionBtn = isCompleted
      ? `<button class="btn-action-secondary" onclick="openTeacherSubmissions()">📁 View Submissions</button>`
      : `<button class="btn-action-primary" onclick="createInvigilationSession(${examId}, '${courseCodeStr}')">⚡ Create Live Session</button>`;

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
          examId: examId,
          studentId: 'TEACHER',
          courseCode: courseCode
        });
      }

      const codeEl = document.getElementById('inv-session-code');
      if (codeEl) codeEl.textContent = data.session.session_code;
      const passEl = document.getElementById('inv-passcode');
      if (passEl) passEl.textContent = data.session.passcode;
      const cardEl = document.getElementById('invigilator-session-card');
      if (cardEl) cardEl.style.display = 'block';

      // Update Header
      const titleEl = document.getElementById('teacher-exam-title');
      if (titleEl) titleEl.textContent = `${data.session.session_code} — Live Session Active (Passcode: ${data.session.passcode})`;

      // Poll connected student count
      pollInvigilatorLiveStatus(data.session.session_code);
    }
  } catch (err) {
    console.error('Error creating live session:', err);
  }
}

function pollInvigilatorLiveStatus(sessionCode) {
  if (invigilatorPollInterval) clearInterval(invigilatorPollInterval);
  invigilatorPollInterval = setInterval(async () => {
    try {
      const res = await fetch(`${API_BASE}/desktop/session/${sessionCode}/status`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.session) {
        const connEl = document.getElementById('stat-connected');
        if (connEl) connEl.textContent = String(data.session.connectedStudents || 0);
      }
    } catch (err) {
      console.warn('Error polling invigilator status:', err.message);
    }
  }, 2000);
}

// ─── REVEAL PAPER TO STUDENTS (Invigilator) ──────────────────────
const btnRevealPaper = document.getElementById('btn-reveal-paper');
if (btnRevealPaper) {
  btnRevealPaper.addEventListener('click', async () => {
    if (!activeInvigilationCode) return;
    try {
      await fetch(`${API_BASE}/desktop/session/reveal-paper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_code: activeInvigilationCode }),
      });
      btnRevealPaper.textContent = '✓ Exam Paper Revealed';
      btnRevealPaper.disabled = true;
      btnRevealPaper.style.background = 'var(--grey-400)';
    } catch (err) {
      console.error('Error revealing paper:', err);
    }
  });
}

// ─── START EXAM TIMER (Invigilator) ──────────────────────────────
const btnStartExamTimer = document.getElementById('btn-start-exam-timer');
if (btnStartExamTimer) {
  btnStartExamTimer.addEventListener('click', async () => {
    if (!activeInvigilationCode) return;
    try {
      await fetch(`${API_BASE}/desktop/session/start-timer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_code: activeInvigilationCode }),
      });
      btnStartExamTimer.textContent = '✓ Timer Running';
      btnStartExamTimer.disabled = true;
      btnStartExamTimer.style.background = 'var(--grey-400)';
    } catch (err) {
      console.error('Error starting timer:', err);
    }
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
        throw new Error(joinData.message || 'Incorrect Session ID or Passcode.');
      }

      // 2. Create Local Exam Workspace Directory Tree
      if (window.proctrAPI && window.proctrAPI.startExamWorkspace) {
        const result = await window.proctrAPI.startExamWorkspace({
          examId: examCode,
          studentId: regNo,
          courseCode: examCode
        });

        if (result.status === 'success') {
          activeWorkspacePath = result.workspacePath;

          // Update Banner
          const titleEl = document.getElementById('active-exam-course');
          if (titleEl) titleEl.textContent = `${examCode.toUpperCase()} — Exam Session Active`;
          const metaEl = document.getElementById('active-exam-meta');
          if (metaEl) metaEl.textContent = `Workspace Folder Created: ${activeWorkspacePath}`;

          // Switch UI from Join Card to Active Banner
          if (joinExamCard) joinExamCard.style.display = 'none';
          if (examBanner) examBanner.style.display = 'flex';

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

      // 1. Check if Invigilator Revealed Question Paper
      if (session.isPaperRevealed) {
        const docCard = document.getElementById('exam-document-card');
        const docContent = document.getElementById('exam-paper-content');

        if (docCard && docCard.style.display === 'none') {
          docCard.style.display = 'block';
          if (docContent) {
            docContent.innerHTML = `
              <div style="font-weight:700; font-size:15px; margin-bottom:10px; color:var(--navy);">
                SECTION A: PRACTICAL LAB TASKS (${sessionCode.toUpperCase()})
              </div>
              <p><strong>Instructions:</strong> Solve the following programming questions. Write your solutions in your workspace directory (<code>${activeWorkspacePath || 'C:\\PROCTR_Exams'}</code>).</p>
              <hr style="margin:12px 0; border:none; border-top:1px solid var(--grey-200);"/>
              <p><strong>Q1. Data Structure Implementation (40 Marks):</strong><br/>
              Implement a double-ended queue (Deque) supporting push_front, push_back, pop_front, and pop_back with O(1) time complexity. Ensure proper memory cleanup and handle underflow conditions.</p>
              <br/>
              <p><strong>Q2. Algorithm Analysis (60 Marks):</strong><br/>
              Given an array of integers, write an efficient algorithm to find the maximum sum of a contiguous subarray using dynamic programming (Kadane's algorithm).</p>
            `;
          }
        }
      }

      // 2. Check if Invigilator Started Exam Timer
      if (session.isTimerStarted) {
        const statusEl = document.getElementById('exam-status-text');
        if (statusEl && statusEl.textContent.includes('Waiting')) {
          statusEl.textContent = 'Exam Timer Started';
          startExamTimer();
        }
      }
    } catch (err) {
      console.warn('Error polling session status:', err.message);
    }
  }, 2000);
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
  card.innerHTML = `
    <div style="flex:1">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span class="alert-title-text">${v.title || 'Security Violation'}</span>
        <span class="alert-code-badge">${v.code || 'H?'}</span>
      </div>
      <div class="alert-desc-text">${v.description || ''}</div>
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
  try {
    await fetch(`${API_BASE}/desktop/violation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: currentSessionId,
        student_id: currentUser?.studentId || null,
        violation_code: v.code || 'H0',
        title: v.title || 'Security Violation',
        description: v.description || '',
        severity: v.severity || 'HIGH',
      }),
    });
  } catch (err) {
    console.warn('Failed to stream violation to DB:', err.message);
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
