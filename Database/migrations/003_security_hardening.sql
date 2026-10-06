BEGIN;

CREATE TABLE IF NOT EXISTS security_session (
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

CREATE INDEX IF NOT EXISTS idx_security_session_user_active
  ON security_session(user_id, expires_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_security_session_expiry
  ON security_session(expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS security_audit_log (
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

CREATE INDEX IF NOT EXISTS idx_security_audit_user_created
  ON security_audit_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_audit_event_created
  ON security_audit_log(event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS authentication_attempt (
  attempt_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  identifier_hash CHAR(64) NOT NULL,
  ip_address       VARCHAR(45) NOT NULL,
  succeeded        BOOLEAN NOT NULL DEFAULT FALSE,
  attempted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_attempt_lookup
  ON authentication_attempt(identifier_hash, ip_address, attempted_at DESC);

CREATE TABLE IF NOT EXISTS exam_join_attempt (
  attempt_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  live_session_id  INT NOT NULL REFERENCES live_exam_session(live_session_id) ON DELETE CASCADE,
  student_id       INT NULL REFERENCES student(student_id) ON DELETE SET NULL,
  ip_address       VARCHAR(45) NOT NULL,
  succeeded        BOOLEAN NOT NULL DEFAULT FALSE,
  attempted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_join_attempt_lookup
  ON exam_join_attempt(live_session_id, student_id, ip_address, attempted_at DESC);

ALTER TABLE live_exam_session
  ADD COLUMN IF NOT EXISTS passcode_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS passcode_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS join_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ NULL;

COMMIT;
