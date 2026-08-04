-- =====================================================================
-- PROCTR — Seed Data
-- =====================================================================
-- Run this script after schema.sql to populate the database with
-- realistic mock data matching the React frontend's current states.
-- =====================================================================

-- Clean up any existing seed data
TRUNCATE TABLE notification_read, broadcast_announcement, user_notification, 
               exam_result, moss_result, teacher_evaluation, ai_evaluation, 
               student_submission, approval, duty_swap_request, 
               invigilator_assignment, exam_schedule, rubric, question_paper, 
               exam, lab, enrollment, course_offering, section, course, 
               academic_term, batch, program, dec_member, director, coordinator, 
               hod, teacher, student, department, users RESTART IDENTITY CASCADE;

-- 1. INSERT DEPARTMENTS
INSERT INTO department (department_name, department_code) VALUES
('Computer Science', 'CS'),
('Electrical Engineering', 'EE'),
('Software Engineering', 'SE');

-- 2. INSERT USERS (Passwords are hashed mock placeholder values)
-- UserTypes: student, teacher, hod, coordinator, director, dec
INSERT INTO users (first_name, last_name, email, password_hash, user_type) VALUES
-- Students
('Ali', 'Hassan', 'ali.hassan@university.edu', '$2b$10$EgZ1.5/G2d9xQY0P5k4Q.ejV3oO0xHwYpGSw1.V3uV0g2qfUuWnOq', 'student'),
('Sara', 'Malik', 'sara.malik@university.edu', '$2b$10$EgZ1.5/G2d9xQY0P5k4Q.ejV3oO0xHwYpGSw1.V3uV0g2qfUuWnOq', 'student'),
('Hamza', 'Raza', 'hamza.raza@university.edu', '$2b$10$EgZ1.5/G2d9xQY0P5k4Q.ejV3oO0xHwYpGSw1.V3uV0g2qfUuWnOq', 'student'),
('Nida', 'Fatima', 'nida.fatima@university.edu', '$2b$10$EgZ1.5/G2d9xQY0P5k4Q.ejV3oO0xHwYpGSw1.V3uV0g2qfUuWnOq', 'student'),
('Bilal', 'Cheema', 'bilal.cheema@university.edu', '$2b$10$EgZ1.5/G2d9xQY0P5k4Q.ejV3oO0xHwYpGSw1.V3uV0g2qfUuWnOq', 'student'),
('Zara', 'Khan', 'zara.khan@university.edu', '$2b$10$EgZ1.5/G2d9xQY0P5k4Q.ejV3oO0xHwYpGSw1.V3uV0g2qfUuWnOq', 'student'),

-- Teachers (Who also act as Invigilators)
('Sana', 'Mir', 'sana.mir@university.edu', '$2b$10$EgZ1.5/G2d9xQY0P5k4Q.ejV3oO0xHwYpGSw1.V3uV0g2qfUuWnOq', 'teacher'),
('Arif', 'Khan', 'arif.khan@university.edu', '$2b$10$EgZ1.5/G2d9xQY0P5k4Q.ejV3oO0xHwYpGSw1.V3uV0g2qfUuWnOq', 'teacher'),
('Malik', 'Ahmed', 'malik.ahmed@university.edu', '$2b$10$EgZ1.5/G2d9xQY0P5k4Q.ejV3oO0xHwYpGSw1.V3uV0g2qfUuWnOq', 'teacher'),
('Hira', 'Baig', 'hira.baig@university.edu', '$2b$10$EgZ1.5/G2d9xQY0P5k4Q.ejV3oO0xHwYpGSw1.V3uV0g2qfUuWnOq', 'teacher'),
('Usman', 'Raza', 'usman.raza@university.edu', '$2b$10$EgZ1.5/G2d9xQY0P5k4Q.ejV3oO0xHwYpGSw1.V3uV0g2qfUuWnOq', 'teacher'),
('Ayesha', 'Khan', 'ayesha.khan@university.edu', '$2b$10$EgZ1.5/G2d9xQY0P5k4Q.ejV3oO0xHwYpGSw1.V3uV0g2qfUuWnOq', 'teacher'),
('Tariq', 'Bashir', 'tariq.bashir@university.edu', '$2b$10$EgZ1.5/G2d9xQY0P5k4Q.ejV3oO0xHwYpGSw1.V3uV0g2qfUuWnOq', 'teacher'),
('Nadia', 'Iqbal', 'nadia.iqbal@university.edu', '$2b$10$EgZ1.5/G2d9xQY0P5k4Q.ejV3oO0xHwYpGSw1.V3uV0g2qfUuWnOq', 'teacher'),
('Sara', 'Ahmed', 'sara.ahmed@university.edu', '$2b$10$EgZ1.5/G2d9xQY0P5k4Q.ejV3oO0xHwYpGSw1.V3uV0g2qfUuWnOq', 'teacher'),
('Khalid', 'Raza', 'khalid.raza@university.edu', '$2b$10$EgZ1.5/G2d9xQY0P5k4Q.ejV3oO0xHwYpGSw1.V3uV0g2qfUuWnOq', 'teacher'),

