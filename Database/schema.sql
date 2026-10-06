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

DROP TABLE IF EXISTS exam_file CASCADE;
DROP TABLE IF EXISTS password_recovery_audit CASCADE;
DROP TABLE IF EXISTS password_reset_token CASCADE;
DROP TABLE IF EXISTS system_setting CASCADE;
DROP TABLE IF EXISTS admin CASCADE;
DROP TABLE IF EXISTS proctoring_event CASCADE;
DROP TABLE IF EXISTS exam_whitelist CASCADE;
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
DROP TABLE IF EXISTS coordinator_exam_timetable CASCADE;
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
                   CHECK (user_type IN ('student','teacher','hod','coordinator','director','dec','admin')),
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    last_login_at  TIMESTAMP NULL,
    session_version INTEGER NOT NULL DEFAULT 0,
    password_changed_at TIMESTAMPTZ NULL
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

CREATE TABLE admin (
    admin_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         INT NOT NULL UNIQUE REFERENCES users(user_id),
    is_super_admin  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE password_reset_token (
    reset_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash    CHAR(64) NOT NULL UNIQUE,
    requested_ip  VARCHAR(45),
    expires_at    TIMESTAMPTZ NOT NULL,
    used_at       TIMESTAMPTZ NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_reset_token_user_created
    ON password_reset_token(user_id, created_at DESC);

CREATE INDEX idx_password_reset_token_expiry
    ON password_reset_token(expires_at) WHERE used_at IS NULL;

CREATE TABLE password_recovery_audit (
    audit_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       INT NULL REFERENCES users(user_id) ON DELETE SET NULL,
    action        VARCHAR(40) NOT NULL,
    performed_by  INT NULL REFERENCES users(user_id) ON DELETE SET NULL,
    ip_address    VARCHAR(45),
    metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_recovery_audit_user_created
    ON password_recovery_audit(user_id, created_at DESC);

CREATE TABLE system_setting (
    setting_key    VARCHAR(100) PRIMARY KEY,
    setting_value  JSONB NOT NULL,
    description    TEXT,
    updated_by     INT NULL REFERENCES users(user_id),
    updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO system_setting (setting_key, setting_value, description) VALUES
('default_lab_cidr', '"192.168.18.0/24"'::jsonb, 'Fallback network range when a lab has no range.'),
('allow_loopback_exam_access', 'false'::jsonb, 'Allow localhost clients during development.'),
('max_exam_extension_minutes', '20'::jsonb, 'Maximum time an invigilator may add.'),
('exam_warning_minutes', '5'::jsonb, 'When the low-time warning is shown.'),
('clipboard_threshold_chars', '300'::jsonb, 'Clipboard size that triggers a violation.'),
('focus_loss_seconds', '10'::jsonb, 'Focus-loss duration that triggers a violation.');

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

ALTER TABLE student ADD COLUMN section_id INT;
ALTER TABLE student ADD CONSTRAINT student_section_fk FOREIGN KEY (section_id) REFERENCES section(section_id);

CREATE TABLE course_offering (
    course_offering_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    section_id          INT NOT NULL REFERENCES section(section_id),
    course_id           INT NOT NULL REFERENCES course(course_id),
    term_id             INT NOT NULL REFERENCES academic_term(term_id),
    teacher_id          INT NOT NULL REFERENCES teacher(teacher_id),
    offering_type       VARCHAR(10) NOT NULL CHECK (offering_type IN ('Theory','Lab')),
    CONSTRAINT unique_section_course_offering UNIQUE (section_id, course_id, term_id, offering_type)
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

CREATE UNIQUE INDEX unique_lab_name ON lab (LOWER(lab_name));

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
    CHECK (end_time > start_time),
    CONSTRAINT unique_exam_schedule_exam UNIQUE (exam_id)
);

CREATE TABLE coordinator_exam_timetable (
    timetable_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    course_offering_id INT NOT NULL REFERENCES course_offering(course_offering_id),
    exam_type          VARCHAR(20) NOT NULL CHECK (exam_type IN ('LabMid','LabFinal','LabPractical')),
    lab_id             INT NOT NULL REFERENCES lab(lab_id),
    coordinator_id     INT NOT NULL REFERENCES coordinator(coordinator_id),
    exam_date          DATE NOT NULL,
    start_time         TIME NOT NULL,
    end_time           TIME NOT NULL,
    status             VARCHAR(20) NOT NULL DEFAULT 'Published'
                       CHECK (status IN ('Published','Cancelled')),
    linked_exam_id     INT REFERENCES exam(exam_id),
    linked_schedule_id INT REFERENCES exam_schedule(schedule_id),
    created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (end_time > start_time),
    UNIQUE (linked_exam_id),
    UNIQUE (linked_schedule_id)
);

CREATE UNIQUE INDEX unique_published_coordinator_exam_timetable
    ON coordinator_exam_timetable (course_offering_id, exam_type)
    WHERE status = 'Published';

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
    submission_manifest JSONB, -- Cloudinary asset metadata; null for legacy disk submissions
    submission_attempt_id BIGINT,
    ip_address       VARCHAR(45) NOT NULL,  -- lab local IP, verifies correct subnet
    mac_address      VARCHAR(17) NOT NULL,  -- physical NIC address, prevents proxy submissions
    submitted_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, exam_id)
);

CREATE TABLE submission_attempt (
    request_id UUID PRIMARY KEY,
    attempt_id BIGSERIAL UNIQUE NOT NULL,
    student_id INT NOT NULL REFERENCES student(student_id),
    exam_id INT NOT NULL REFERENCES exam(exam_id),
    content_hash TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','complete','superseded')),
    submission_id INT,
    manifest JSONB,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE submission_access_session (
    token_hash TEXT PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
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
                        CHECK (notification_type IN ('Exam','Schedule','Approved','AI','MOSS','Invigilation','System')),
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
-- 6. PROCTORING, MONITORING & EXAM FILES (Desktop Integration)
-- =====================================================================

-- Whitelist of allowed domains per exam (used by the local proxy)
CREATE TABLE exam_whitelist (
    whitelist_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    exam_id         INT NOT NULL REFERENCES exam(exam_id),
    domain          VARCHAR(255) NOT NULL,
    added_by        INT NOT NULL REFERENCES teacher(teacher_id),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (exam_id, domain)
);

-- Real-time proctoring events logged by the desktop client
CREATE TABLE proctoring_event (
    event_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    exam_id         INT NOT NULL REFERENCES exam(exam_id),
    student_id      INT NOT NULL REFERENCES student(student_id),
    event_type      VARCHAR(30) NOT NULL
                    CHECK (event_type IN (
                      'USB_INSERT','BLOCKED_SITE','UNTRUSTED_FILE',
                      'APP_CLOSE_ATTEMPT','APP_KILLED',
                      'FUZZY_LOW','FUZZY_MEDIUM','FUZZY_HIGH'
                    )),
    severity        VARCHAR(10) NOT NULL CHECK (severity IN ('Hard','Low','Medium','High')),
    description     TEXT NOT NULL,
    metadata        JSONB NULL,  -- extra detail: domain, file name, fuzzy scores, etc.
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Multi-file attachments per exam (question paper, rubric, starter files, Word template)
CREATE TABLE exam_file (
    exam_file_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    exam_id         INT NOT NULL REFERENCES exam(exam_id),
    file_type       VARCHAR(20) NOT NULL
                    CHECK (file_type IN ('question_paper','rubric','starter_file','word_template')),
    file_path       VARCHAR(500) NOT NULL,
    original_name   VARCHAR(255) NOT NULL,
    uploaded_by     INT NOT NULL REFERENCES teacher(teacher_id),
    uploaded_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Extend exam table for desktop integration
ALTER TABLE exam ADD COLUMN IF NOT EXISTS word_template_path VARCHAR(500) NULL;
ALTER TABLE exam ADD COLUMN IF NOT EXISTS starter_files_path VARCHAR(500) NULL;

-- Revocable authenticated sessions and security event history.
CREATE TABLE live_exam_session (
    live_session_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    exam_id              INT NOT NULL REFERENCES exam(exam_id),
    session_code         VARCHAR(50) NOT NULL UNIQUE,
    passcode             VARCHAR(10) NOT NULL,
    passcode_hash        VARCHAR(255),
    passcode_expires_at  TIMESTAMPTZ,
    invigilator_id       INT NULL REFERENCES teacher(teacher_id),
    is_paper_revealed    BOOLEAN NOT NULL DEFAULT FALSE,
    is_timer_started     BOOLEAN NOT NULL DEFAULT FALSE,
    duration_minutes     INT NOT NULL DEFAULT 90,
    timer_start_time     TIMESTAMPTZ NULL,
    status               VARCHAR(30) NOT NULL DEFAULT 'CREATED',
    join_attempts        INT NOT NULL DEFAULT 0,
    locked_until         TIMESTAMPTZ NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE security_session (
    session_id       UUID PRIMARY KEY,
    user_id          INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash       CHAR(64) NOT NULL UNIQUE,
    client_type      VARCHAR(20) NOT NULL CHECK (client_type IN ('web','desktop')),
    user_agent       VARCHAR(500),
    created_ip       VARCHAR(45),
    last_ip          VARCHAR(45),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at       TIMESTAMPTZ NOT NULL,
    revoked_at       TIMESTAMPTZ NULL,
    revoke_reason    VARCHAR(100) NULL
);

CREATE TABLE security_audit_log (
    audit_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id          INT NULL REFERENCES users(user_id) ON DELETE SET NULL,
    session_id       UUID NULL,
    event_type       VARCHAR(80) NOT NULL,
    outcome          VARCHAR(20) NOT NULL CHECK (outcome IN ('SUCCESS','DENIED','FAILURE','INFO')),
    ip_address       VARCHAR(45),
    user_agent       VARCHAR(500),
    method           VARCHAR(10),
    request_path     VARCHAR(1000),
    object_type      VARCHAR(80),
    object_id        VARCHAR(255),
    metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE authentication_attempt (
    attempt_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    identifier_hash CHAR(64) NOT NULL,
    ip_address       VARCHAR(45) NOT NULL,
    succeeded        BOOLEAN NOT NULL DEFAULT FALSE,
    attempted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE exam_join_attempt (
    attempt_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    live_session_id  INT NOT NULL REFERENCES live_exam_session(live_session_id) ON DELETE CASCADE,
    student_id       INT NULL REFERENCES student(student_id) ON DELETE SET NULL,
    ip_address       VARCHAR(45) NOT NULL,
    succeeded        BOOLEAN NOT NULL DEFAULT FALSE,
    attempted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE network_access_request (
    request_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    live_session_id     INT NOT NULL REFERENCES live_exam_session(live_session_id) ON DELETE CASCADE,
    student_id          INT NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
    requested_ip        VARCHAR(45) NOT NULL,
    allowed_network     VARCHAR(255),
    lab_name            VARCHAR(255),
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING','APPROVED','REJECTED','EXPIRED','REVOKED')),
    student_reason      VARCHAR(500),
    decision_reason     VARCHAR(500),
    decided_by          INT NULL REFERENCES users(user_id) ON DELETE SET NULL,
    requested_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at          TIMESTAMPTZ NULL,
    expires_at          TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
    UNIQUE (live_session_id, student_id)
);

CREATE INDEX idx_network_access_request_session_status
    ON network_access_request(live_session_id, status, requested_at DESC);

-- =====================================================================
-- End of PROCTR schema.sql
-- =====================================================================
