BEGIN;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_user_type_check;
ALTER TABLE users ADD CONSTRAINT users_user_type_check
  CHECK (user_type IN ('student','teacher','hod','coordinator','director','dec','admin'));

CREATE TABLE IF NOT EXISTS admin (
  admin_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         INT NOT NULL UNIQUE REFERENCES users(user_id),
  is_super_admin  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_setting (
  setting_key    VARCHAR(100) PRIMARY KEY,
  setting_value  JSONB NOT NULL,
  description    TEXT,
  updated_by     INT NULL REFERENCES users(user_id),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_lab_name ON lab (LOWER(lab_name));

INSERT INTO system_setting (setting_key, setting_value, description) VALUES
  ('default_lab_cidr', '"192.168.18.0/24"'::jsonb, 'Fallback network range when a lab has no range.'),
  ('allow_loopback_exam_access', 'false'::jsonb, 'Allow localhost clients during development.'),
  ('max_exam_extension_minutes', '20'::jsonb, 'Maximum time an invigilator may add.'),
  ('exam_warning_minutes', '5'::jsonb, 'When the low-time warning is shown.'),
  ('clipboard_threshold_chars', '300'::jsonb, 'Clipboard size that triggers a violation.'),
  ('focus_loss_seconds', '10'::jsonb, 'Focus-loss duration that triggers a violation.')
ON CONFLICT (setting_key) DO NOTHING;

COMMIT;
