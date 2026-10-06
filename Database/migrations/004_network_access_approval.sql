BEGIN;

CREATE TABLE IF NOT EXISTS network_access_request (
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

CREATE INDEX IF NOT EXISTS idx_network_access_request_session_status
    ON network_access_request(live_session_id, status, requested_at DESC);

COMMIT;
