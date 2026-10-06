import { isIP } from 'node:net';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { auditSecurityEvent } from '../middleware/security.js';
import { revokeAllUserSessions } from '../middleware/sessionAuth.js';

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
    await auditSecurityEvent(req, { eventType: 'ADMIN_LAB_CREATED', outcome: 'SUCCESS', objectType: 'lab', objectId: result.rows[0].lab_id });
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
    await auditSecurityEvent(req, { eventType: 'ADMIN_LAB_UPDATED', outcome: 'SUCCESS', objectType: 'lab', objectId: req.params.labId });
    res.json({ status: 'success', message: 'Lab updated successfully.', lab: result.rows[0] });
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 500).json({ status: 'error', message: error.code === '23505' ? 'A lab with this name already exists.' : 'Failed to update lab.' });
  }
};

function normalizeImportKey(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '_');
}

function normalizeImportedLab(row) {
  const normalized = Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [normalizeImportKey(key), value]));
  return {
    department_id: normalized.department_id ?? normalized.departmentid ?? '',
    department_code: normalized.department_code ?? normalized.departmentcode ?? '',
    department_name: normalized.department_name ?? normalized.department ?? '',
    lab_name: normalized.lab_name ?? normalized.labname ?? normalized.lab ?? '',
    total_pcs: normalized.total_pcs ?? normalized.totalpcs ?? normalized.pcs ?? '',
    capacity: normalized.capacity ?? normalized.exam_capacity ?? normalized.exampcapacity ?? '',
    network_range: normalized.network_range ?? normalized.networkrange ?? normalized.cidr ?? normalized.ip_range ?? '',
    status: normalized.status || 'Available',
  };
}