-- HOD admin portal account
('Imran', 'HOD', 'imran.hod@university.edu', '$2b$10$EgZ1.5/G2d9xQY0P5k4Q.ejV3oO0xHwYpGSw1.V3uV0g2qfUuWnOq', 'hod'),

-- Coordinator admin portal account
('Zahid', 'Coordinator', 'zahid.coordinator@university.edu', '$2b$10$EgZ1.5/G2d9xQY0P5k4Q.ejV3oO0xHwYpGSw1.V3uV0g2qfUuWnOq', 'coordinator'),

-- Director admin portal account
('Kamran', 'Director', 'kamran.director@university.edu', '$2b$10$EgZ1.5/G2d9xQY0P5k4Q.ejV3oO0xHwYpGSw1.V3uV0g2qfUuWnOq', 'director'),

-- DEC Chair admin portal account
('Haris', 'DEC', 'haris.dec@university.edu', '$2b$10$EgZ1.5/G2d9xQY0P5k4Q.ejV3oO0xHwYpGSw1.V3uV0g2qfUuWnOq', 'dec');

-- 3. INSERT ACADEMIC PROGRAMS
INSERT INTO program (department_id, program_name, program_code, total_semesters, degree_type) VALUES
((SELECT department_id FROM department WHERE department_code = 'CS'), 'BS Computer Science', 'BSCS', 8, 'BS');

-- 4. INSERT BATCHES
INSERT INTO batch (program_id, batch_name, admission_year, expected_graduation_year) VALUES
((SELECT program_id FROM program WHERE program_code = 'BSCS'), 'BSCS-2023', 2023, 2027);

-- 5. INSERT STUDENTS
INSERT INTO student (user_id, registration_no, batch_id, current_semester, status) VALUES
((SELECT user_id FROM users WHERE email = 'ali.hassan@university.edu'), '211591', (SELECT batch_id FROM batch WHERE batch_name = 'BSCS-2023'), 6, 'Active'),
((SELECT user_id FROM users WHERE email = 'sara.malik@university.edu'), '211592', (SELECT batch_id FROM batch WHERE batch_name = 'BSCS-2023'), 6, 'Active'),
((SELECT user_id FROM users WHERE email = 'hamza.raza@university.edu'), '211593', (SELECT batch_id FROM batch WHERE batch_name = 'BSCS-2023'), 6, 'Active'),
((SELECT user_id FROM users WHERE email = 'nida.fatima@university.edu'), '211594', (SELECT batch_id FROM batch WHERE batch_name = 'BSCS-2023'), 6, 'Active'),
((SELECT user_id FROM users WHERE email = 'bilal.cheema@university.edu'), '211595', (SELECT batch_id FROM batch WHERE batch_name = 'BSCS-2023'), 6, 'Frozen'),
((SELECT user_id FROM users WHERE email = 'zara.khan@university.edu'), '211596', (SELECT batch_id FROM batch WHERE batch_name = 'BSCS-2023'), 6, 'Active');

