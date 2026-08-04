// =====================================================================
// PROCTR — Seed Real Users Script
// Run from: d:\University\Curricular\6th sem\fyp\fyp_project\PROCTR\backend
//
// HOW TO RUN (in your terminal):
//   cd "d:\University\Curricular\6th sem\fyp\fyp_project\PROCTR\backend"
//   node seedUsers.mjs
//
// This will hash "password123" with bcrypt and insert all real users.
// =====================================================================

import bcrypt from 'bcryptjs';
import pool from './db.js';

const PASSWORD = 'password123';
const SALT_ROUNDS = 10;

async function seedUsers() {
  console.log('🔐 Generating bcrypt hash for password:', PASSWORD);
  const hash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);
  console.log('✅ Hash generated:', hash);
  console.log('');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── STEP 1: Insert new users ──────────────────────────────────────
    console.log('📥 Inserting users...');

    const usersToInsert = [
      // Students
      { first: 'Shanawar',  last: 'Khan',     email: 'shanawar.khan@university.edu',     type: 'student'     },
      { first: 'Manahil',   last: 'Akhtar',   email: 'manahil.akhtar@university.edu',    type: 'student'     },
      { first: 'Sumaiyyah', last: 'Siddiqui', email: 'sumaiyyah.siddiqui@university.edu',type: 'student'     },
      // Teachers
      { first: 'Sumaira',   last: 'Naz',      email: 'dr.sumaira.naz@university.edu',    type: 'teacher'     },
      { first: 'Ayaz',      last: 'Ahmed',    email: 'sir.ayaz.ahmed@university.edu',    type: 'teacher'     },
      { first: 'Amnah',     last: 'Riaz',     email: 'mam.amnah.riaz@university.edu',    type: 'teacher'     },
      // DEC
      { first: 'Bilal',     last: 'Tariq',    email: 'sir.bilal.tariq@university.edu',   type: 'dec'         },
      // HOD
      { first: 'Ashfaq',    last: 'Hussain',  email: 'dr.ashfaq.hussain@university.edu', type: 'hod'         },
      // Coordinator
      { first: 'Farhan',    last: 'Qureshi',  email: 'farhan.coordinator@university.edu',type: 'coordinator' },
      // Director
      { first: 'Noman',     last: 'Director', email: 'noman.director@university.edu',    type: 'director'    },
    ];

    const insertedIds = {};

    for (const u of usersToInsert) {
      // Skip if email already exists
      const existing = await client.query('SELECT user_id FROM users WHERE email = $1', [u.email]);
      if (existing.rows.length > 0) {
        console.log(`  ⚠️  Skipping (already exists): ${u.email}`);
        insertedIds[u.email] = existing.rows[0].user_id;
        continue;
      }
      const res = await client.query(
        'INSERT INTO users (first_name, last_name, email, password_hash, user_type, is_active) VALUES ($1,$2,$3,$4,$5,TRUE) RETURNING user_id',
        [u.first, u.last, u.email, hash, u.type]
      );
      insertedIds[u.email] = res.rows[0].user_id;
      console.log(`  ✅  ${u.type.padEnd(12)} ${u.first} ${u.last} → user_id=${insertedIds[u.email]}`);
    }

    // ── STEP 2: Get batch & dept IDs ─────────────────────────────────
    const batchRes = await client.query("SELECT batch_id FROM batch WHERE batch_name = 'BSCS-2023'");
    const deptRes  = await client.query("SELECT department_id FROM department WHERE department_code = 'CS'");
    const batch_id = batchRes.rows[0]?.batch_id;
    const dept_id  = deptRes.rows[0]?.department_id;

    if (!batch_id || !dept_id) {
      throw new Error('Batch or Department not found — make sure seed.sql was run first!');
    }

    // ── STEP 3: Insert students ───────────────────────────────────────
    console.log('\n📥 Registering students...');
    const studentData = [
      { email: 'shanawar.khan@university.edu',     reg: '231593' },
      { email: 'manahil.akhtar@university.edu',    reg: '231594' },
      { email: 'sumaiyyah.siddiqui@university.edu',reg: '231595' },
    ];
    const studentIds = {};
    for (const s of studentData) {
      const uid = insertedIds[s.email];
      const ex = await client.query('SELECT student_id FROM student WHERE user_id = $1', [uid]);
      if (ex.rows.length > 0) {
        await client.query('UPDATE student SET registration_no = $1 WHERE user_id = $2', [s.reg, uid]);
        console.log(`  ✅  Student registration_no updated: ${s.email} (reg: ${s.reg})`);
        studentIds[s.email] = ex.rows[0].student_id;
        continue;
      }
      const res = await client.query(
        'INSERT INTO student (user_id, registration_no, batch_id, current_semester, status) VALUES ($1,$2,$3,6,\'Active\') RETURNING student_id',
        [uid, s.reg, batch_id]
      );
      studentIds[s.email] = res.rows[0].student_id;
      console.log(`  ✅  Student registered: ${s.email} (reg: ${s.reg})`);
    }

    // ── STEP 4: Insert teachers ───────────────────────────────────────
    console.log('\n📥 Registering teachers...');
    const teacherData = [
      { email: 'dr.sumaira.naz@university.edu',  designation: 'Associate Professor' },
      { email: 'sir.ayaz.ahmed@university.edu',  designation: 'Lecturer'            },
      { email: 'mam.amnah.riaz@university.edu',  designation: 'Assistant Professor' },
      { email: 'sir.bilal.tariq@university.edu', designation: 'Associate Professor' },
      { email: 'dr.ashfaq.hussain@university.edu',designation: 'Professor'          },
    ];
    const teacherIds = {};
    for (const t of teacherData) {
      const uid = insertedIds[t.email];
      const ex = await client.query('SELECT teacher_id FROM teacher WHERE user_id = $1', [uid]);
      if (ex.rows.length > 0) {
        console.log(`  ⚠️  Teacher already registered: ${t.email}`);
        teacherIds[t.email] = ex.rows[0].teacher_id;
        continue;
      }
      const res = await client.query(
        'INSERT INTO teacher (user_id, department_id, designation) VALUES ($1,$2,$3) RETURNING teacher_id',
        [uid, dept_id, t.designation]
      );
      teacherIds[t.email] = res.rows[0].teacher_id;
      console.log(`  ✅  Teacher: ${t.email} → teacher_id=${teacherIds[t.email]}`);
    }

    // ── STEP 5: DEC member (Sir Bilal) ───────────────────────────────
    console.log('\n📥 Registering DEC member (Sir Bilal)...');
    const bilalUid = insertedIds['sir.bilal.tariq@university.edu'];
    const bilalTid = teacherIds['sir.bilal.tariq@university.edu'];
    const decEx = await client.query('SELECT dec_member_id FROM dec_member WHERE user_id = $1', [bilalUid]);
    if (decEx.rows.length === 0) {
      await client.query(
        "INSERT INTO dec_member (user_id, teacher_id, department_id, role) VALUES ($1,$2,$3,'Member')",
        [bilalUid, bilalTid, dept_id]
      );
      console.log('  ✅  Sir Bilal registered as DEC Member');
    } else {
      console.log('  ⚠️  Sir Bilal already a DEC member');
    }

    // ── STEP 6: HOD (Dr. Ashfaq) ─────────────────────────────────────
    console.log('\n📥 Registering HOD (Dr. Ashfaq)...');
    const ashfaqUid = insertedIds['dr.ashfaq.hussain@university.edu'];
    const ashfaqTid = teacherIds['dr.ashfaq.hussain@university.edu'];
    const hodEx = await client.query('SELECT hod_id FROM hod WHERE user_id = $1', [ashfaqUid]);
    if (hodEx.rows.length === 0) {
      await client.query(
        "INSERT INTO hod (user_id, teacher_id, department_id, tenure_start) VALUES ($1,$2,$3,CURRENT_DATE)",
        [ashfaqUid, ashfaqTid, dept_id]
      );
      console.log('  ✅  Dr. Ashfaq registered as HOD');
    } else {
      console.log('  ⚠️  HOD already registered');
    }

    // ── STEP 7: Coordinator (Farhan) ─────────────────────────────────
    console.log('\n📥 Registering Coordinator (Farhan)...');
    const farhanUid = insertedIds['farhan.coordinator@university.edu'];
    const coordEx = await client.query('SELECT coordinator_id FROM coordinator WHERE user_id = $1', [farhanUid]);
    if (coordEx.rows.length === 0) {
      await client.query(
        'INSERT INTO coordinator (user_id, department_id) VALUES ($1,$2)',
        [farhanUid, dept_id]
      );
      console.log('  ✅  Farhan registered as Coordinator');
    } else {
      console.log('  ⚠️  Coordinator already registered');
    }

    // ── STEP 8: Director (Noman) ──────────────────────────────────────
    console.log('\n📥 Registering Director (Noman)...');
    const nomanUid = insertedIds['noman.director@university.edu'];
    const dirEx = await client.query('SELECT director_id FROM director WHERE user_id = $1', [nomanUid]);
    if (dirEx.rows.length === 0) {
      await client.query(
        "INSERT INTO director (user_id, designation) VALUES ($1,'Director Examinations')",
        [nomanUid]
      );
      console.log('  ✅  Noman registered as Director');
    } else {
      console.log('  ⚠️  Director already registered');
    }

    // ── STEP 9: Enroll students in Section 6A ─────────────────────────
    console.log('\n📥 Enrolling students in Section 6A courses...');
    const sectionRes = await client.query("SELECT section_id FROM section WHERE section_name = '6A'");
    const section_6a = sectionRes.rows[0]?.section_id;
    const offeringsRes = await client.query('SELECT course_offering_id FROM course_offering WHERE section_id = $1', [section_6a]);
    const offerings = offeringsRes.rows.map(r => r.course_offering_id);

    for (const [email, sid] of Object.entries(studentIds)) {
      for (const coid of offerings) {
        const ex = await client.query(
          'SELECT enrollment_id FROM enrollment WHERE student_id=$1 AND course_offering_id=$2',
          [sid, coid]
        );
        if (ex.rows.length === 0) {
          await client.query(
            "INSERT INTO enrollment (student_id, course_offering_id, status) VALUES ($1,$2,'Active')",
            [sid, coid]
          );
        }
      }
      console.log(`  ✅  ${email} enrolled in ${offerings.length} courses`);
    }

    // ── STEP 10: Course offerings for new teachers (Section 6B) ──────
    console.log('\n📥 Creating course offerings for new teachers in Section 6B...');
    const termRes = await client.query("SELECT term_id FROM academic_term WHERE term_name = 'Spring 2026'");
    const term_id = termRes.rows[0]?.term_id;
    const section6BRes = await client.query("SELECT section_id FROM section WHERE section_name = '6B'");
    const section_6b = section6BRes.rows[0]?.section_id;

    const newOfferings = [
      { email: 'dr.sumaira.naz@university.edu',  course_code: 'CS301' },
      { email: 'sir.ayaz.ahmed@university.edu',  course_code: 'CS501' },
      { email: 'mam.amnah.riaz@university.edu',  course_code: 'CS601' },
    ];

    for (const o of newOfferings) {
      const courseRes = await client.query("SELECT course_id FROM course WHERE course_code = $1", [o.course_code]);
      const course_id = courseRes.rows[0]?.course_id;
      const teacher_id = teacherIds[o.email];
      const ex = await client.query(
        'SELECT course_offering_id FROM course_offering WHERE section_id=$1 AND course_id=$2 AND teacher_id=$3',
        [section_6b, course_id, teacher_id]
      );
      if (ex.rows.length === 0) {
        const res = await client.query(
          "INSERT INTO course_offering (section_id, course_id, term_id, teacher_id, offering_type) VALUES ($1,$2,$3,$4,'Lab') RETURNING course_offering_id",
          [section_6b, course_id, term_id, teacher_id]
        );
        // Create a Draft exam for this offering
        await client.query(
          "INSERT INTO exam (course_offering_id, teacher_id, exam_type, total_marks, duration, status) VALUES ($1,$2,'LabFinal',100,120,'Draft')",
          [res.rows[0].course_offering_id, teacher_id]
        );
        console.log(`  ✅  ${o.email} → ${o.course_code} Lab (Section 6B) + Draft exam`);
      } else {
        console.log(`  ⚠️  Already exists: ${o.email} → ${o.course_code}`);
      }
    }

    await client.query('COMMIT');
    console.log('\n🎉 All done! Database seeded successfully.\n');

    // ── Print login credentials ───────────────────────────────────────
    console.log('═══════════════════════════════════════════════════════');
    console.log('  LOGIN CREDENTIALS (all use password: password123)');
    console.log('═══════════════════════════════════════════════════════');
    const allUsers = [
      { name: 'Shanawar Khan',      email: 'shanawar.khan@university.edu',     role: 'student'      },
      { name: 'Manahil Akhtar',     email: 'manahil.akhtar@university.edu',    role: 'student'      },
      { name: 'Sumaiyyah Siddiqui', email: 'sumaiyyah.siddiqui@university.edu',role: 'student'      },
      { name: 'Dr. Sumaira Naz',    email: 'dr.sumaira.naz@university.edu',    role: 'teacher'      },
      { name: 'Sir Ayaz Ahmed',     email: 'sir.ayaz.ahmed@university.edu',    role: 'teacher'      },
      { name: 'Mam Amnah Riaz',     email: 'mam.amnah.riaz@university.edu',    role: 'teacher'      },
      { name: 'Sir Bilal Tariq',    email: 'sir.bilal.tariq@university.edu',   role: 'dec'          },
      { name: 'Dr. Ashfaq Hussain', email: 'dr.ashfaq.hussain@university.edu', role: 'hod'          },
      { name: 'Farhan Qureshi',     email: 'farhan.coordinator@university.edu',role: 'coordinator'  },
      { name: 'Noman Director',     email: 'noman.director@university.edu',    role: 'director'     },
    ];
    for (const u of allUsers) {
      console.log(`  ${u.role.padEnd(12)} | ${u.name.padEnd(20)} | ${u.email}`);
    }
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ ERROR — rolled back:', err.message);
  } finally {
    client.release();
    process.exit(0);
  }
}

seedUsers();