export const importLabs = async (req, res) => {
  const rows = req.body?.labs;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ status: 'error', message: 'Upload a spreadsheet containing at least one lab row.' });
  }
  if (rows.length > 500) {
    return res.status(400).json({ status: 'error', message: 'A maximum of 500 labs can be imported at once.' });
  }

  try {
    const departmentsResult = await pool.query('SELECT department_id, department_name, department_code FROM department');
    const departments = departmentsResult.rows;
    const byId = new Map(departments.map(department => [String(department.department_id), department.department_id]));
    const byCode = new Map(departments.map(department => [String(department.department_code).trim().toLowerCase(), department.department_id]));
    const byName = new Map(departments.map(department => [String(department.department_name).trim().toLowerCase(), department.department_id]));
    const seenNames = new Set();
    const cleanRows = [];
    const errors = [];

    rows.forEach((rawRow, index) => {
      const rowNumber = index + 2;
      const row = normalizeImportedLab(rawRow);
      const departmentId = byId.get(String(row.department_id).trim())
        || byCode.get(String(row.department_code).trim().toLowerCase())
        || byName.get(String(row.department_name).trim().toLowerCase());
      const labName = String(row.lab_name || '').trim();
      const duplicateKey = labName.toLowerCase();
      const validationError = validateLab({ ...row, department_id: departmentId });

      if (!departmentId) errors.push(`Row ${rowNumber}: department was not found.`);
      if (seenNames.has(duplicateKey)) errors.push(`Row ${rowNumber}: duplicate lab name "${labName}" in this file.`);
      if (validationError) errors.push(`Row ${rowNumber}: ${validationError}`);
      if (labName) seenNames.add(duplicateKey);
      cleanRows.push({ ...row, department_id: departmentId, lab_name: labName, total_pcs: Number(row.total_pcs), capacity: Number(row.capacity), network_range: String(row.network_range || '').trim(), status: String(row.status || 'Available').trim() });
    });

    if (errors.length) return res.status(400).json({ status: 'error', message: 'The spreadsheet has validation errors.', errors });

    const client = await pool.connect();
    let created = 0;
    let updated = 0;
    try {
      await client.query('BEGIN');
      for (const lab of cleanRows) {
        const existing = await client.query('SELECT lab_id FROM lab WHERE LOWER(lab_name)=LOWER($1)', [lab.lab_name]);
        if (existing.rowCount) {
          await client.query(`UPDATE lab SET department_id=$1,total_pcs=$2,capacity=$3,network_range=$4,status=$5 WHERE lab_id=$6`, [lab.department_id, lab.total_pcs, lab.capacity, lab.network_range, lab.status, existing.rows[0].lab_id]);
          updated += 1;
        } else {
          await client.query(`INSERT INTO lab (department_id,lab_name,total_pcs,capacity,network_range,status) VALUES ($1,$2,$3,$4,$5,$6)`, [lab.department_id, lab.lab_name, lab.total_pcs, lab.capacity, lab.network_range, lab.status]);
          created += 1;
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    await auditSecurityEvent(req, { eventType: 'ADMIN_LABS_IMPORTED', outcome: 'SUCCESS', objectType: 'lab', metadata: { rows: cleanRows.length, created, updated } });
    return res.json({ status: 'success', message: `${created} lab${created === 1 ? '' : 's'} added and ${updated} updated.`, created, updated });
  } catch (error) {
    console.error('Admin lab import error:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to import labs.' });
  }
};

export const deleteLab = async (req, res) => {
  try {
    const used = await pool.query('SELECT 1 FROM exam_schedule WHERE lab_id=$1 LIMIT 1', [req.params.labId]);
    if (used.rows.length) return res.status(409).json({ status: 'error', message: 'This lab is used by an exam schedule. Set it to Maintenance instead.' });
    const result = await pool.query('DELETE FROM lab WHERE lab_id=$1 RETURNING lab_id', [req.params.labId]);
    if (!result.rows.length) return res.status(404).json({ status: 'error', message: 'Lab not found.' });
    await auditSecurityEvent(req, { eventType: 'ADMIN_LAB_DELETED', outcome: 'SUCCESS', objectType: 'lab', objectId: req.params.labId });
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
    await auditSecurityEvent(req, { eventType: 'ADMIN_SETTINGS_UPDATED', outcome: 'SUCCESS', objectType: 'system_setting', metadata: { keys: Object.keys(settings) } });
    res.json({ status: 'success', message: 'System settings updated successfully.' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ status: 'error', message: 'Failed to update system settings.' });
  } finally {
    client.release();
  }
};

export const getUsers = async (req, res) => {
  const departmentId = req.query.department_id ? Number(req.query.department_id) : null;
  const programId = req.query.program_id ? Number(req.query.program_id) : null;
  const semester = req.query.semester ? Number(req.query.semester) : null;
  const sectionId = req.query.section_id ? Number(req.query.section_id) : null;
  const userType = String(req.query.user_type || '').trim() || null;
  try {
    const users = await pool.query(`
        SELECT u.user_id,u.first_name,u.last_name,u.email,u.user_type,u.is_active,u.created_at,u.last_login_at,
               s.student_id,s.registration_no,s.current_semester,s.status AS student_status,s.section_id,
               sec.section_name,b.batch_id,b.batch_name,p.program_id,p.program_name,p.program_code,
               d.department_id,d.department_name,d.department_code,t.teacher_id,t.designation,
               h.hod_id,co.coordinator_id,dr.director_id,dm.dec_member_id,a.admin_id,
               h.tenure_start,h.tenure_end,dm.role AS committee_role,dr.designation AS director_designation,
               a.is_super_admin
        FROM users u
        LEFT JOIN student s ON s.user_id=u.user_id
        LEFT JOIN batch b ON b.batch_id=s.batch_id
        LEFT JOIN program p ON p.program_id=b.program_id
        LEFT JOIN teacher t ON t.user_id=u.user_id
        LEFT JOIN hod h ON h.user_id=u.user_id
        LEFT JOIN coordinator co ON co.user_id=u.user_id
        LEFT JOIN dec_member dm ON dm.user_id=u.user_id
        LEFT JOIN director dr ON dr.user_id=u.user_id
        LEFT JOIN admin a ON a.user_id=u.user_id
        LEFT JOIN department d ON d.department_id=COALESCE(p.department_id,t.department_id,h.department_id,co.department_id,dm.department_id)
        LEFT JOIN section sec ON sec.section_id=s.section_id
        WHERE ($1::int IS NULL OR d.department_id=$1)
          AND ($2::int IS NULL OR p.program_id=$2)
          AND ($3::int IS NULL OR s.current_semester=$3)
          AND ($4::int IS NULL OR sec.section_id=$4)
          AND ($5::text IS NULL OR u.user_type=$5)
        ORDER BY d.department_name NULLS LAST,p.program_name NULLS LAST,s.current_semester NULLS LAST,sec.section_name NULLS LAST,u.user_type,u.first_name,u.last_name
      `, [departmentId, programId, semester, sectionId, userType]);
    const directory = await pool.query(`
        SELECT d.department_id,d.department_name,d.department_code,
               p.program_id,p.program_name,p.program_code,
               b.batch_id,b.batch_name,b.admission_year,
               sec.section_id,sec.section_name
        FROM department d LEFT JOIN program p ON p.department_id=d.department_id
        LEFT JOIN batch b ON b.program_id=p.program_id
        LEFT JOIN section sec ON sec.batch_id=b.batch_id
        ORDER BY d.department_name,p.program_name,b.batch_name,sec.section_name
      `);
    res.json({ status: 'success', users: users.rows, directory: directory.rows });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to load users.' });
  }
};

function normalizeUserRow(row) {
  const normalized = Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [normalizeImportKey(key), value]));
  return {
    first_name: String(normalized.first_name ?? normalized.firstname ?? '').trim(),
    last_name: String(normalized.last_name ?? normalized.lastname ?? '').trim(),
    email: String(normalized.email ?? '').trim().toLowerCase(),
    password: String(normalized.password ?? 'password123'),
    user_type: String(normalized.user_type ?? normalized.role ?? 'student').trim().toLowerCase(),
    registration_no: String(normalized.registration_no ?? normalized.registrationno ?? normalized.roll_no ?? normalized.rollno ?? '').trim(),
    department_id: normalized.department_id ?? normalized.departmentid ?? '',
    department_code: String(normalized.department_code ?? normalized.departmentcode ?? '').trim(),
    program_id: normalized.program_id ?? normalized.programid ?? '',
    program_code: String(normalized.program_code ?? normalized.programcode ?? '').trim(),
    batch_id: normalized.batch_id ?? normalized.batchid ?? '',
    batch_name: String(normalized.batch_name ?? normalized.batchname ?? '').trim(),
    section_id: normalized.section_id ?? normalized.sectionid ?? '',
    section_name: String(normalized.section_name ?? normalized.sectionname ?? '').trim(),
    current_semester: Number(normalized.current_semester ?? normalized.semester ?? 0),
    status: String(normalized.status || 'Active').trim(),
    designation: String(normalized.designation || '').trim(),
  };
}

