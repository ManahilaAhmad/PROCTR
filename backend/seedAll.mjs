// =====================================================================
// PROCTR — Complete University Seed Script (seedAll.mjs)
//
// HOW TO RUN:
//   1. Make sure bcryptjs is installed:  npm install bcryptjs
//   2. Run from backend folder:          node seedAll.mjs
//
// DB must be empty (or run TRUNCATE first — script handles it)
// All users login with password: password123
// =====================================================================

import pool from './db.js';

// ── Shared password hash for "password123" ────────────────────────────
// Generated with: bcrypt.hash('password123', 10)
// If bcryptjs is installed, it generates fresh; otherwise uses this fallback.
let bcrypt;
try {
  const mod = await import('bcryptjs');
  bcrypt = mod.default;
  console.log('✅ bcryptjs loaded — generating fresh hash');
} catch {
  console.warn('⚠️  bcryptjs not found. Run: npm install bcryptjs');
  process.exit(1);
}

const HASH = await bcrypt.hash('password123', 10);
console.log('🔐 Password hash ready\n');

const client = await pool.connect();

// Helper: insert and return ID
async function insert(sql, params = []) {
  const res = await client.query(sql, params);
  return res.rows[0];
}

try {
  await client.query('BEGIN');

  // ══════════════════════════════════════════════════════════════════
  // STEP 1 — CLEAN SLATE
  // ══════════════════════════════════════════════════════════════════
  console.log('🗑️  Truncating all tables...');
  await client.query(`
    TRUNCATE TABLE
      notification_read, broadcast_announcement, user_notification,
      exam_result, moss_result, teacher_evaluation, ai_evaluation,
      student_submission, approval, duty_swap_request,
      invigilator_assignment, exam_schedule, rubric, question_paper,
      exam, lab, enrollment, course_offering, section, course,
      academic_term, batch, program, dec_member, director, coordinator,
      hod, teacher, student, department, users
    RESTART IDENTITY CASCADE
  `);
  console.log('   Done.\n');

  // ══════════════════════════════════════════════════════════════════
  // STEP 2 — DEPARTMENTS
  // ══════════════════════════════════════════════════════════════════
  console.log('🏛️  Creating departments...');
  const deptData = [
    { name: 'Computer Science',      code: 'CS' },
    { name: 'Artificial Intelligence', code: 'AI' },
    { name: 'Data Science',          code: 'DS' },
    { name: 'Game Development',      code: 'GM' },
    { name: 'Software Engineering',  code: 'SE' },
    { name: 'Information Technology',code: 'IT' },
    { name: 'Cyber Security',        code: 'CY' },
  ];
  const deptIds = {};
  for (const d of deptData) {
    const r = await insert(
      'INSERT INTO department (department_name, department_code) VALUES ($1,$2) RETURNING department_id',
      [d.name, d.code]
    );
    deptIds[d.code] = r.department_id;
    console.log(`   ✅ ${d.code} — ${d.name}`);
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP 3 — PROGRAMS (one BS per department)
  // ══════════════════════════════════════════════════════════════════
  console.log('\n📚 Creating programs...');
  const programData = [
    { dept: 'CS', name: 'BS Computer Science',       code: 'BSCS' },
    { dept: 'AI', name: 'BS Artificial Intelligence',code: 'BSAI' },
    { dept: 'DS', name: 'BS Data Science',           code: 'BSDS' },
    { dept: 'GM', name: 'BS Game Development',       code: 'BSGM' },
    { dept: 'SE', name: 'BS Software Engineering',   code: 'BSSE' },
    { dept: 'IT', name: 'BS Information Technology', code: 'BSIT' },
    { dept: 'CY', name: 'BS Cyber Security',         code: 'BSCY' },
  ];
  const programIds = {};
  for (const p of programData) {
    const r = await insert(
      `INSERT INTO program (department_id, program_name, program_code, total_semesters, degree_type)
       VALUES ($1,$2,$3,8,'BS') RETURNING program_id`,
      [deptIds[p.dept], p.name, p.code]
    );
    programIds[p.code] = r.program_id;
    console.log(`   ✅ ${p.code} — ${p.name}`);
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP 4 — BATCHES & SECTIONS (all 8 semesters, A/B/C per sem)
  //
  // Each program gets 4 batches covering pairs of semesters:
  //   Batch-2022 → semesters 7 & 8
  //   Batch-2023 → semesters 5 & 6   ← CS students are here
  //   Batch-2024 → semesters 3 & 4
  //   Batch-2025 → semesters 1 & 2
  //
  // Each batch has 6 sections: {sem}A, {sem}B, {sem}C for both sems
  // ══════════════════════════════════════════════════════════════════
  console.log('\n🗂️  Creating batches and sections (all 8 sems × A/B/C)...');
  const batchConfig = [
    { year: 2022, admission: 2022, graduation: 2026, sems: [7, 8] },
    { year: 2023, admission: 2023, graduation: 2027, sems: [5, 6] },
    { year: 2024, admission: 2024, graduation: 2028, sems: [3, 4] },
    { year: 2025, admission: 2025, graduation: 2029, sems: [1, 2] },
  ];

  // Store section IDs we need: sectionIds['CS']['6A'] etc.
  const sectionIds = {};
  const batchIds = {};

  for (const [progCode, progId] of Object.entries(programIds)) {
    const deptCode = programData.find(p => p.code === progCode).dept;
    sectionIds[deptCode] = {};
    batchIds[deptCode] = {};

    for (const bc of batchConfig) {
      const batchName = `${progCode}-${bc.year}`;
      const r = await insert(
        `INSERT INTO batch (program_id, batch_name, admission_year, expected_graduation_year)
         VALUES ($1,$2,$3,$4) RETURNING batch_id`,
        [progId, batchName, bc.admission, bc.graduation]
      );
      const batchId = r.batch_id;
      batchIds[deptCode][bc.year] = batchId;

      // Create sections for each semester pair
      for (const sem of bc.sems) {
        for (const letter of ['A', 'B', 'C']) {
          const sectionName = `${sem}${letter}`;
          const sr = await insert(
            'INSERT INTO section (batch_id, section_name, max_students) VALUES ($1,$2,40) RETURNING section_id',
            [batchId, sectionName]
          );
          sectionIds[deptCode][sectionName] = sr.section_id;
        }
      }
    }
    console.log(`   ✅ ${deptCode} — 4 batches × 6 sections = 24 sections`);
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP 5 — ACADEMIC TERM
  // ══════════════════════════════════════════════════════════════════
  console.log('\n📅 Creating academic term...');
  const termRow = await insert(
    `INSERT INTO academic_term (term_name, semester, year, start_date, end_date)
     VALUES ('Spring 2026','Spring',2026,'2026-02-01','2026-06-30') RETURNING term_id`
  );
  const termId = termRow.term_id;
  console.log(`   ✅ Spring 2026 (term_id=${termId})`);

  // ══════════════════════════════════════════════════════════════════
  // STEP 6 — USERS
  // ══════════════════════════════════════════════════════════════════
  console.log('\n👤 Creating users...');

  async function addUser(first, last, email, type) {
    const r = await insert(
      `INSERT INTO users (first_name, last_name, email, password_hash, user_type, is_active)
       VALUES ($1,$2,$3,$4,$5,TRUE) RETURNING user_id`,
      [first, last, email, HASH, type]
    );
    return r.user_id;
  }

  // ── CS Real Users ──────────────────────────────────────────────────
  console.log('   [CS] Real users:');
  const u = {};
  u.shanawar  = await addUser('Shanawar',  'Raza',    'shanawar.raza@university.edu',    'student');
  u.manahil   = await addUser('Manahil',   'Ahmad',   'manahil.ahmad@university.edu',    'student');
  u.sumaiyyah = await addUser('Sumaiyyah', 'Masood',  'sumaiyyah.masood@university.edu', 'student');
  u.sumaira   = await addUser('Sumaira',   'Naz',     'sumaira.naz@university.edu',      'teacher');
  u.ayaz      = await addUser('Ayaz',      'Ahmed',   'ayaz.ahmed@university.edu',       'teacher');
  u.amnah     = await addUser('Amnah',     'Riaz',    'amnah.riaz@university.edu',       'teacher');
  u.bilal     = await addUser('Bilal',     'Tariq',   'bilal.tariq@university.edu',      'dec');
  u.ashfaq    = await addUser('Ashfaq',    'Hussain', 'ashfaq.hussain@university.edu',   'hod');
  u.namra     = await addUser('Namra',     'Khan',    'namra.khan@university.edu',       'coordinator');
  console.log('      ✅ 9 CS users created');

  // ── Placeholder HODs/Coordinators for other 6 departments ──────────
  console.log('   [Other depts] Placeholder users:');
  const placeholders = [
    { dept: 'AI', hodF:'Tariq',   hodL:'Mehmood', hodEmail:'hod.ai@university.edu',
                   crdF:'Sara',    crdL:'Baig',    crdEmail:'coord.ai@university.edu' },
    { dept: 'DS', hodF:'Usman',   hodL:'Raza',    hodEmail:'hod.ds@university.edu',
                   crdF:'Hina',    crdL:'Malik',   crdEmail:'coord.ds@university.edu' },
    { dept: 'GM', hodF:'Khalid',  hodL:'Anwar',   hodEmail:'hod.gm@university.edu',
                   crdF:'Farrukh',crdL:'Siddiqui',crdEmail:'coord.gm@university.edu' },
    { dept: 'SE', hodF:'Nadia',   hodL:'Iqbal',   hodEmail:'hod.se@university.edu',
                   crdF:'Kamran', crdL:'Bukhari', crdEmail:'coord.se@university.edu' },
    { dept: 'IT', hodF:'Imran',   hodL:'Butt',    hodEmail:'hod.it@university.edu',
                   crdF:'Zainab', crdL:'Shah',    crdEmail:'coord.it@university.edu' },
    { dept: 'CY', hodF:'Hassan',  hodL:'Qureshi', hodEmail:'hod.cy@university.edu',
                   crdF:'Rabia',  crdL:'Mirza',   crdEmail:'coord.cy@university.edu' },
  ];
  const phUsers = {};
  for (const p of placeholders) {
    phUsers[`hod_${p.dept}`]  = await addUser(p.hodF, p.hodL, p.hodEmail,  'hod');
    phUsers[`crd_${p.dept}`]  = await addUser(p.crdF, p.crdL, p.crdEmail,  'coordinator');
  }
  console.log('      ✅ 12 placeholder HOD/Coordinator users created');

  // ── One Director for the whole university ──────────────────────────
  u.director = await addUser('Zahid', 'Director', 'director@university.edu', 'director');
  console.log('      ✅ Director created');

  // ── CS Teacher also acts as DEC: needs a teacher record for Bilal ──
  // Additional placeholder teachers for other depts
  const plTeachers = {};
  for (const dept of ['AI','DS','GM','SE','IT','CY']) {
    plTeachers[dept] = await addUser(
      `Teacher-${dept}`, 'Placeholder',
      `teacher.${dept.toLowerCase()}@university.edu`, 'teacher'
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP 7 — TEACHER RECORDS
  // ══════════════════════════════════════════════════════════════════
  console.log('\n🎓 Registering teacher profiles...');
  const teacherIds = {};

  async function addTeacher(userId, deptCode, designation) {
    const r = await insert(
      'INSERT INTO teacher (user_id, department_id, designation) VALUES ($1,$2,$3) RETURNING teacher_id',
      [userId, deptIds[deptCode], designation]
    );
    return r.teacher_id;
  }

  // CS real teachers
  teacherIds.sumaira = await addTeacher(u.sumaira, 'CS', 'Associate Professor');
  teacherIds.ayaz    = await addTeacher(u.ayaz,    'CS', 'Lecturer');
  teacherIds.amnah   = await addTeacher(u.amnah,   'CS', 'Assistant Professor');

  // Bilal & Ashfaq also need teacher records (DEC/HOD are faculty)
  teacherIds.bilal   = await addTeacher(u.bilal,   'CS', 'Associate Professor');
  teacherIds.ashfaq  = await addTeacher(u.ashfaq,  'CS', 'Professor');

  // Placeholder teachers for other depts
  for (const dept of ['AI','DS','GM','SE','IT','CY']) {
    teacherIds[`ph_${dept}`] = await addTeacher(plTeachers[dept], dept, 'Lecturer');
  }
  // HODs also need teacher records
  for (const p of placeholders) {
    teacherIds[`hod_t_${p.dept}`] = await addTeacher(phUsers[`hod_${p.dept}`], p.dept, 'Professor');
  }

  console.log(`   ✅ ${Object.keys(teacherIds).length} teacher profiles registered`);

  // ══════════════════════════════════════════════════════════════════
  // STEP 8 — HOD RECORDS
  // ══════════════════════════════════════════════════════════════════
  console.log('\n🏫 Registering HOD profiles...');

  // CS HOD: Dr. Ashfaq
  await client.query(
    `INSERT INTO hod (user_id, teacher_id, department_id, tenure_start)
     VALUES ($1,$2,$3,CURRENT_DATE)`,
    [u.ashfaq, teacherIds.ashfaq, deptIds['CS']]
  );
  console.log('   ✅ Dr. Ashfaq Hussain — CS HOD');

  // Placeholder HODs
  for (const p of placeholders) {
    await client.query(
      `INSERT INTO hod (user_id, teacher_id, department_id, tenure_start)
       VALUES ($1,$2,$3,CURRENT_DATE)`,
      [phUsers[`hod_${p.dept}`], teacherIds[`hod_t_${p.dept}`], deptIds[p.dept]]
    );
    console.log(`   ✅ Placeholder HOD — ${p.dept}`);
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP 9 — COORDINATOR RECORDS
  // ══════════════════════════════════════════════════════════════════
  console.log('\n📋 Registering Coordinator profiles...');

  const coordRow = await insert(
    'INSERT INTO coordinator (user_id, department_id) VALUES ($1,$2) RETURNING coordinator_id',
    [u.namra, deptIds['CS']]
  );
  const csCoordId = coordRow.coordinator_id;
  console.log('   ✅ Mam Namra Khan — CS Coordinator');

  for (const p of placeholders) {
    await client.query(
      'INSERT INTO coordinator (user_id, department_id) VALUES ($1,$2)',
      [phUsers[`crd_${p.dept}`], deptIds[p.dept]]
    );
    console.log(`   ✅ Placeholder Coordinator — ${p.dept}`);
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP 10 — DEC MEMBER
  // ══════════════════════════════════════════════════════════════════
  console.log('\n🔍 Registering DEC member...');
  await client.query(
    `INSERT INTO dec_member (user_id, teacher_id, department_id, role)
     VALUES ($1,$2,$3,'Chair')`,
    [u.bilal, teacherIds.bilal, deptIds['CS']]
  );
  console.log('   ✅ Dr. Bilal Tariq — CS DEC Chair');

  // ══════════════════════════════════════════════════════════════════
  // STEP 11 — DIRECTOR
  // ══════════════════════════════════════════════════════════════════
  console.log('\n🎯 Registering Director...');
  await client.query(
    `INSERT INTO director (user_id, designation) VALUES ($1,'Director Examinations')`,
    [u.director]
  );
  console.log('   ✅ Zahid Director');

  // ══════════════════════════════════════════════════════════════════
  // STEP 12 — STUDENTS
  // ══════════════════════════════════════════════════════════════════
  console.log('\n🎓 Registering student profiles...');
  const studentIds = {};
  const bscs2023Id = batchIds['CS'][2023];

  const studentData = [
    { key: 'shanawar',  uid: u.shanawar,  reg: '231593' },
    { key: 'manahil',   uid: u.manahil,   reg: '231594' },
    { key: 'sumaiyyah', uid: u.sumaiyyah, reg: '231595' },
  ];
  for (const s of studentData) {
    const r = await insert(
      `INSERT INTO student (user_id, registration_no, batch_id, current_semester, status)
       VALUES ($1,$2,$3,6,'Active') RETURNING student_id`,
      [s.uid, s.reg, bscs2023Id]
    );
    studentIds[s.key] = r.student_id;
    console.log(`   ✅ ${s.reg} registered`);
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP 13 — LABS (Lab-1 through Lab-12, shared, owned by CS dept)
  // ══════════════════════════════════════════════════════════════════
  console.log('\n🖥️  Creating labs...');
  const labConfig = [
    { name: 'Lab-1',  pcs: 45, cap: 42, net: '10.0.1.0/24',  status: 'Available'   },
    { name: 'Lab-2',  pcs: 40, cap: 38, net: '10.0.2.0/24',  status: 'Available'   },
    { name: 'Lab-3',  pcs: 40, cap: 38, net: '10.0.3.0/24',  status: 'Available'   },
    { name: 'Lab-4',  pcs: 35, cap: 32, net: '10.0.4.0/24',  status: 'Available'   },
    { name: 'Lab-5',  pcs: 50, cap: 48, net: '10.0.5.0/24',  status: 'Available'   },
    { name: 'Lab-6',  pcs: 50, cap: 48, net: '10.0.6.0/24',  status: 'Available'   },
    { name: 'Lab-7',  pcs: 30, cap: 28, net: '10.0.7.0/24',  status: 'Available'   },
    { name: 'Lab-8',  pcs: 30, cap: 28, net: '10.0.8.0/24',  status: 'Available'   },
    { name: 'Lab-9',  pcs: 60, cap: 55, net: '10.0.9.0/24',  status: 'Available'   },
    { name: 'Lab-10', pcs: 60, cap: 55, net: '10.0.10.0/24', status: 'Available'   },
    { name: 'Lab-11', pcs: 25, cap: 22, net: '10.0.11.0/24', status: 'Maintenance' },
    { name: 'Lab-12', pcs: 25, cap: 22, net: '10.0.12.0/24', status: 'Available'   },
  ];
  const labIds = {};
  for (const l of labConfig) {
    const r = await insert(
      `INSERT INTO lab (department_id, lab_name, total_pcs, capacity, network_range, status)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING lab_id`,
      [deptIds['CS'], l.name, l.pcs, l.cap, l.net, l.status]
    );
    labIds[l.name] = r.lab_id;
    console.log(`   ✅ ${l.name.padEnd(7)} | ${String(l.pcs).padStart(2)} PCs | Cap: ${l.cap} | ${l.net} | ${l.status}`);
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP 14 — COURSES
  // ══════════════════════════════════════════════════════════════════
  console.log('\n📖 Creating courses...');

  const courseIds = {};
  async function addCourse(progCode, code, title, credits, haLab, recSem) {
    const r = await insert(
      `INSERT INTO course (program_id, course_code, course_title, credit_hours, has_lab, course_type, recommended_semester)
       VALUES ($1,$2,$3,$4,$5,'Both',$6) RETURNING course_id`,
      [programIds[progCode], code, title, credits, haLab, recSem]
    );
    courseIds[code] = r.course_id;
    return r.course_id;
  }

  // CS 6th Semester Courses (the active semester)
  await addCourse('BSCS', 'CS601', 'Data Structures & Algorithms',    4, true,  6);
  await addCourse('BSCS', 'CS602', 'Operating Systems',               4, true,  6);
  await addCourse('BSCS', 'CS603', 'Computer Networks',               4, true,  6);
  await addCourse('BSCS', 'CS604', 'Database Systems',                4, true,  6);
  await addCourse('BSCS', 'CS605', 'Software Engineering',            3, false, 6);
  await addCourse('BSCS', 'CS606', 'Compiler Construction',           3, true,  6);
  await addCourse('BSCS', 'CS610', 'Mobile Application Development',  4, true,  6);
  await addCourse('BSCS', 'CS612', 'Cloud & Distributed Systems',     4, true,  6);

  // CS Other Semesters (for completeness)
  await addCourse('BSCS', 'CS101', 'Programming Fundamentals',        3, true,  1);
  await addCourse('BSCS', 'CS102', 'Discrete Mathematics',            3, false, 1);
  await addCourse('BSCS', 'CS201', 'Object Oriented Programming',     3, true,  2);
  await addCourse('BSCS', 'CS202', 'Digital Logic Design',            3, true,  2);
  await addCourse('BSCS', 'CS301', 'Data Structures',                 4, true,  3);
  await addCourse('BSCS', 'CS302', 'Computer Organization',           3, false, 3);
  await addCourse('BSCS', 'CS401', 'Theory of Automata',              3, false, 4);
  await addCourse('BSCS', 'CS402', 'Probability & Statistics',        3, false, 4);
  await addCourse('BSCS', 'CS501', 'Artificial Intelligence',         4, true,  5);
  await addCourse('BSCS', 'CS502', 'Computer Graphics',               3, true,  5);
  await addCourse('BSCS', 'CS701', 'Machine Learning',                4, true,  7);
  await addCourse('BSCS', 'CS702', 'Cloud Computing',                 3, true,  7);
  await addCourse('BSCS', 'CS801', 'Research Methods',                3, false, 8);
  await addCourse('BSCS', 'CS802', 'Final Year Project',              6, true,  8);

  // Common / General Education courses (attached to BSCS program; reuse for others later)
  await addCourse('BSCS', 'GEN001', 'English Composition',            3, false, 1);
  await addCourse('BSCS', 'GEN002', 'Islamic Studies',                2, false, 1);
  await addCourse('BSCS', 'GEN003', 'Pakistan Studies',               2, false, 2);
  await addCourse('BSCS', 'GEN004', 'Calculus & Analytical Geometry', 3, false, 1);

  // Placeholder courses for other departments (3 each)
  const otherDeptCourses = [
    { prog: 'BSAI', courses: [['AI101','Intro to AI',3,1],['AI201','Neural Networks',4,3],['AI301','Deep Learning',4,5]] },
    { prog: 'BSDS', courses: [['DS101','Intro to Data Science',3,1],['DS201','Big Data Analytics',4,3],['DS301','Data Visualization',3,5]] },
    { prog: 'BSGM', courses: [['GM101','Game Design Fundamentals',3,1],['GM201','Game Physics',4,3],['GM301','3D Graphics & Animation',4,5]] },
    { prog: 'BSSE', courses: [['SE101','Software Process Models',3,1],['SE201','Requirements Engineering',3,3],['SE301','Software Testing',3,5]] },
    { prog: 'BSIT', courses: [['IT101','Intro to IT',3,1],['IT201','System Administration',3,3],['IT301','Web Technologies',4,5]] },
    { prog: 'BSCY', courses: [['CY101','Intro to Cybersecurity',3,1],['CY201','Cryptography',4,3],['CY301','Ethical Hacking',4,5]] },
  ];
  for (const dept of otherDeptCourses) {
    for (const [code, title, credits, sem] of dept.courses) {
      await addCourse(dept.prog, code, title, credits, true, sem);
    }
  }

  console.log(`   ✅ ${Object.keys(courseIds).length} courses created`);

  // ══════════════════════════════════════════════════════════════════
  // STEP 15 — COURSE OFFERINGS (CS 6th Semester, Section 6A)
  // ══════════════════════════════════════════════════════════════════
  console.log('\n📑 Creating course offerings for CS Section 6A...');
  const section6A = sectionIds['CS']['6A'];
  const offeringIds = {};

  async function addOffering(sectionId, courseCode, teacherId, type = 'Lab') {
    const r = await insert(
      `INSERT INTO course_offering (section_id, course_id, term_id, teacher_id, offering_type)
       VALUES ($1,$2,$3,$4,$5) RETURNING course_offering_id`,
      [sectionId, courseIds[courseCode], termId, teacherId, type]
    );
    return r.course_offering_id;
  }

  offeringIds['CS601'] = await addOffering(section6A, 'CS601', teacherIds.sumaira);
  offeringIds['CS602'] = await addOffering(section6A, 'CS602', teacherIds.ayaz);
  offeringIds['CS603'] = await addOffering(section6A, 'CS603', teacherIds.amnah);
  offeringIds['CS604'] = await addOffering(section6A, 'CS604', teacherIds.sumaira);
  offeringIds['CS606'] = await addOffering(section6A, 'CS606', teacherIds.amnah);
  offeringIds['CS610'] = await addOffering(section6A, 'CS610', teacherIds.amnah);
  offeringIds['CS612'] = await addOffering(section6A, 'CS612', teacherIds.amnah);

  console.log('   ✅ 7 course offerings created (CS601-CS604, CS606, CS610, CS612 → Section 6A)');

  // ── Also create offerings for 6B and 6C (other sections, same teachers) ──
  const section6B = sectionIds['CS']['6B'];
  const section6C = sectionIds['CS']['6C'];
  await addOffering(section6B, 'CS601', teacherIds.sumaira);
  await addOffering(section6B, 'CS602', teacherIds.ayaz);
  await addOffering(section6B, 'CS603', teacherIds.amnah);
  await addOffering(section6C, 'CS601', teacherIds.sumaira);
  await addOffering(section6C, 'CS602', teacherIds.ayaz);
  await addOffering(section6C, 'CS603', teacherIds.amnah);
  console.log('   ✅ Also created offerings for Section 6B and 6C');

  // ══════════════════════════════════════════════════════════════════
  // STEP 16 — STUDENT ENROLLMENTS (3 students → all CS 6A offerings)
  // ══════════════════════════════════════════════════════════════════
  console.log('\n📝 Enrolling students...');
  const allEnrollOfferings = Object.values(offeringIds); // 6A offerings
  for (const [name, sid] of Object.entries(studentIds)) {
    for (const coid of allEnrollOfferings) {
      await client.query(
        `INSERT INTO enrollment (student_id, course_offering_id, status) VALUES ($1,$2,'Active')`,
        [sid, coid]
      );
    }
    console.log(`   ✅ ${name} enrolled in ${allEnrollOfferings.length} courses`);
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP 17 — DRAFT EXAMS (one per CS 6A offering)
  // ══════════════════════════════════════════════════════════════════
  console.log('\n📄 Creating draft exams...');
  const examMap = {
    'CS601': { tid: teacherIds.sumaira, dur: 120 },
    'CS602': { tid: teacherIds.ayaz,    dur: 90  },
    'CS603': { tid: teacherIds.amnah,   dur: 90  },
    'CS604': { tid: teacherIds.sumaira, dur: 120 },
    'CS606': { tid: teacherIds.amnah,   dur: 90  },
    'CS610': { tid: teacherIds.amnah,   dur: 90  },
    'CS612': { tid: teacherIds.amnah,   dur: 90  },
  };
  const examIds = {};
  for (const [code, cfg] of Object.entries(examMap)) {
    const r = await insert(
      `INSERT INTO exam (course_offering_id, teacher_id, exam_type, total_marks, duration, status)
       VALUES ($1,$2,'LabFinal',100,$3,'Draft') RETURNING exam_id`,
      [offeringIds[code], cfg.tid, cfg.dur]
    );
    examIds[code] = r.exam_id;
    console.log(`   ✅ Draft exam: ${code} (exam_id=${r.exam_id})`);
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP 17b — EXAM SCHEDULE & INVIGILATION ASSIGNMENTS
  // ══════════════════════════════════════════════════════════════════
  console.log('\n📅 Creating scheduled exam sessions...');
  await client.query('ALTER TABLE invigilator_assignment DROP CONSTRAINT IF EXISTS invigilator_assignment_assignment_status_check');
  const lab8Id = labIds['Lab-8'];
  const lab5Id = labIds['Lab-5'];

  const scheduleAssignments = [
    { code: 'CS603', tid: teacherIds.amnah,   lab: lab8Id, date: '2026-08-25', start: '09:00', end: '11:00' },
    { code: 'CS606', tid: teacherIds.amnah,   lab: lab8Id, date: '2026-08-26', start: '11:30', end: '13:30' },
    { code: 'CS601', tid: teacherIds.sumaira, lab: lab5Id, date: '2026-08-27', start: '09:00', end: '11:00' },
    { code: 'CS602', tid: teacherIds.ayaz,    lab: lab5Id, date: '2026-08-28', start: '14:00', end: '16:00' },
    { code: 'CS604', tid: teacherIds.sumaira, lab: lab8Id, date: '2026-08-29', start: '10:00', end: '12:00' },
  ];

  for (const s of scheduleAssignments) {
    const eid = examIds[s.code];
    const schedRow = await insert(
      `INSERT INTO exam_schedule (exam_id, lab_id, coordinator_id, exam_date, start_time, end_time, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'Scheduled') RETURNING schedule_id`,
      [eid, s.lab, csCoordId, s.date, s.start, s.end]
    );
    await client.query(
      `INSERT INTO invigilator_assignment (schedule_id, teacher_id, assignment_status)
       VALUES ($1, $2, 'Assigned')`,
      [schedRow.schedule_id, s.tid]
    );
    console.log(`   ✅ Scheduled: ${s.code} (Lab assigned, status='Scheduled')`);
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP 18 — BROADCAST ANNOUNCEMENT
  // ══════════════════════════════════════════════════════════════════
  console.log('\n📢 Adding welcome announcement...');
  await client.query(
    `INSERT INTO broadcast_announcement (sender_user_id, subject, message, audience_type)
     VALUES ($1,'Welcome to Spring 2026 Lab Exams','The PROCTR system is now active for Spring 2026. Lab exam schedules will be published shortly. Please ensure your exam papers are submitted for HOD review on time.','AllStudents')`,
    [u.namra]
  );
  console.log('   ✅ Announcement sent by Mam Namra');

  // ══════════════════════════════════════════════════════════════════
  // COMMIT
  // ══════════════════════════════════════════════════════════════════
  await client.query('COMMIT');
  console.log('\n🎉 ══════════════════════════════════════════════════════');
  console.log('   DATABASE SEEDED SUCCESSFULLY!');
  console.log('══════════════════════════════════════════════════════\n');

  // ── Summary table ─────────────────────────────────────────────────
  console.log('SUMMARY:');
  console.log(`  Departments : 7  (CS, AI, DS, GM, SE, IT, CY)`);
  console.log(`  Programs    : 7  (one BS per dept)`);
  console.log(`  Batches     : 28 (4 per dept)`);
  console.log(`  Sections    : 168 (24 per dept — all 8 sems × A/B/C)`);
  console.log(`  Labs        : 12 (Lab-1 to Lab-12, shared)`);
  console.log(`  Courses     : ${Object.keys(courseIds).length}`);
  console.log(`  Users       : 24 total\n`);

  console.log('LOGIN CREDENTIALS (password = password123):');
  console.log('─'.repeat(70));
  const creds = [
    ['student',     'Shanawar Raza',      'shanawar.raza@university.edu'],
    ['student',     'Manahil Ahmad',      'manahil.ahmad@university.edu'],
    ['student',     'Sumaiyyah Masood',   'sumaiyyah.masood@university.edu'],
    ['teacher',     'Dr. Sumaira Naz',    'sumaira.naz@university.edu'],
    ['teacher',     'Sir Ayaz Ahmed',     'ayaz.ahmed@university.edu'],
    ['teacher',     'Mam Amnah Riaz',     'amnah.riaz@university.edu'],
    ['dec',         'Dr. Bilal Tariq',    'bilal.tariq@university.edu'],
    ['hod',         'Dr. Ashfaq Hussain', 'ashfaq.hussain@university.edu'],
    ['coordinator', 'Mam Namra Khan',     'namra.khan@university.edu'],
    ['director',    'Zahid Director',     'director@university.edu'],
  ];
  for (const [role, name, email] of creds) {
    console.log(`  ${role.padEnd(12)} | ${name.padEnd(20)} | ${email}`);
  }
  console.log('─'.repeat(70));
  console.log('\nOther dept HODs: hod.ai/ds/gm/se/it/cy@university.edu');
  console.log('Other dept Coordinators: coord.ai/ds/gm/se/it/cy@university.edu');
  console.log('(All use password: password123)\n');

} catch (err) {
  await client.query('ROLLBACK');
  console.error('\n❌ ERROR — Rolled back all changes.');
  console.error('   Message:', err.message);
  console.error('   Detail:', err.detail || '');
  if (err.hint) console.error('   Hint:', err.hint);
} finally {
  client.release();
  process.exit(0);
}
