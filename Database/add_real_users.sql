-- =====================================================================
-- PROCTR — Add Real Users Seed
-- Run this ONCE against your live Neon database.
-- This script APPENDS new users without truncating existing data.
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- STEP 1 — Add new USER accounts
-- 
-- LOGIN CREDENTIALS FOR ALL USERS BELOW:
--   Password to type on website: password123
--   The hash below is bcrypt('password123', 10 rounds)
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO users (first_name, last_name, email, password_hash, user_type, is_active) VALUES
-- Students
('Shanawar',   'Khan',    'shanawar.khan@university.edu',    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'student',     TRUE),
('Manahil',    'Akhtar',  'manahil.akhtar@university.edu',   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'student',     TRUE),
('Sumaiyyah',  'Siddiqui','sumaiyyah.siddiqui@university.edu','$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.','student',     TRUE),

-- Teachers
('Sumaira',    'Naz',     'dr.sumaira.naz@university.edu',   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'teacher',     TRUE),
('Ayaz',       'Ahmed',   'sir.ayaz.ahmed@university.edu',   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'teacher',     TRUE),
('Amnah',      'Riaz',    'mam.amnah.riaz@university.edu',   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'teacher',     TRUE),

-- DEC Member
('Bilal',      'Tariq',   'sir.bilal.tariq@university.edu',  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'dec',         TRUE),