async function resolveAcademic(client, row) {
  if (row.user_type !== 'student') return {};
  if (!row.registration_no || !Number.isInteger(row.current_semester) || row.current_semester < 1) throw new Error('Students require registration_no and a valid current_semester.');
  const department = (await client.query(`SELECT department_id FROM department WHERE department_id=$1 OR LOWER(department_code)=LOWER($2) LIMIT 1`, [Number(row.department_id) || 0, row.department_code])).rows[0];
  if (!department) throw new Error('Student department was not found.');
  const program = (await client.query(`SELECT program_id FROM program WHERE department_id=$1 AND (program_id=$2 OR LOWER(program_code)=LOWER($3)) LIMIT 1`, [department.department_id, Number(row.program_id) || 0, row.program_code])).rows[0];
  if (!program) throw new Error('Student program was not found in the selected department.');
  const batch = (await client.query(`SELECT batch_id FROM batch WHERE program_id=$1 AND (batch_id=$2 OR LOWER(batch_name)=LOWER($3)) LIMIT 1`, [program.program_id, Number(row.batch_id) || 0, row.batch_name])).rows[0];
  if (!batch) throw new Error('Student batch was not found in the selected program.');
  const section = (await client.query(`SELECT section_id FROM section WHERE batch_id=$1 AND (section_id=$2 OR LOWER(section_name)=LOWER($3)) AND section_name ~ $4 LIMIT 1`, [batch.batch_id, Number(row.section_id) || 0, row.section_name, `^${row.current_semester}`])).rows[0];
  if (!section) throw new Error('Student section was not found for that batch and semester.');
  return { batchId: batch.batch_id, sectionId: section.section_id };
}

