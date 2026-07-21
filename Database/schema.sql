-- =====================================================================
-- PROCTR — Secure Lab Exam Management System
-- Final Relational Database Schema (PostgreSQL / Neon)
-- =====================================================================
-- Generated from: PROCTR_Final_Relational_Database_Schema.docx
--
-- NOTE ON "QuestionPaper / Rubric":
-- The source document lists these as one combined section with a single
-- set of columns. They have been implemented here as two separate
-- tables (question_paper, rubric) with identical structure, since an
-- exam needs to track a question paper file and a rubric file
-- independently. If a single shared table was actually intended,
-- collapse these two into one before running.
-- =====================================================================

DROP TABLE IF EXISTS notification_read CASCADE;
DROP TABLE IF EXISTS broadcast_announcement CASCADE;
DROP TABLE IF EXISTS user_notification CASCADE;
DROP TABLE IF EXISTS exam_result CASCADE;
DROP TABLE IF EXISTS moss_result CASCADE;
DROP TABLE IF EXISTS teacher_evaluation CASCADE;
DROP TABLE IF EXISTS ai_evaluation CASCADE;
DROP TABLE IF EXISTS student_submission CASCADE;
DROP TABLE IF EXISTS approval CASCADE;
DROP TABLE IF EXISTS duty_swap_request CASCADE;
DROP TABLE IF EXISTS invigilator_assignment CASCADE;
DROP TABLE IF EXISTS exam_schedule CASCADE;
DROP TABLE IF EXISTS rubric CASCADE;
DROP TABLE IF EXISTS question_paper CASCADE;
DROP TABLE IF EXISTS exam CASCADE;
DROP TABLE IF EXISTS lab CASCADE;
DROP TABLE IF EXISTS enrollment CASCADE;
DROP TABLE IF EXISTS course_offering CASCADE;
DROP TABLE IF EXISTS section CASCADE;
DROP TABLE IF EXISTS course CASCADE;
DROP TABLE IF EXISTS academic_term CASCADE;
DROP TABLE IF EXISTS batch CASCADE;
DROP TABLE IF EXISTS program CASCADE;
DROP TABLE IF EXISTS dec_member CASCADE;
DROP TABLE IF EXISTS director CASCADE;
DROP TABLE IF EXISTS coordinator CASCADE;
DROP TABLE IF EXISTS hod CASCADE;
DROP TABLE IF EXISTS teacher CASCADE;
DROP TABLE IF EXISTS student CASCADE;
DROP TABLE IF EXISTS department CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =====================================================================
-- 1. IDENTITY & ACCESS MANAGEMENT
-- =====================================================================

CREATE TABLE users (
    user_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    first_name     VARCHAR(100) NOT NULL,
    last_name      VARCHAR(100) NOT NULL,
    email          VARCHAR(255) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    user_type      VARCHAR(20) NOT NULL
                   CHECK (user_type IN ('student','teacher','hod','coordinator','director','dec')),
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    last_login_at  TIMESTAMP NULL
);

CREATE TABLE department (
    department_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    department_name  VARCHAR(150) NOT NULL,
    department_code  VARCHAR(20) NOT NULL UNIQUE
);

CREATE TABLE program (
    program_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    department_id    INT NOT NULL REFERENCES department(department_id),
    program_name     VARCHAR(150) NOT NULL,
    program_code     VARCHAR(20) NOT NULL UNIQUE,
    total_semesters  INT NOT NULL,
    degree_type      VARCHAR(10) NOT NULL CHECK (degree_type IN ('BS','MS','PhD'))
);

CREATE TABLE batch (
    batch_id                  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    program_id                INT NOT NULL REFERENCES program(program_id),
    batch_name                VARCHAR(100) NOT NULL,
    admission_year            INT NOT NULL,
    expected_graduation_year  INT NOT NULL
);

