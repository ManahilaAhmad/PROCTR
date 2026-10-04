import { isIP } from 'node:net';
import pool from '../db.js';

const LAB_STATUSES = new Set(['Available', 'InUse', 'Maintenance']);
const SETTING_DEFINITIONS = {
  default_lab_cidr: { type: 'cidr', description: 'Fallback network range when a lab has no range.' },
  allow_loopback_exam_access: { type: 'boolean', description: 'Allow localhost clients during development.' },
  max_exam_extension_minutes: { type: 'integer', min: 0, max: 120, description: 'Maximum time an invigilator may add.' },
  exam_warning_minutes: { type: 'integer', min: 1, max: 60, description: 'When the low-time warning is shown.' },
  clipboard_threshold_chars: { type: 'integer', min: 1, max: 10000, description: 'Clipboard size that triggers a violation.' },
  focus_loss_seconds: { type: 'integer', min: 1, max: 600, description: 'Focus-loss duration that triggers a violation.' },
};

function validCidr(value) {
  if (typeof value !== 'string') return false;
  const [address, prefixText] = value.trim().split('/');
  const prefix = Number(prefixText);
  return isIP(address) === 4 && Number.isInteger(prefix) && prefix >= 0 && prefix <= 32;
}

function validateSetting(key, value) {
  const definition = SETTING_DEFINITIONS[key];
  if (!definition) return 'Unknown setting.';
  if (definition.type === 'cidr' && !validCidr(value)) return 'Enter a valid IPv4 CIDR range.';
  if (definition.type === 'boolean' && typeof value !== 'boolean') return 'Value must be true or false.';
  if (definition.type === 'integer' && (!Number.isInteger(value) || value < definition.min || value > definition.max)) return `Value must be a whole number from ${definition.min} to ${definition.max}.`;
  return null;
}

export const getOverview = async (req, res) => {
  try {
    const result = await pool.query(`SELECT (SELECT COUNT(*)::int FROM users) AS users, (SELECT COUNT(*)::int FROM users WHERE is_active=TRUE) AS active_users, (SELECT COUNT(*)::int FROM lab) AS labs, (SELECT COUNT(*)::int FROM exam) AS exams`);
    const liveResult = await pool.query(`SELECT COUNT(*)::int AS active_sessions FROM live_exam_session WHERE status='ACTIVE'`).catch(() => ({ rows: [{ active_sessions: 0 }] }));
    res.json({ status: 'success', overview: { ...result.rows[0], active_sessions: liveResult.rows[0].active_sessions } });
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to load admin overview.' });
  }
};

export const getLabs = async (req, res) => {
  try {
    const [labs, departments] = await Promise.all([
      pool.query(`SELECT l.*, d.department_name, d.department_code FROM lab l JOIN department d ON d.department_id=l.department_id ORDER BY l.lab_name`),
      pool.query(`SELECT department_id, department_name, department_code FROM department ORDER BY department_name`),
    ]);
    res.json({ status: 'success', labs: labs.rows, departments: departments.rows });
  } catch (error) {
    console.error('Admin labs error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to load labs.' });
  }
};

function validateLab(body) {
  const totalPcs = Number(body.total_pcs);
  const capacity = Number(body.capacity);
  if (!body.department_id || !String(body.lab_name || '').trim()) return 'Department and lab name are required.';
  if (!Number.isInteger(totalPcs) || totalPcs < 1) return 'Total PCs must be a positive whole number.';
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > totalPcs) return 'Capacity must be between 1 and total PCs.';
  if (!validCidr(body.network_range)) return 'Network range must use IPv4 CIDR notation, for example 192.168.18.0/24.';
  if (!LAB_STATUSES.has(body.status)) return 'Invalid lab status.';
  return null;
}

