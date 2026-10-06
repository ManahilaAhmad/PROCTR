import pool from './db.js';

const departmentCode = process.env.TEST_DEPARTMENT_CODE || 'CS';
const courseCode = process.env.TEST_COURSE_CODE || 'CS699';
const courseTitle = process.env.TEST_COURSE_TITLE || 'PROCTR Starter Code Test Lab';
const teacherEmail = process.env.TEST_TEACHER_EMAIL || null;
const requestedRegistrations = (process.env.TEST_STUDENT_REGISTRATIONS || '231593,231594,231595')
  .split(',').map(value => value.trim()).filter(Boolean);

const client = await pool.connect();
try {
  await client.query('BEGIN');

  const context = await client.query(`
    SELECT d.department_id, p.program_id, b.batch_id, s.section_id, at.term_id
    FROM department d
    JOIN program p ON p.department_id=d.department_id
    JOIN batch b ON b.program_id=p.program_id
    JOIN section s ON s.batch_id=b.batch_id
    CROSS JOIN LATERAL (SELECT term_id FROM academic_term ORDER BY end_date DESC LIMIT 1) at
    WHERE d.department_code=$1
    ORDER BY (p.program_code='BSCS') DESC, b.admission_year DESC, (s.section_name='6A') DESC
    LIMIT 1
  `, [departmentCode]);
  if (!context.rowCount) throw new Error(`No complete program/batch/section/term context exists for department ${departmentCode}.`);
  const ctx = context.rows[0];

  const teacher = await client.query(`
    SELECT t.teacher_id, u.email, u.first_name || ' ' || u.last_name AS name
    FROM teacher t JOIN users u ON u.user_id=t.user_id
    WHERE t.department_id=$1 AND u.is_active=TRUE AND ($2::text IS NULL OR LOWER(u.email)=LOWER($2))
    ORDER BY CASE WHEN $2::text IS NOT NULL AND LOWER(u.email)=LOWER($2) THEN 0 ELSE 1 END, t.teacher_id
    LIMIT 1
  `, [ctx.department_id, teacherEmail]);
  if (!teacher.rowCount) throw new Error(`No active teacher was found in ${departmentCode}${teacherEmail ? ` with email ${teacherEmail}` : ''}.`);

  const course = await client.query(`
    INSERT INTO course (program_id,course_code,course_title,credit_hours,has_lab,course_type,recommended_semester)
    VALUES ($1,$2,$3,3,TRUE,'Lab',6)
    ON CONFLICT (program_id,course_code) DO UPDATE SET course_title=EXCLUDED.course_title,has_lab=TRUE,course_type='Lab'
    RETURNING course_id
  `, [ctx.program_id, courseCode, courseTitle]);

  const offering = await client.query(`
    INSERT INTO course_offering (section_id,course_id,term_id,teacher_id,offering_type)
    VALUES ($1,$2,$3,$4,'Lab')
    ON CONFLICT (section_id,course_id,term_id,offering_type) DO UPDATE SET teacher_id=EXCLUDED.teacher_id
    RETURNING course_offering_id
  `, [ctx.section_id, course.rows[0].course_id, ctx.term_id, teacher.rows[0].teacher_id]);

  const students = await client.query(`
    SELECT st.student_id,st.registration_no,u.email
    FROM student st
    JOIN users u ON u.user_id=st.user_id
    JOIN batch b ON b.batch_id=st.batch_id
    JOIN program p ON p.program_id=b.program_id
    WHERE p.department_id=$1 AND st.status='Active' AND st.registration_no=ANY($2::text[])
    ORDER BY st.registration_no
  `, [ctx.department_id, requestedRegistrations]);
  if (!students.rowCount) throw new Error(`None of the requested active students were found in ${departmentCode}.`);

  for (const student of students.rows) {
    await client.query(`
      INSERT INTO enrollment (student_id,course_offering_id,status)
      VALUES ($1,$2,'Active')
      ON CONFLICT (student_id,course_offering_id) DO UPDATE SET status='Active'
    `, [student.student_id, offering.rows[0].course_offering_id]);
  }

  await client.query('COMMIT');
  console.log(`Test course ready: ${courseCode} - ${courseTitle}`);
  console.log(`Department: ${departmentCode}`);
  console.log(`Teacher: ${teacher.rows[0].name} <${teacher.rows[0].email}>`);
  console.log(`Course offering ID: ${offering.rows[0].course_offering_id}`);
  console.log(`Enrolled students: ${students.rows.map(s => `${s.registration_no} <${s.email}>`).join(', ')}`);
  const missing = requestedRegistrations.filter(reg => !students.rows.some(s => s.registration_no === reg));
  if (missing.length) console.warn(`Not found and not enrolled: ${missing.join(', ')}`);
} catch (error) {
  await client.query('ROLLBACK');
  console.error(`Could not create the test course: ${error.message}`);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