-- HOD
('Ashfaq',     'Hussain', 'dr.ashfaq.hussain@university.edu','$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'hod',         TRUE),

-- Coordinator + Director extras
('Farhan',     'Qureshi', 'farhan.coordinator@university.edu','$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.','coordinator', TRUE),
('Noman',      'Director','noman.director@university.edu',   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'director',    TRUE);



-- ─────────────────────────────────────────────────────────────────────
-- STEP 2 — Register STUDENTS
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO student (user_id, registration_no, batch_id, current_semester, status)
SELECT
    u.user_id,
    reg.reg_no,
    (SELECT batch_id FROM batch WHERE batch_name = 'BSCS-2023'),
    6,
    'Active'
FROM (VALUES
    ('shanawar.khan@university.edu',     '2023-CS-201'),
    ('manahil.akhtar@university.edu',    '2023-CS-202'),
    ('sumaiyyah.siddiqui@university.edu','2023-CS-203')
) AS reg(email, reg_no)
JOIN users u ON u.email = reg.email;


-- ─────────────────────────────────────────────────────────────────────
-- STEP 3 — Register TEACHERS
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO teacher (user_id, department_id, designation)
SELECT u.user_id, d.department_id, t.designation
FROM (VALUES
    ('dr.sumaira.naz@university.edu',  'Associate Professor'),
    ('sir.ayaz.ahmed@university.edu',  'Lecturer'),
    ('mam.amnah.riaz@university.edu',  'Assistant Professor')
) AS t(email, designation)
JOIN users u ON u.email = t.email
CROSS JOIN (SELECT department_id FROM department WHERE department_code = 'CS') d;


-- ─────────────────────────────────────────────────────────────────────
-- STEP 4 — Register DEC Member (Sir Bilal)
-- ─────────────────────────────────────────────────────────────────────

-- 4a. Sir Bilal needs a teacher record first
INSERT INTO teacher (user_id, department_id, designation)
SELECT u.user_id, d.department_id, 'Associate Professor'
FROM users u
CROSS JOIN (SELECT department_id FROM department WHERE department_code = 'CS') d
WHERE u.email = 'sir.bilal.tariq@university.edu';

-- 4b. DEC member record
INSERT INTO dec_member (user_id, teacher_id, department_id, role)
SELECT
    u.user_id,
    t.teacher_id,
    (SELECT department_id FROM department WHERE department_code = 'CS'),
    'Member'
FROM users u
JOIN teacher t ON t.user_id = u.user_id
WHERE u.email = 'sir.bilal.tariq@university.edu';


-- ─────────────────────────────────────────────────────────────────────
-- STEP 5 — Register HOD (Dr. Ashfaq)
-- ─────────────────────────────────────────────────────────────────────

-- 5a. Dr. Ashfaq teacher record
INSERT INTO teacher (user_id, department_id, designation)
SELECT u.user_id, d.department_id, 'Professor'
FROM users u
CROSS JOIN (SELECT department_id FROM department WHERE department_code = 'CS') d
WHERE u.email = 'dr.ashfaq.hussain@university.edu';

-- 5b. HOD record
INSERT INTO hod (user_id, teacher_id, department_id, tenure_start)
SELECT
    u.user_id,
    t.teacher_id,
    (SELECT department_id FROM department WHERE department_code = 'CS'),
    CURRENT_DATE
FROM users u
JOIN teacher t ON t.user_id = u.user_id
WHERE u.email = 'dr.ashfaq.hussain@university.edu';


-- ─────────────────────────────────────────────────────────────────────
-- STEP 6 — Register Coordinator and Director
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO coordinator (user_id, department_id)
SELECT u.user_id, (SELECT department_id FROM department WHERE department_code = 'CS')
FROM users u WHERE u.email = 'farhan.coordinator@university.edu';

INSERT INTO director (user_id, designation)
SELECT u.user_id, 'Director Examinations'
FROM users u WHERE u.email = 'noman.director@university.edu';


-- ─────────────────────────────────────────────────────────────────────
-- STEP 7 — Enroll new students in existing Section 6A course offerings
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO enrollment (student_id, course_offering_id, status)
SELECT s.student_id, co.course_offering_id, 'Active'
FROM student s
JOIN users u ON u.user_id = s.user_id
JOIN section sec ON sec.section_name = '6A'
JOIN course_offering co ON co.section_id = sec.section_id
WHERE u.email IN (
    'shanawar.khan@university.edu',
    'manahil.akhtar@university.edu',
    'sumaiyyah.siddiqui@university.edu'
);


-- ─────────────────────────────────────────────────────────────────────
-- STEP 8 — Create course offerings for new teachers in Section 6B
-- ─────────────────────────────────────────────────────────────────────

-- Dr. Sumaira: CS-312 Database Systems Lab, Section 6B
INSERT INTO course_offering (section_id, course_id, term_id, teacher_id, offering_type)
SELECT
    (SELECT section_id FROM section WHERE section_name = '6B'),
    (SELECT course_id FROM course WHERE course_code = 'CS-312'),
    (SELECT term_id FROM academic_term WHERE term_name = 'Spring 2026'),
    (SELECT teacher_id FROM teacher WHERE user_id = (SELECT user_id FROM users WHERE email = 'dr.sumaira.naz@university.edu')),
    'Lab';

-- Sir Ayaz: CS-501 AI Lab, Section 6B
INSERT INTO course_offering (section_id, course_id, term_id, teacher_id, offering_type)
SELECT
    (SELECT section_id FROM section WHERE section_name = '6B'),
    (SELECT course_id FROM course WHERE course_code = 'CS-501'),
    (SELECT term_id FROM academic_term WHERE term_name = 'Spring 2026'),
    (SELECT teacher_id FROM teacher WHERE user_id = (SELECT user_id FROM users WHERE email = 'sir.ayaz.ahmed@university.edu')),
    'Lab';

-- Mam Amnah: CS-415 Computer Networks Lab, Section 6B
INSERT INTO course_offering (section_id, course_id, term_id, teacher_id, offering_type)
SELECT
    (SELECT section_id FROM section WHERE section_name = '6B'),
    (SELECT course_id FROM course WHERE course_code = 'CS-415'),
    (SELECT term_id FROM academic_term WHERE term_name = 'Spring 2026'),
    (SELECT teacher_id FROM teacher WHERE user_id = (SELECT user_id FROM users WHERE email = 'mam.amnah.riaz@university.edu')),
    'Lab';


-- ─────────────────────────────────────────────────────────────────────
-- STEP 9 — Create Draft exams for each new teacher
-- ─────────────────────────────────────────────────────────────────────

-- Dr. Sumaira's DB exam
INSERT INTO exam (course_offering_id, exam_type, total_marks, duration, status)
SELECT co.course_offering_id, 'LabFinal', 100, 120, 'Draft'
FROM course_offering co
JOIN teacher t ON t.teacher_id = co.teacher_id
JOIN users u ON u.user_id = t.user_id
WHERE u.email = 'dr.sumaira.naz@university.edu';

-- Sir Ayaz's AI exam
INSERT INTO exam (course_offering_id, exam_type, total_marks, duration, status)
SELECT co.course_offering_id, 'LabFinal', 100, 120, 'Draft'
FROM course_offering co
JOIN teacher t ON t.teacher_id = co.teacher_id
JOIN users u ON u.user_id = t.user_id
WHERE u.email = 'sir.ayaz.ahmed@university.edu';

-- Mam Amnah's Networks exam
INSERT INTO exam (course_offering_id, exam_type, total_marks, duration, status)
SELECT co.course_offering_id, 'LabFinal', 100, 120, 'Draft'
FROM course_offering co
JOIN teacher t ON t.teacher_id = co.teacher_id
JOIN users u ON u.user_id = t.user_id
WHERE u.email = 'mam.amnah.riaz@university.edu';


-- ─────────────────────────────────────────────────────────────────────
-- VERIFICATION — Run this SELECT to confirm all users are inserted
-- ─────────────────────────────────────────────────────────────────────

SELECT user_id, first_name, last_name, email, user_type
FROM users
WHERE email LIKE '%shanawar%' OR email LIKE '%manahil%' OR email LIKE '%sumaiyyah%'
   OR email LIKE '%sumaira%' OR email LIKE '%ayaz%' OR email LIKE '%amnah%'
   OR email LIKE '%bilal.tariq%' OR email LIKE '%ashfaq%'
   OR email LIKE '%farhan.coordinator%' OR email LIKE '%noman.director%'
ORDER BY user_type, first_name;