export const createLab = async (req, res) => {
  const validationError = validateLab(req.body);
  if (validationError) return res.status(400).json({ status: 'error', message: validationError });
  const { department_id, lab_name, total_pcs, capacity, network_range, status } = req.body;
  try {
    const result = await pool.query(`INSERT INTO lab (department_id,lab_name,total_pcs,capacity,network_range,status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [department_id, lab_name.trim(), Number(total_pcs), Number(capacity), network_range.trim(), status]);
    res.status(201).json({ status: 'success', message: 'Lab created successfully.', lab: result.rows[0] });
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 500).json({ status: 'error', message: error.code === '23505' ? 'A lab with this name already exists.' : 'Failed to create lab.' });
  }
};

export const updateLab = async (req, res) => {
  const validationError = validateLab(req.body);
  if (validationError) return res.status(400).json({ status: 'error', message: validationError });
  const { department_id, lab_name, total_pcs, capacity, network_range, status } = req.body;
  try {
    const result = await pool.query(`UPDATE lab SET department_id=$1,lab_name=$2,total_pcs=$3,capacity=$4,network_range=$5,status=$6 WHERE lab_id=$7 RETURNING *`, [department_id, lab_name.trim(), Number(total_pcs), Number(capacity), network_range.trim(), status, req.params.labId]);
    if (!result.rows.length) return res.status(404).json({ status: 'error', message: 'Lab not found.' });
    res.json({ status: 'success', message: 'Lab updated successfully.', lab: result.rows[0] });
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 500).json({ status: 'error', message: error.code === '23505' ? 'A lab with this name already exists.' : 'Failed to update lab.' });
  }
};

export const deleteLab = async (req, res) => {
  try {
    const used = await pool.query('SELECT 1 FROM exam_schedule WHERE lab_id=$1 LIMIT 1', [req.params.labId]);
    if (used.rows.length) return res.status(409).json({ status: 'error', message: 'This lab is used by an exam schedule. Set it to Maintenance instead.' });
    const result = await pool.query('DELETE FROM lab WHERE lab_id=$1 RETURNING lab_id', [req.params.labId]);
    if (!result.rows.length) return res.status(404).json({ status: 'error', message: 'Lab not found.' });
    res.json({ status: 'success', message: 'Lab deleted successfully.' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to delete lab.' });
  }
};

export const getSettings = async (req, res) => {
  try {
    const result = await pool.query('SELECT setting_key,setting_value,description,updated_at FROM system_setting ORDER BY setting_key');
    res.json({ status: 'success', settings: result.rows, definitions: SETTING_DEFINITIONS });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to load system settings.' });
  }
};

export const updateSettings = async (req, res) => {
  const settings = req.body.settings;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return res.status(400).json({ status: 'error', message: 'A settings object is required.' });
  for (const [key, value] of Object.entries(settings)) {
    const validationError = validateSetting(key, value);
    if (validationError) return res.status(400).json({ status: 'error', message: `${key}: ${validationError}` });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [key, value] of Object.entries(settings)) {
      await client.query(`INSERT INTO system_setting (setting_key,setting_value,description,updated_by,updated_at) VALUES ($1,$2::jsonb,$3,$4,NOW()) ON CONFLICT (setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,description=EXCLUDED.description,updated_by=EXCLUDED.updated_by,updated_at=NOW()`, [key, JSON.stringify(value), SETTING_DEFINITIONS[key].description, req.sessionUser.sub]);
    }
    await client.query('COMMIT');
    res.json({ status: 'success', message: 'System settings updated successfully.' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ status: 'error', message: 'Failed to update system settings.' });
  } finally {
    client.release();
  }
};

export const getUsers = async (req, res) => {
  try {
    const result = await pool.query(`SELECT user_id,first_name,last_name,email,user_type,is_active,created_at,last_login_at FROM users ORDER BY user_type,first_name,last_name`);
    res.json({ status: 'success', users: result.rows });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to load users.' });
  }
};

export const setUserActive = async (req, res) => {
  const isActive = req.body.is_active;
  if (typeof isActive !== 'boolean') return res.status(400).json({ status: 'error', message: 'is_active must be true or false.' });
  if (Number(req.params.userId) === Number(req.sessionUser.sub) && !isActive) return res.status(400).json({ status: 'error', message: 'You cannot disable your own admin account.' });
  try {
    const result = await pool.query('UPDATE users SET is_active=$1 WHERE user_id=$2 RETURNING user_id', [isActive, req.params.userId]);
    if (!result.rows.length) return res.status(404).json({ status: 'error', message: 'User not found.' });
    res.json({ status: 'success', message: `User ${isActive ? 'enabled' : 'disabled'} successfully.` });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to update user status.' });
  }
};
