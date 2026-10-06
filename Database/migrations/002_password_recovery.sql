BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ NULL;

CREATE TABLE IF NOT EXISTS password_reset_token (
  reset_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash    CHAR(64) NOT NULL UNIQUE,
  requested_ip  VARCHAR(45),
  expires_at    TIMESTAMPTZ NOT NULL,
  used_at       TIMESTAMPTZ NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_token_user_created
  ON password_reset_token(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_password_reset_token_expiry
  ON password_reset_token(expires_at)
  WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS password_recovery_audit (
  audit_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       INT NULL REFERENCES users(user_id) ON DELETE SET NULL,
  action        VARCHAR(40) NOT NULL,
  performed_by  INT NULL REFERENCES users(user_id) ON DELETE SET NULL,
  ip_address    VARCHAR(45),
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_recovery_audit_user_created
  ON password_recovery_audit(user_id, created_at DESC);

COMMIT;