CREATE TABLE student (
    student_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id           INT NOT NULL REFERENCES users(user_id),
    registration_no   VARCHAR(50) NOT NULL UNIQUE,
    batch_id          INT NOT NULL REFERENCES batch(batch_id),
    current_semester  INT NOT NULL,
    status            VARCHAR(20) NOT NULL
                      CHECK (status IN ('Active','Frozen','Dropped','Graduated'))
);

CREATE TABLE teacher (
    teacher_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id        INT NOT NULL REFERENCES users(user_id),
    department_id  INT NOT NULL REFERENCES department(department_id),
    designation    VARCHAR(100)
);

CREATE TABLE hod (
    hod_id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id        INT NOT NULL REFERENCES users(user_id),
    teacher_id     INT NOT NULL REFERENCES teacher(teacher_id),
    department_id  INT NOT NULL REFERENCES department(department_id),
    tenure_start   DATE NOT NULL,
    tenure_end     DATE NULL
);

CREATE TABLE coordinator (
    coordinator_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES users(user_id),
    department_id   INT NOT NULL REFERENCES department(department_id)
);

CREATE TABLE director (
    director_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      INT NOT NULL REFERENCES users(user_id),
    designation  VARCHAR(100)
);

CREATE TABLE dec_member (
    dec_member_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id        INT NOT NULL REFERENCES users(user_id),
    teacher_id     INT NOT NULL REFERENCES teacher(teacher_id),
    department_id  INT NOT NULL REFERENCES department(department_id),
    role           VARCHAR(20) NOT NULL CHECK (role IN ('Chair','Member')),
    assigned_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    is_active      BOOLEAN NOT NULL DEFAULT TRUE
);

-- =====================================================================
-- 2. ACADEMIC FRAMEWORK & ENROLLMENT
-- =====================================================================

CREATE TABLE academic_term (
    term_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    term_name   VARCHAR(100) NOT NULL,
    semester    VARCHAR(10) NOT NULL CHECK (semester IN ('Spring','Fall')),
    year        INT NOT NULL,
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL
);

CREATE TABLE course (
    course_id             INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    program_id            INT NOT NULL REFERENCES program(program_id),
    course_code           VARCHAR(20) NOT NULL,
    course_title          VARCHAR(200) NOT NULL,
    credit_hours          INT NOT NULL,
    has_lab               BOOLEAN NOT NULL DEFAULT FALSE,
    course_type           VARCHAR(10) NOT NULL CHECK (course_type IN ('Theory','Lab','Both')),
    recommended_semester  INT,
    UNIQUE (program_id, course_code)
);

CREATE TABLE section (
    section_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    batch_id      INT NOT NULL REFERENCES batch(batch_id),
    section_name  VARCHAR(20) NOT NULL, -- e.g. "6A", "6B"
    max_students  INT NOT NULL,
    UNIQUE (batch_id, section_name)
);

CREATE TABLE course_offering (
    course_offering_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    section_id          INT NOT NULL REFERENCES section(section_id),
    course_id           INT NOT NULL REFERENCES course(course_id),
    term_id             INT NOT NULL REFERENCES academic_term(term_id),
    teacher_id          INT NOT NULL REFERENCES teacher(teacher_id),
    offering_type       VARCHAR(10) NOT NULL CHECK (offering_type IN ('Theory','Lab'))
);

CREATE TABLE enrollment (
    enrollment_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id          INT NOT NULL REFERENCES student(student_id),
    course_offering_id  INT NOT NULL REFERENCES course_offering(course_offering_id),
    enrollment_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    status              VARCHAR(20) NOT NULL CHECK (status IN ('Active','Dropped','Completed')),
    grade               VARCHAR(5) NULL,
    UNIQUE (student_id, course_offering_id)
);

-- =====================================================================
-- 3. EXAM ADMINISTRATION, SCHEDULING & LABS
-- =====================================================================