async function createUserRecord(client, rawRow) {
  const row = normalizeUserRow(rawRow);
  const allowed = new Set(['student','teacher','hod','coordinator','director','dec','admin']);
  if (!row.first_name || !row.last_name || !row.email || !row.password) throw new Error('First name, last name, email, and password are required.');
  if (!allowed.has(row.user_type)) throw new Error(`Unsupported role: ${row.user_type}`);
  const academic = await resolveAcademic(client, row);
  const userResult = await client.query(`INSERT INTO users(first_name,last_name,email,password_hash,user_type) VALUES($1,$2,$3,$4,$5) RETURNING user_id,first_name,last_name,email,user_type,is_active`, [row.first_name, row.last_name, row.email, await bcrypt.hash(row.password, 12), row.user_type]);
  const user = userResult.rows[0];
  if (row.user_type === 'student') {
    await client.query(`INSERT INTO student(user_id,registration_no,batch_id,section_id,current_semester,status) VALUES($1,$2,$3,$4,$5,$6)`, [user.user_id, row.registration_no, academic.batchId, academic.sectionId, row.current_semester, ['Active','Frozen','Dropped','Graduated'].includes(row.status) ? row.status : 'Active']);
  } else if (['teacher','hod','dec'].includes(row.user_type)) {
    const dept = (await client.query(`SELECT department_id FROM department WHERE department_id=$1 OR LOWER(department_code)=LOWER($2) LIMIT 1`, [Number(row.department_id) || 0, row.department_code])).rows[0];
    if (!dept) throw new Error('This role requires a valid department.');
    const teacher = await client.query(`INSERT INTO teacher(user_id,department_id,designation) VALUES($1,$2,$3) RETURNING teacher_id`, [user.user_id, dept.department_id, row.designation || null]);
    if (row.user_type === 'hod') await client.query(`INSERT INTO hod(user_id,teacher_id,department_id,tenure_start) VALUES($1,$2,$3,CURRENT_DATE)`, [user.user_id, teacher.rows[0].teacher_id, dept.department_id]);
    if (row.user_type === 'dec') await client.query(`INSERT INTO dec_member(user_id,teacher_id,department_id,role) VALUES($1,$2,$3,'Member')`, [user.user_id, teacher.rows[0].teacher_id, dept.department_id]);
  } else if (row.user_type === 'coordinator') {
    const dept = (await client.query(`SELECT department_id FROM department WHERE department_id=$1 OR LOWER(department_code)=LOWER($2) LIMIT 1`, [Number(row.department_id) || 0, row.department_code])).rows[0];
    if (!dept) throw new Error('Coordinator requires a valid department.');
    await client.query(`INSERT INTO coordinator(user_id,department_id) VALUES($1,$2)`, [user.user_id, dept.department_id]);
  } else if (row.user_type === 'director') {
    await client.query(`INSERT INTO director(user_id,designation) VALUES($1,$2)`, [user.user_id, row.designation || null]);
  } else if (row.user_type === 'admin') {
    await client.query(`INSERT INTO admin(user_id) VALUES($1)`, [user.user_id]);
  }
  return user;
}

export const createUser = async (req, res) => {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const user = await createUserRecord(client, req.body); await client.query('COMMIT'); await auditSecurityEvent(req, { eventType: 'ADMIN_USER_CREATED', outcome: 'SUCCESS', objectType: 'user', objectId: user.user_id }); res.status(201).json({ status: 'success', message: 'User created successfully.', user }); }
  catch (error) { await client.query('ROLLBACK'); res.status(error.code === '23505' ? 409 : 400).json({ status: 'error', message: error.code === '23505' ? 'Email or registration number already exists.' : error.message || 'Failed to create user.' }); }
  finally { client.release(); }
};