-- 6. INSERT TEACHERS
INSERT INTO teacher (user_id, department_id, designation) VALUES
((SELECT user_id FROM users WHERE email = 'sana.mir@university.edu'), (SELECT department_id FROM department WHERE department_code = 'CS'), 'Assistant Professor'),
((SELECT user_id FROM users WHERE email = 'arif.khan@university.edu'), (SELECT department_id FROM department WHERE department_code = 'CS'), 'Professor'),
((SELECT user_id FROM users WHERE email = 'malik.ahmed@university.edu'), (SELECT department_id FROM department WHERE department_code = 'CS'), 'Professor'),
((SELECT user_id FROM users WHERE email = 'hira.baig@university.edu'), (SELECT department_id FROM department WHERE department_code = 'CS'), 'Assistant Professor'),
((SELECT user_id FROM users WHERE email = 'usman.raza@university.edu'), (SELECT department_id FROM department WHERE department_code = 'CS'), 'Lecturer'),
((SELECT user_id FROM users WHERE email = 'ayesha.khan@university.edu'), (SELECT department_id FROM department WHERE department_code = 'CS'), 'Assistant Professor'),
((SELECT user_id FROM users WHERE email = 'tariq.bashir@university.edu'), (SELECT department_id FROM department WHERE department_code = 'CS'), 'Professor'),
((SELECT user_id FROM users WHERE email = 'nadia.iqbal@university.edu'), (SELECT department_id FROM department WHERE department_code = 'CS'), 'Assistant Professor'),
((SELECT user_id FROM users WHERE email = 'sara.ahmed@university.edu'), (SELECT department_id FROM department WHERE department_code = 'CS'), 'Assistant Professor'),
((SELECT user_id FROM users WHERE email = 'khalid.raza@university.edu'), (SELECT department_id FROM department WHERE department_code = 'CS'), 'Professor');

-- 7. INSERT HOD
INSERT INTO hod (user_id, teacher_id, department_id, tenure_start) VALUES
((SELECT user_id FROM users WHERE email = 'imran.hod@university.edu'), (SELECT teacher_id FROM teacher WHERE user_id = (SELECT user_id FROM users WHERE email = 'arif.khan@university.edu')), (SELECT department_id FROM department WHERE department_code = 'CS'), '2025-01-01');

-- 8. INSERT COORDINATOR
INSERT INTO coordinator (user_id, department_id) VALUES
((SELECT user_id FROM users WHERE email = 'zahid.coordinator@university.edu'), (SELECT department_id FROM department WHERE department_code = 'CS'));

-- 9. INSERT DIRECTOR
INSERT INTO director (user_id, designation) VALUES
((SELECT user_id FROM users WHERE email = 'kamran.director@university.edu'), 'Director Examinations');

-- 10. INSERT DEC MEMBERS
INSERT INTO dec_member (user_id, teacher_id, department_id, role) VALUES
((SELECT user_id FROM users WHERE email = 'haris.dec@university.edu'), (SELECT teacher_id FROM teacher WHERE user_id = (SELECT user_id FROM users WHERE email = 'malik.ahmed@university.edu')), (SELECT department_id FROM department WHERE department_code = 'CS'), 'Chair');

-- 11. INSERT ACADEMIC TERMS
INSERT INTO academic_term (term_name, semester, year, start_date, end_date) VALUES
('Spring 2026', 'Spring', 2026, '2026-02-01', '2026-06-30');

-- 12. INSERT COURSES
INSERT INTO course (program_id, course_code, course_title, credit_hours, has_lab, course_type, recommended_semester) VALUES
((SELECT program_id FROM program WHERE program_code = 'BSCS'), 'CS-301', 'Data Structures', 4, TRUE, 'Both', 3),
((SELECT program_id FROM program WHERE program_code = 'BSCS'), 'CS-402', 'Operating Systems', 4, TRUE, 'Both', 4),
((SELECT program_id FROM program WHERE program_code = 'BSCS'), 'CS-415', 'Computer Networks', 4, TRUE, 'Both', 5),
((SELECT program_id FROM program WHERE program_code = 'BSCS'), 'CS-501', 'Artificial Intelligence', 4, TRUE, 'Both', 6),
((SELECT program_id FROM program WHERE program_code = 'BSCS'), 'CS-312', 'Database Systems', 4, TRUE, 'Both', 4),
((SELECT program_id FROM program WHERE program_code = 'BSCS'), 'CS-211', 'Object Oriented Programming', 4, TRUE, 'Both', 2);

-- 13. INSERT SECTIONS
INSERT INTO section (batch_id, section_name, max_students) VALUES
((SELECT batch_id FROM batch WHERE batch_name = 'BSCS-2023'), '6A', 40),
((SELECT batch_id FROM batch WHERE batch_name = 'BSCS-2023'), '6B', 40);