CREATE TABLE lab (
    lab_id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    department_id  INT NOT NULL REFERENCES department(department_id),
    lab_name       VARCHAR(100) NOT NULL,
    total_pcs      INT NOT NULL,
    capacity       INT NOT NULL,
    network_range  VARCHAR(50),
    status         VARCHAR(20) NOT NULL CHECK (status IN ('Available','InUse','Maintenance'))
);

CREATE TABLE exam (
    exam_id             INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    course_offering_id  INT NOT NULL REFERENCES course_offering(course_offering_id),
    teacher_id          INT NOT NULL REFERENCES teacher(teacher_id),
    exam_type           VARCHAR(20) NOT NULL CHECK (exam_type IN ('LabMid','LabFinal','LabPractical')),
    total_marks         INT NOT NULL,
    duration            INT NOT NULL, -- in minutes
    status              VARCHAR(20) NOT NULL DEFAULT 'Draft'
                        CHECK (status IN ('Draft','PendingHOD','Approved','Rejected')),
    hod_comment         TEXT NULL,
    submitted_at        TIMESTAMP NULL,
    approved_at         TIMESTAMP NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- See note at top of file regarding question_paper / rubric split.
CREATE TABLE question_paper (
    question_paper_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    exam_id             INT NOT NULL REFERENCES exam(exam_id),
    uploaded_by         INT NOT NULL REFERENCES teacher(teacher_id),
    file_path           VARCHAR(500) NOT NULL,
    version             INT NOT NULL DEFAULT 1,
    uploaded_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE rubric (
    rubric_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    exam_id      INT NOT NULL REFERENCES exam(exam_id),
    uploaded_by  INT NOT NULL REFERENCES teacher(teacher_id),
    file_path    VARCHAR(500) NOT NULL,
    version      INT NOT NULL DEFAULT 1,
    uploaded_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE exam_schedule (
    schedule_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    exam_id         INT NOT NULL REFERENCES exam(exam_id),
    lab_id          INT NOT NULL REFERENCES lab(lab_id),
    coordinator_id  INT NOT NULL REFERENCES coordinator(coordinator_id),
    exam_date       DATE NOT NULL,
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'Draft'
                    CHECK (status IN ('Draft','Published','Confirmed','Cancelled')),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    published_at    TIMESTAMP NULL,
    CHECK (end_time > start_time)
);

CREATE TABLE invigilator_assignment (
    invigilator_assignment_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    schedule_id                INT NOT NULL REFERENCES exam_schedule(schedule_id),
    teacher_id                 INT NOT NULL REFERENCES teacher(teacher_id),
    assigned_by                INT NOT NULL REFERENCES dec_member(dec_member_id),
    assignment_status          VARCHAR(20) NOT NULL DEFAULT 'Pending'
                               CHECK (assignment_status IN ('Pending','Confirmed','Swapped')),
    assigned_at                TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at                 TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE duty_swap_request (
    request_id                  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    invigilator_assignment_id   INT NOT NULL REFERENCES invigilator_assignment(invigilator_assignment_id),
    requester_teacher_id        INT NOT NULL REFERENCES teacher(teacher_id),
    replacement_teacher_id      INT NOT NULL REFERENCES teacher(teacher_id),
    replacement_status          VARCHAR(20) NOT NULL DEFAULT 'Pending'
                                CHECK (replacement_status IN ('Pending','Accepted','Declined')),
    dec_status                  VARCHAR(20) NOT NULL DEFAULT 'Pending'
                                CHECK (dec_status IN ('Pending','Approved','Rejected')),
    approved_by_user_id         INT NULL REFERENCES users(user_id),
    reason                      TEXT,
    requested_at                TIMESTAMP NOT NULL DEFAULT NOW(),
    processed_at                TIMESTAMP NULL
);

CREATE TABLE approval (
    approval_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    exam_id          INT NOT NULL REFERENCES exam(exam_id),
    user_id          INT NOT NULL REFERENCES users(user_id),
    approver_role    VARCHAR(20) NOT NULL CHECK (approver_role IN ('HOD','Director','DEC')),
    approval_status  VARCHAR(20) NOT NULL DEFAULT 'Pending'
                     CHECK (approval_status IN ('Pending','Approved','Rejected')),
    remarks          TEXT NULL,
    approved_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 4. STUDENT SUBMISSIONS & GRADING (Desktop Integration)
-- =====================================================================

CREATE TABLE student_submission (
    submission_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id       INT NOT NULL REFERENCES student(student_id),
    exam_id          INT NOT NULL REFERENCES exam(exam_id),
    submission_path  VARCHAR(500) NOT NULL,
    ip_address       VARCHAR(45) NOT NULL,  -- lab local IP, verifies correct subnet
    mac_address      VARCHAR(17) NOT NULL,  -- physical NIC address, prevents proxy submissions
    submitted_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, exam_id)
);

CREATE TABLE ai_evaluation (
    ai_evaluation_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    submission_id     INT NOT NULL REFERENCES student_submission(submission_id),
    ai_marks          DECIMAL(5,2) NOT NULL,
    ai_feedback       TEXT NULL,
    evaluation_status VARCHAR(20) NOT NULL DEFAULT 'Pending'
                      CHECK (evaluation_status IN ('Pending','Success','Failed')),
    evaluated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE teacher_evaluation (
    teacher_evaluation_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    submission_id          INT NOT NULL REFERENCES student_submission(submission_id),
    teacher_id             INT NOT NULL REFERENCES teacher(teacher_id),
    final_marks            DECIMAL(5,2) NOT NULL,
    teacher_feedback       TEXT NULL,
    reviewed_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE moss_result (
    moss_result_id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    submission_id          INT NOT NULL REFERENCES student_submission(submission_id),
    teacher_id             INT NOT NULL REFERENCES teacher(teacher_id),
    similarity_percentage  DECIMAL(5,2) NOT NULL,
    report_path            VARCHAR(500) NOT NULL,
    checked_at             TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE exam_result (
    result_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    exam_id         INT NOT NULL REFERENCES exam(exam_id),
    student_id      INT NOT NULL REFERENCES student(student_id),
    marks_obtained  DECIMAL(5,2) NOT NULL,
    grade           VARCHAR(5) NOT NULL,
    remarks         TEXT NULL,
    entered_by      INT NOT NULL REFERENCES teacher(teacher_id),
    entered_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (exam_id, student_id)
);

-- =====================================================================
-- 5. COMMUNICATION & SYSTEM AUDITS
-- =====================================================================

CREATE TABLE user_notification (
    notification_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id             INT NOT NULL REFERENCES users(user_id), -- recipient
    title               VARCHAR(200) NOT NULL,
    message             TEXT NOT NULL,
    notification_type   VARCHAR(20) NOT NULL
                        CHECK (notification_type IN ('Exam','Schedule','Approved','AI','MOSS','Invigilation')),
    is_read             BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE broadcast_announcement (
    announcement_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sender_user_id   INT NOT NULL REFERENCES users(user_id),
    subject          VARCHAR(200) NOT NULL,
    message          TEXT NOT NULL,
    audience_type    VARCHAR(20) NOT NULL
                     CHECK (audience_type IN ('AllStudents','Department','InvigilatorsOnly','AllTeachers','Specific')),
    target_user_id   INT NULL REFERENCES users(user_id),
    department_id    INT NULL REFERENCES department(department_id),
    created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    is_published     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE notification_read (
    notification_read_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    announcement_id        INT NOT NULL REFERENCES broadcast_announcement(announcement_id),
    user_id                 INT NOT NULL REFERENCES users(user_id),
    read_at                 TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (announcement_id, user_id)
);

-- =====================================================================
-- End of PROCTR schema.sql
-- =====================================================================