export const importUsers = async (req, res) => {
  const rows = req.body?.users;
  if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ status: 'error', message: 'Upload a spreadsheet containing at least one user row.' });
  if (rows.length > 500) return res.status(400).json({ status: 'error', message: 'A maximum of 500 users can be imported at once.' });
  const client = await pool.connect(); const errors = []; const created = [];
  try { await client.query('BEGIN'); for (let i=0;i<rows.length;i++) { try { created.push(await createUserRecord(client, rows[i])); } catch (error) { errors.push(`Row ${i + 2}: ${error.message}`); } } if (errors.length) { await client.query('ROLLBACK'); return res.status(400).json({ status: 'error', message: 'The spreadsheet has validation errors.', errors }); } await client.query('COMMIT'); await auditSecurityEvent(req, { eventType: 'ADMIN_USERS_IMPORTED', outcome: 'SUCCESS', objectType: 'user', metadata: { count: created.length } }); res.json({ status: 'success', message: `${created.length} user${created.length === 1 ? '' : 's'} imported successfully.`, created: created.length }); }
  catch (error) { await client.query('ROLLBACK'); res.status(500).json({ status: 'error', message: 'Failed to import users.' }); } finally { client.release(); }
};

export const removeUser = async (req, res) => {
  req.body = { is_active: false };
  return setUserActive(req, res);
};

export const setUserActive = async (req, res) => {
  const isActive = req.body.is_active;
  if (typeof isActive !== 'boolean') return res.status(400).json({ status: 'error', message: 'is_active must be true or false.' });
  if (Number(req.params.userId) === Number(req.sessionUser.sub) && !isActive) return res.status(400).json({ status: 'error', message: 'You cannot disable your own admin account.' });
  try {
    const result = await pool.query('UPDATE users SET is_active=$1 WHERE user_id=$2 RETURNING user_id', [isActive, req.params.userId]);
    if (!result.rows.length) return res.status(404).json({ status: 'error', message: 'User not found.' });
    if (!isActive) await revokeAllUserSessions(req.params.userId, 'ACCOUNT_DISABLED');
    await auditSecurityEvent(req, { eventType: isActive ? 'ADMIN_USER_ENABLED' : 'ADMIN_USER_DISABLED', outcome: 'SUCCESS', objectType: 'user', objectId: req.params.userId });
    res.json({ status: 'success', message: `User ${isActive ? 'enabled' : 'disabled'} successfully.` });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to update user status.' });
  }
};

export const revokeUserSessions = async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ status: 'error', message: 'Invalid user ID.' });
  try {
    const exists = await pool.query('SELECT 1 FROM users WHERE user_id=$1', [userId]);
    if (!exists.rowCount) return res.status(404).json({ status: 'error', message: 'User not found.' });
    await revokeAllUserSessions(userId, 'ADMIN_REVOKED');
    await auditSecurityEvent(req, { eventType: 'ADMIN_SESSIONS_REVOKED', outcome: 'SUCCESS', objectType: 'user', objectId: userId });
    res.json({ status: 'success', message: 'All active sessions for this user were revoked.' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to revoke user sessions.' });
  }
};

export const getSecurityEvents = async (req, res) => {
  const limit = Math.min(500, Math.max(1, Number.parseInt(req.query.limit, 10) || 200));
  const eventType = String(req.query.event_type || '').trim().slice(0, 80) || null;
  const outcome = String(req.query.outcome || '').trim().slice(0, 30) || null;
  try {
    const result = await pool.query(`
      SELECT sal.audit_id,sal.event_type,sal.outcome,sal.ip_address,sal.method,
             sal.request_path,sal.object_type,sal.object_id,sal.metadata,sal.created_at,
             u.first_name,u.last_name,u.email,u.user_type
      FROM security_audit_log sal
      LEFT JOIN users u ON u.user_id=sal.user_id
      WHERE ($1::text IS NULL OR sal.event_type=$1)
        AND ($2::text IS NULL OR sal.outcome=$2)
      ORDER BY sal.created_at DESC
      LIMIT $3
    `, [eventType, outcome, limit]);
    res.json({ status: 'success', events: result.rows });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to load security events.' });
  }
};