-- 14. INSERT COURSE OFFERINGS (Lnk section + courses to teachers for the current Spring 2026 term)
INSERT INTO course_offering (section_id, course_id, term_id, teacher_id, offering_type) VALUES
-- CS-301 Labs (Data Structures)
((SELECT section_id FROM section WHERE section_name = '6A'), (SELECT course_id FROM course WHERE course_code = 'CS-301'), (SELECT term_id FROM academic_term WHERE term_name = 'Spring 2026'), (SELECT teacher_id FROM teacher WHERE user_id = (SELECT user_id FROM users WHERE email = 'sana.mir@university.edu')), 'Lab'),
((SELECT section_id FROM section WHERE section_name = '6B'), (SELECT course_id FROM course WHERE course_code = 'CS-301'), (SELECT term_id FROM academic_term WHERE term_name = 'Spring 2026'), (SELECT teacher_id FROM teacher WHERE user_id = (SELECT user_id FROM users WHERE email = 'arif.khan@university.edu')), 'Lab'),

-- CS-402 Labs (Operating Systems)
((SELECT section_id FROM section WHERE section_name = '6A'), (SELECT course_id FROM course WHERE course_code = 'CS-402'), (SELECT term_id FROM academic_term WHERE term_name = 'Spring 2026'), (SELECT teacher_id FROM teacher WHERE user_id = (SELECT user_id FROM users WHERE email = 'malik.ahmed@university.edu')), 'Lab'),

-- CS-415 Labs (Computer Networks)
((SELECT section_id FROM section WHERE section_name = '6A'), (SELECT course_id FROM course WHERE course_code = 'CS-415'), (SELECT term_id FROM academic_term WHERE term_name = 'Spring 2026'), (SELECT teacher_id FROM teacher WHERE user_id = (SELECT user_id FROM users WHERE email = 'hira.baig@university.edu')), 'Lab'),

-- CS-501 Labs (AI Practical)
((SELECT section_id FROM section WHERE section_name = '6A'), (SELECT course_id FROM course WHERE course_code = 'CS-501'), (SELECT term_id FROM academic_term WHERE term_name = 'Spring 2026'), (SELECT teacher_id FROM teacher WHERE user_id = (SELECT user_id FROM users WHERE email = 'usman.raza@university.edu')), 'Lab');

-- 15. INSERT ENROLLMENTS
INSERT INTO enrollment (student_id, course_offering_id, status) VALUES
-- Enrolling Ali Hassan in DS Lab, OS Lab, Networks Lab, AI Lab
((SELECT student_id FROM student WHERE user_id = (SELECT user_id FROM users WHERE email = 'ali.hassan@university.edu')), 1, 'Active'),
((SELECT student_id FROM student WHERE user_id = (SELECT user_id FROM users WHERE email = 'ali.hassan@university.edu')), 3, 'Active'),
((SELECT student_id FROM student WHERE user_id = (SELECT user_id FROM users WHERE email = 'ali.hassan@university.edu')), 4, 'Active'),
((SELECT student_id FROM student WHERE user_id = (SELECT user_id FROM users WHERE email = 'ali.hassan@university.edu')), 5, 'Active'),

-- Enrolling Sara Malik in DS Lab, OS Lab, Networks Lab
((SELECT student_id FROM student WHERE user_id = (SELECT user_id FROM users WHERE email = 'sara.malik@university.edu')), 1, 'Active'),
((SELECT student_id FROM student WHERE user_id = (SELECT user_id FROM users WHERE email = 'sara.malik@university.edu')), 3, 'Active'),
((SELECT student_id FROM student WHERE user_id = (SELECT user_id FROM users WHERE email = 'sara.malik@university.edu')), 4, 'Active');

-- 16. INSERT LABS
INSERT INTO lab (department_id, lab_name, total_pcs, capacity, network_range, status) VALUES
((SELECT department_id FROM department WHERE department_code = 'CS'), 'Lab-1', 42, 40, '192.168.1.0/24', 'Available'),
((SELECT department_id FROM department WHERE department_code = 'CS'), 'Lab-2', 36, 35, '192.168.2.0/24', 'Available'),
((SELECT department_id FROM department WHERE department_code = 'CS'), 'Lab-3', 40, 38, '192.168.3.0/24', 'InUse'),
((SELECT department_id FROM department WHERE department_code = 'CS'), 'Lab-4', 32, 30, '192.168.4.0/24', 'Available'),
((SELECT department_id FROM department WHERE department_code = 'CS'), 'Lab-5', 44, 42, '192.168.5.0/24', 'Maintenance');

-- 17. INSERT MOCK EXAMS
INSERT INTO exam (course_offering_id, teacher_id, exam_type, total_marks, duration, status, hod_comment, submitted_at, approved_at) VALUES
-- Approved Exams
(1, (SELECT teacher_id FROM teacher WHERE user_id = (SELECT user_id FROM users WHERE email = 'sana.mir@university.edu')), 'LabFinal', 100, 90, 'Approved', '—', '2026-06-20 10:00:00', '2026-06-21 14:00:00'),
(2, (SELECT teacher_id FROM teacher WHERE user_id = (SELECT user_id FROM users WHERE email = 'arif.khan@university.edu')), 'LabFinal', 100, 90, 'Approved', '—', '2026-06-20 10:00:00', '2026-06-21 14:00:00'),
(3, (SELECT teacher_id FROM teacher WHERE user_id = (SELECT user_id FROM users WHERE email = 'malik.ahmed@university.edu')), 'LabFinal', 100, 90, 'Approved', '—', '2026-06-19 09:00:00', '2026-06-19 11:30:00'),
-- Pending Review
(4, (SELECT teacher_id FROM teacher WHERE user_id = (SELECT user_id FROM users WHERE email = 'hira.baig@university.edu')), 'LabFinal', 100, 120, 'PendingHOD', NULL, '2026-06-22 15:00:00', NULL),
-- Draft
(5, (SELECT teacher_id FROM teacher WHERE user_id = (SELECT user_id FROM users WHERE email = 'usman.raza@university.edu')), 'LabFinal', 100, 90, 'Draft', NULL, NULL, NULL);

-- 18. INSERT EXAM SCHEDULES
INSERT INTO exam_schedule (exam_id, lab_id, coordinator_id, exam_date, start_time, end_time, status, published_at) VALUES
(1, (SELECT lab_id FROM lab WHERE lab_name = 'Lab-3'), 1, '2026-07-02', '09:00:00', '10:30:00', 'Confirmed', '2026-06-25 12:00:00'),
(2, (SELECT lab_id FROM lab WHERE lab_name = 'Lab-1'), 1, '2026-07-02', '11:00:00', '12:30:00', 'Confirmed', '2026-06-25 12:00:00'),
(3, (SELECT lab_id FROM lab WHERE lab_name = 'Lab-1'), 1, '2026-07-08', '11:00:00', '12:30:00', 'Confirmed', '2026-06-25 12:00:00'),
(4, (SELECT lab_id FROM lab WHERE lab_name = 'Lab-2'), 1, '2026-07-15', '14:00:00', '16:00:00', 'Published', '2026-06-25 12:00:00');

-- 19. INSERT INVIGILATOR ASSIGNMENTS
INSERT INTO invigilator_assignment (schedule_id, teacher_id, assigned_by, assignment_status) VALUES
(1, (SELECT teacher_id FROM teacher WHERE user_id = (SELECT user_id FROM users WHERE email = 'sana.mir@university.edu')), 1, 'Confirmed'),
(2, (SELECT teacher_id FROM teacher WHERE user_id = (SELECT user_id FROM users WHERE email = 'arif.khan@university.edu')), 1, 'Confirmed'),
(3, (SELECT teacher_id FROM teacher WHERE user_id = (SELECT user_id FROM users WHERE email = 'malik.ahmed@university.edu')), 1, 'Confirmed'),
(4, (SELECT teacher_id FROM teacher WHERE user_id = (SELECT user_id FROM users WHERE email = 'hira.baig@university.edu')), 1, 'Pending');

-- 20. INSERT BROADCAST ANNOUNCEMENTS
INSERT INTO broadcast_announcement (sender_user_id, subject, message, audience_type, target_user_id, department_id) VALUES
((SELECT user_id FROM users WHERE email = 'zahid.coordinator@university.edu'), 'July Exam Schedule Published', 'The final datesheet for BSCS 6th Semester lab exams has been published. Please review your schedules under the date sheet section.', 'AllStudents', NULL, NULL);

-- =====================================================================
-- End of PROCTR seed.sql
-- =====================================================================
