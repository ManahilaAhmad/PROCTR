import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../config/apiConfig';
import { C } from '../theme/colors';
import { Icon } from '../theme/icons';
import PageWrap from '../components/common/PageWrap';
import Card from '../components/common/Card';
import Btn from '../components/common/Btn';
import StatCard from '../components/common/StatCard';
import * as XLSX from 'xlsx';

const emptyLab = { department_id: '', lab_name: '', total_pcs: 1, capacity: 1, network_range: '', status: 'Available' };
const fieldStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${C.grey200}`, boxSizing: 'border-box', fontFamily: 'inherit', color: C.navy, background: C.white };
const adminPrimaryStyle = { background: 'linear-gradient(135deg, #557987 0%, #7899a6 100%)', boxShadow: '0 0 30px rgba(58,177,215,.28), 0 10px 24px rgba(47,110,139,.18), inset 0 1px 0 rgba(255,255,255,.25)', border: '1px solid rgba(255,255,255,.45)', borderRadius: 11 };
const adminGhostStyle = { background: 'rgba(255,255,255,.42)', color: '#557987', border: '1px solid rgba(255,255,255,.9)', boxShadow: '0 7px 22px rgba(63,145,177,.12)', borderRadius: 11, backdropFilter: 'blur(10px)' };
const adminLabsStyles = `
  @keyframes adminRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
  .admin-glass-page { position: relative; isolation: isolate; z-index: 0; background: transparent !important; min-width: 0; }
  @media (min-width: 769px) { .resp-layout-container > .resp-sidebar { display: flex !important; visibility: visible !important; width: 236px !important; flex: 0 0 236px !important; position: fixed !important; left: 0 !important; top: 0 !important; bottom: 0 !important; height: 100vh !important; max-height: 100vh !important; overflow: hidden !important; inset: auto auto 0 0 !important; transform: none !important; z-index: 1000 !important; } }
  .admin-glass-page::before { content: ''; position: fixed; inset: 0; z-index: -1; pointer-events: none; background: radial-gradient(circle at 16% 18%, rgba(255,255,255,.92), transparent 28%), radial-gradient(circle at 84% 12%, rgba(0,180,166,.16), transparent 24%), linear-gradient(90deg, #ffffff 0%, #ffffff 42%, #eef7fa 58%, #c3d8e4 100%); }
  .admin-glass-page .resp-page-padding { max-width: 1440px; margin: 0 auto; }
  .admin-glass-page h1 { font-family: 'Inter', 'Segoe UI', system-ui, sans-serif !important; color: #557987 !important; letter-spacing: -.5px !important; font-size: 30px !important; }
  .admin-glass-page .admin-glass-card { background: linear-gradient(145deg, rgba(255,255,255,.78), rgba(255,255,255,.56)) !important; border: 1px solid rgba(255,255,255,.86) !important; box-shadow: 0 22px 55px rgba(41,91,117,.16), inset 0 1px 0 rgba(255,255,255,.96) !important; backdrop-filter: blur(20px) saturate(135%); -webkit-backdrop-filter: blur(20px) saturate(135%); animation: adminRise .4s ease both; }
  .admin-glass-page .admin-glass-card input, .admin-glass-page .admin-glass-card select { background: rgba(255,255,255,.5) !important; border: 1px solid rgba(255,255,255,.9) !important; border-radius: 11px !important; box-shadow: inset 0 1px 2px rgba(48,91,112,.06), 0 7px 22px rgba(63,145,177,.14); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); outline: none; }
  .admin-glass-page .admin-glass-card input:focus, .admin-glass-page .admin-glass-card select:focus { border-color: rgba(0,180,166,.62) !important; box-shadow: 0 0 0 3px rgba(0,180,166,.12), 0 7px 22px rgba(63,145,177,.18); }
  .admin-glass-page code { background: rgba(255,255,255,.58); color: #557987; border: 1px solid rgba(255,255,255,.8); }
  .admin-glass-page table thead th { color: #557987 !important; border-bottom-color: rgba(255,255,255,.9) !important; }
  .admin-glass-page table tbody tr:hover { background: rgba(255,255,255,.34); }
  .admin-glass-page table td { border-bottom-color: rgba(255,255,255,.65) !important; }
  @media (max-width: 768px) { .admin-glass-page h1 { font-size: 27px; } }
`;

const adminUserPageTypes = {
  'admin-students': { type: 'student', label: 'Students' },
  'admin-teachers': { type: 'teacher', label: 'Teachers' },
  'admin-hod': { type: 'hod', label: 'Heads of Department' },
  'admin-coordinator': { type: 'coordinator', label: 'Coordinators' },
  'admin-director': { type: 'director', label: 'Directors' },
  'admin-dec': { type: 'dec', label: 'DEC Members' },
  'admin-admins': { type: 'admin', label: 'Administrators' },
};

export default function AdminPage({ activePage, user }) {
  const sessionToken = user?.sessionToken;
  const [overview, setOverview] = useState({});
  const [labs, setLabs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [userDirectory, setUserDirectory] = useState([]);
  const [userFilters, setUserFilters] = useState({ department_id: '', program_id: '', semester: '', section_id: '', user_type: '', q: '' });
  const [userForm, setUserForm] = useState(null);
  const [userImporting, setUserImporting] = useState(false);
  const [securityEvents, setSecurityEvents] = useState([]);
  const [labForm, setLabForm] = useState(null);
  const [editingLabId, setEditingLabId] = useState(null);
  const [message, setMessage] = useState(null);
  const [importing, setImporting] = useState(false);

  const request = useCallback(async (path, options = {}) => {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
    const response = await fetch(`${API_BASE_URL}/admin${path}`, { ...options, credentials: 'include', headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = Array.isArray(data.errors) && data.errors.length ? ` ${data.errors.join(' ')}` : '';
      throw new Error(`${data.message || 'Request failed.'}${detail}`);
    }
    return data;
  }, [sessionToken]);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3500);
  };

  const loadOverview = useCallback(() => request('/overview').then(data => setOverview(data.overview)), [request]);
  const loadLabs = useCallback(() => request('/labs').then(data => { setLabs(data.labs); setDepartments(data.departments); }), [request]);
  const loadUsers = useCallback(() => {
    const pageType = adminUserPageTypes[activePage]?.type;
    const filters = {
      department_id: userFilters.department_id,
      program_id: userFilters.program_id,
      semester: userFilters.semester,
      section_id: userFilters.section_id,
      user_type: pageType || userFilters.user_type,
    };
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    return request(`/users${params.toString() ? `?${params}` : ''}`).then(data => { setUsers(data.users || []); setUserDirectory(data.directory || []); });
  }, [request, userFilters.department_id, userFilters.program_id, userFilters.semester, userFilters.section_id, userFilters.user_type, activePage]);
  const loadSecurityEvents = useCallback(() => request('/security-events?limit=200').then(data => setSecurityEvents(data.events || [])), [request]);

  useEffect(() => {
    const loader = activePage === 'admin-labs' ? loadLabs : adminUserPageTypes[activePage] ? loadUsers : activePage === 'admin-security' ? loadSecurityEvents : loadOverview;
    loader().catch(error => showMessage(error.message, 'error'));
  }, [activePage, loadLabs, loadOverview, loadSecurityEvents, loadUsers]);

  async function saveLab() {
    try {
      const path = editingLabId ? `/labs/${editingLabId}` : '/labs';
      const method = editingLabId ? 'PUT' : 'POST';
      const data = await request(path, { method, body: JSON.stringify(labForm) });
      showMessage(data.message);
      setLabForm(null);
      setEditingLabId(null);
      await loadLabs();
    } catch (error) { showMessage(error.message, 'error'); }
  }

  function downloadLabTemplate() {
    const worksheet = XLSX.utils.json_to_sheet([
      { lab_name: 'Lab-1', department_code: departments[0]?.department_code || 'CS', total_pcs: 42, capacity: 40, network_range: '192.168.1.0/24', status: 'Available' },
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Labs');
    XLSX.writeFile(workbook, 'proctr-labs-template.xlsx');
  }

  async function importLabWorkbook(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
      if (!rows.length) throw new Error('The selected spreadsheet is empty.');
      const data = await request('/labs/import', { method: 'POST', body: JSON.stringify({ labs: rows }) });
      showMessage(data.message);
      await loadLabs();
    } catch (error) {
      const details = error.message;
      showMessage(details, 'error');
    } finally {
      setImporting(false);
    }
  }

  async function removeLab(lab) {
    if (!window.confirm(`Delete ${lab.lab_name}? Scheduled labs cannot be deleted.`)) return;
    try {
      const data = await request(`/labs/${lab.lab_id}`, { method: 'DELETE' });
      showMessage(data.message);
      await loadLabs();
    } catch (error) { showMessage(error.message, 'error'); }
  }

  async function toggleUser(target) {
    try {
      const data = await request(`/users/${target.user_id}/status`, { method: 'PATCH', body: JSON.stringify({ is_active: !target.is_active }) });
      showMessage(data.message);
      await loadUsers();
    } catch (error) { showMessage(error.message, 'error'); }
  }

  async function removeUser(target) {
    if (!window.confirm(`Remove ${target.first_name} ${target.last_name}? Their records will remain, but access will be disabled.`)) return;
    try { const data = await request(`/users/${target.user_id}`, { method: 'DELETE' }); showMessage(data.message); await loadUsers(); }
    catch (error) { showMessage(error.message, 'error'); }
  }

  async function saveUser() {
    try { const data = await request('/users', { method: 'POST', body: JSON.stringify(userForm) }); showMessage(data.message); setUserForm(null); await loadUsers(); }
    catch (error) { showMessage(error.message, 'error'); }
  }

  function downloadStudentTemplate() {
    const worksheet = XLSX.utils.json_to_sheet([{ first_name: 'Ayesha', last_name: 'Khan', email: 'ayesha@example.edu', password: 'password123', user_type: 'student', registration_no: '231593', department_code: departments[0]?.department_code || 'CS', program_code: 'BSCS', batch_name: 'BSCS-2023', section_name: '6A', current_semester: 6, status: 'Active', designation: '' }]);
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, 'Students'); XLSX.writeFile(workbook, 'proctr-students-template.xlsx');
  }

  function downloadTeacherTemplate() {
    const worksheet = XLSX.utils.json_to_sheet([{ first_name: 'Amna', last_name: 'Riaz', email: 'amna.riaz@university.edu', password: 'password123', department_code: departments[0]?.department_code || 'CS', designation: 'Lecturer' }]);
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, 'Teachers'); XLSX.writeFile(workbook, 'proctr-teachers-template.xlsx');
  }

  async function importStudentWorkbook(event) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; setUserImporting(true);
    try { const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' }); const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' }).map(row => ({ ...row, user_type: 'student' })); if (!rows.length) throw new Error('The selected spreadsheet is empty.'); const data = await request('/users/import', { method: 'POST', body: JSON.stringify({ users: rows }) }); showMessage(data.message); await loadUsers(); }
    catch (error) { showMessage(error.message, 'error'); } finally { setUserImporting(false); }
  }

  async function importTeacherWorkbook(event) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; setUserImporting(true);
    try { const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' }); const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' }).map(row => ({ ...row, user_type: 'teacher' })); if (!rows.length) throw new Error('The selected spreadsheet is empty.'); const data = await request('/users/import', { method: 'POST', body: JSON.stringify({ users: rows }) }); showMessage(data.message); await loadUsers(); }
    catch (error) { showMessage(error.message, 'error'); } finally { setUserImporting(false); }
  }

  function downloadRoleTemplate(role, label) {
    const worksheet = XLSX.utils.json_to_sheet([{ first_name: 'First', last_name: 'Last', email: `${role}@university.edu`, password: 'password123', department_code: departments[0]?.department_code || 'CS', designation: label }]);
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, label); XLSX.writeFile(workbook, `proctr-${role}-template.xlsx`);
  }

  async function importRoleWorkbook(event, role) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; setUserImporting(true);
    try { const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' }); const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' }).map(row => ({ ...row, user_type: role })); if (!rows.length) throw new Error('The selected spreadsheet is empty.'); const data = await request('/users/import', { method: 'POST', body: JSON.stringify({ users: rows }) }); showMessage(data.message); await loadUsers(); }
    catch (error) { showMessage(error.message, 'error'); } finally { setUserImporting(false); }
  }

  async function revokeSessions(target) {
    if (!window.confirm(`Sign ${target.first_name} ${target.last_name} out from every device?`)) return;
    try {
      const data = await request(`/users/${target.user_id}/revoke-sessions`, { method: 'POST', body: '{}' });
      showMessage(data.message);
    } catch (error) { showMessage(error.message, 'error'); }
  }

  const notice = message && <div style={{ marginBottom: 18, padding: '11px 14px', borderRadius: 8, background: message.type === 'error' ? C.redLight : C.tealLight, color: message.type === 'error' ? C.red : C.navy, fontWeight: 700, fontSize: 13 }}>{message.text}</div>;

  if (activePage === 'admin-labs') return (
    <>
    <style>{adminLabsStyles}</style>
    <PageWrap className="admin-glass-page" title="Lab & Network Management" subtitle="Configure the physical labs and the IP ranges used by exam access and desktop monitoring" actions={<>
      <Btn variant="ghost" style={adminGhostStyle} onClick={downloadLabTemplate}>Download Excel template</Btn>
      <label style={{ ...uploadButtonStyle, ...adminGhostStyle, opacity: importing ? .55 : 1 }}>
        {importing ? 'Importing…' : 'Import Excel'}
        <input type="file" accept=".xlsx,.xls,.csv" onChange={importLabWorkbook} disabled={importing} style={{ display: 'none' }} />
      </label>
      <Btn style={adminPrimaryStyle} onClick={() => { setEditingLabId(null); setLabForm({ ...emptyLab, department_id: departments[0]?.department_id || '' }); }}>Add Lab</Btn>
    </>}>
      {notice}
      {labForm && <Card className="admin-glass-card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0, color: C.navy }}>{editingLabId ? 'Edit Lab' : 'Add Lab'}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
          <Field label="Lab name"><input style={fieldStyle} value={labForm.lab_name} onChange={e => setLabForm({ ...labForm, lab_name: e.target.value })} placeholder="Lab-1" /></Field>
          <Field label="Department"><select style={fieldStyle} value={labForm.department_id} onChange={e => setLabForm({ ...labForm, department_id: e.target.value })}><option value="">Select department</option>{departments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_code} — {d.department_name}</option>)}</select></Field>
          <Field label="Total PCs"><input style={fieldStyle} type="number" min="1" value={labForm.total_pcs} onChange={e => setLabForm({ ...labForm, total_pcs: Number(e.target.value) })} /></Field>
          <Field label="Exam capacity"><input style={fieldStyle} type="number" min="1" value={labForm.capacity} onChange={e => setLabForm({ ...labForm, capacity: Number(e.target.value) })} /></Field>
          <Field label="Network CIDR"><input style={fieldStyle} value={labForm.network_range} onChange={e => setLabForm({ ...labForm, network_range: e.target.value })} placeholder="192.168.18.0/24" /></Field>
          <Field label="Status"><select style={fieldStyle} value={labForm.status} onChange={e => setLabForm({ ...labForm, status: e.target.value })}>{['Available', 'InUse', 'Maintenance'].map(s => <option key={s}>{s}</option>)}</select></Field>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}><Btn style={adminPrimaryStyle} onClick={saveLab}>Save Lab</Btn><Btn variant="ghost" style={adminGhostStyle} onClick={() => setLabForm(null)}>Cancel</Btn></div>
      </Card>}
      <Card className="admin-glass-card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}><thead><tr>{['Lab', 'Department', 'PCs', 'Capacity', 'Network range', 'Status', 'Actions'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{labs.map(lab => <tr key={lab.lab_id}><td style={td}><strong>{lab.lab_name}</strong></td><td style={td}>{lab.department_code}</td><td style={td}>{lab.total_pcs}</td><td style={td}>{lab.capacity}</td><td style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: C.teal }}>{lab.network_range || 'Not configured'}</td><td style={td}>{lab.status}</td><td style={td}><div style={{ display: 'flex', gap: 8 }}><Btn size="sm" variant="ghost" onClick={() => { setEditingLabId(lab.lab_id); setLabForm({ ...lab }); }}>Edit</Btn><Btn size="sm" variant="danger" onClick={() => removeLab(lab)}>Delete</Btn></div></td></tr>)}</tbody>
        </table>
        {labs.length === 0 && <p style={{ color: C.grey500 }}>No labs configured.</p>}
      </Card>
    </PageWrap>
    </>
  );

  if (adminUserPageTypes[activePage]) {
    const managedPage = adminUserPageTypes[activePage];
    const managedType = managedPage.type;
    const managedLabel = managedPage.label;
    const directoryDepartments = [...new Map(userDirectory.filter(row => row.department_id).map(row => [row.department_id, row])).values()];
    const directoryPrograms = [...new Map(userDirectory.filter(row => row.program_id && (!userFilters.department_id || String(row.department_id) === String(userFilters.department_id))).map(row => [row.program_id, row])).values()];
    const directoryBatches = [...new Map(userDirectory.filter(row => row.batch_id && (!userFilters.program_id || String(row.program_id) === String(userFilters.program_id))).map(row => [row.batch_id, row])).values()];
    const directorySections = [...new Map(userDirectory.filter(row => row.section_id && (!userFilters.program_id || String(row.program_id) === String(userFilters.program_id))).map(row => [row.section_id, row])).values()];
    const localSearch = userFilters.q.trim().toLowerCase();
    const visibleUsers = localSearch ? users.filter(target => [target.first_name, target.last_name, target.email, target.registration_no, target.user_type].filter(Boolean).join(' ').toLowerCase().includes(localSearch)) : users;
    const studentForm = userForm?.user_type === 'student';
    const blankUser = { first_name: '', last_name: '', email: '', password: 'password123', user_type: managedType, registration_no: '', department_id: '', program_id: '', batch_id: '', section_id: '', current_semester: '', status: 'Active', designation: '' };
    const departmentName = target => target.department_code ? `${target.department_code} — ${target.department_name}` : '—';
    const identifier = managedType === 'student'
      ? { label: 'Roll number', value: target => target.registration_no || '—' }
      : {
          label: 'Employee ID',
          value: target => ({
            teacher: target.teacher_id,
            hod: target.teacher_id,
            dec: target.teacher_id,
            coordinator: target.coordinator_id,
            director: target.director_id,
            admin: target.admin_id,
          })[managedType] || '—',
        };
    const detailColumns = {
      student: [
        { label: 'Academic placement', value: target => [target.department_code, target.program_code, target.batch_name, target.current_semester && `Semester ${target.current_semester}`, target.section_name && `Section ${target.section_name}`].filter(Boolean).join(' · ') || '—' },
        { label: 'Academic status', value: target => target.student_status || '—' },
      ],
      teacher: [
        { label: 'Designation', value: target => target.designation || '—' },
        { label: 'Department', value: departmentName },
      ],
      hod: [
        { label: 'Faculty designation', value: target => target.designation || '—' },
        { label: 'Department', value: departmentName },
        { label: 'HOD tenure', value: target => target.tenure_start ? `${String(target.tenure_start).slice(0, 10)} – ${target.tenure_end ? String(target.tenure_end).slice(0, 10) : 'Current'}` : '—' },
      ],
      coordinator: [
        { label: 'Department', value: departmentName },
      ],
      director: [
        { label: 'Designation', value: target => target.director_designation || '—' },
      ],
      dec: [
        { label: 'Committee role', value: target => target.committee_role || '—' },
        { label: 'Faculty designation', value: target => target.designation || '—' },
        { label: 'Department', value: departmentName },
      ],
      admin: [
        { label: 'Administrator access', value: target => target.is_super_admin ? 'Super administrator' : 'Administrator' },
      ],
    }[managedType] || [];
    return <>
      <style>{adminLabsStyles}</style>
      <PageWrap className="admin-glass-page" title={`${managedLabel} Management`} subtitle={`Manage ${managedLabel.toLowerCase()} with database-backed manual entry and Excel import`} actions={<>
        {managedType === 'student' && <>
        <Btn variant="ghost" style={adminGhostStyle} onClick={downloadStudentTemplate}>Student Excel template</Btn>
        <label style={{ ...uploadButtonStyle, ...adminGhostStyle, opacity: userImporting ? .55 : 1 }}>{userImporting ? 'Importing...' : 'Import students'}<input type="file" accept=".xlsx,.xls,.csv" onChange={importStudentWorkbook} disabled={userImporting} style={{ display: 'none' }} /></label>
        <Btn style={adminPrimaryStyle} onClick={() => setUserForm({ ...blankUser })}>Add student</Btn>
        </>}
        {managedType === 'teacher' && <>
        <Btn variant="ghost" style={adminGhostStyle} onClick={downloadTeacherTemplate}>Teacher Excel template</Btn>
        <label style={{ ...uploadButtonStyle, ...adminGhostStyle, opacity: userImporting ? .55 : 1 }}>{userImporting ? 'Importing...' : 'Import teachers'}<input type="file" accept=".xlsx,.xls,.csv" onChange={importTeacherWorkbook} disabled={userImporting} style={{ display: 'none' }} /></label>
        <Btn style={adminPrimaryStyle} onClick={() => setUserForm({ ...blankUser })}>Add teacher</Btn>
        </>}
        {!['student', 'teacher'].includes(managedType) && <>
        <Btn variant="ghost" style={adminGhostStyle} onClick={() => downloadRoleTemplate(managedType, managedLabel)}>Excel template</Btn>
        <label style={{ ...uploadButtonStyle, ...adminGhostStyle, opacity: userImporting ? .55 : 1 }}>{userImporting ? 'Importing...' : `Import ${managedLabel}`}<input type="file" accept=".xlsx,.xls,.csv" onChange={e => importRoleWorkbook(e, managedType)} disabled={userImporting} style={{ display: 'none' }} /></label>
        <Btn style={adminPrimaryStyle} onClick={() => setUserForm({ ...blankUser })}>Add {managedLabel.replace(/s$/, '').toLowerCase()}</Btn>
        </>}
      </>}>
        {notice}
        <Card className="admin-glass-card" style={{ marginBottom: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
            <Field label="Search"><input style={fieldStyle} value={userFilters.q} onChange={e => setUserFilters({ ...userFilters, q: e.target.value })} placeholder="Name, email, roll no" /></Field>
            <Field label="Department"><select style={fieldStyle} value={userFilters.department_id} onChange={e => setUserFilters({ ...userFilters, department_id: e.target.value, program_id: '', semester: '', section_id: '' })}><option value="">All departments</option>{directoryDepartments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_code} — {d.department_name}</option>)}</select></Field>
            <Field label="Program"><select style={fieldStyle} value={userFilters.program_id} onChange={e => setUserFilters({ ...userFilters, program_id: e.target.value, section_id: '' })}><option value="">All programs</option>{directoryPrograms.map(p => <option key={p.program_id} value={p.program_id}>{p.program_code} — {p.program_name}</option>)}</select></Field>
            <Field label="Semester"><select style={fieldStyle} value={userFilters.semester} onChange={e => setUserFilters({ ...userFilters, semester: e.target.value })}><option value="">All semesters</option>{[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}</select></Field>
            <Field label="Section"><select style={fieldStyle} value={userFilters.section_id} onChange={e => setUserFilters({ ...userFilters, section_id: e.target.value })}><option value="">All sections</option>{directorySections.map(s => <option key={s.section_id} value={s.section_id}>{s.section_name} — {s.batch_name}</option>)}</select></Field>
            <Field label="Role"><select style={fieldStyle} value={userFilters.user_type} onChange={e => setUserFilters({ ...userFilters, user_type: e.target.value })}><option value="">All roles</option>{['student','teacher','hod','coordinator','director','dec','admin'].map(role => <option key={role} value={role}>{role.toUpperCase()}</option>)}</select></Field>
          </div>
        </Card>
        {userForm && <Card className="admin-glass-card" style={{ marginBottom: 18 }}><h3 style={{ marginTop: 0, color: C.navy }}>{studentForm ? 'Add student manually' : 'Add teacher manually'}</h3><p style={{ color: C.grey500, margin: '-4px 0 16px' }}>{studentForm ? 'The student account, roll number, department, program, batch, semester, and section are saved together.' : 'The teacher account, department, and designation are saved together.'}</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
          <Field label="First name"><input style={fieldStyle} value={userForm.first_name} onChange={e => setUserForm({ ...userForm, first_name: e.target.value })} /></Field>
          <Field label="Last name"><input style={fieldStyle} value={userForm.last_name} onChange={e => setUserForm({ ...userForm, last_name: e.target.value })} /></Field>
          <Field label="Email"><input style={fieldStyle} type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} /></Field>
          <Field label="Temporary password"><input style={fieldStyle} value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} /></Field>
          {studentForm && <><Field label="Roll / registration no"><input style={fieldStyle} value={userForm.registration_no} onChange={e => setUserForm({ ...userForm, registration_no: e.target.value })} /></Field><Field label="Department"><select style={fieldStyle} value={userForm.department_id} onChange={e => setUserForm({ ...userForm, department_id: e.target.value, program_id: '', batch_id: '', section_id: '' })}><option value="">Select department</option>{directoryDepartments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_code} — {d.department_name}</option>)}</select></Field><Field label="Program"><select style={fieldStyle} value={userForm.program_id} onChange={e => setUserForm({ ...userForm, program_id: e.target.value, batch_id: '', section_id: '' })}><option value="">Select program</option>{directoryPrograms.filter(p => !userForm.department_id || String(p.department_id) === String(userForm.department_id)).map(p => <option key={p.program_id} value={p.program_id}>{p.program_code} — {p.program_name}</option>)}</select></Field><Field label="Batch"><select style={fieldStyle} value={userForm.batch_id} onChange={e => setUserForm({ ...userForm, batch_id: e.target.value, section_id: '' })}><option value="">Select batch</option>{directoryBatches.filter(b => !userForm.program_id || String(b.program_id) === String(userForm.program_id)).map(b => <option key={b.batch_id} value={b.batch_id}>{b.batch_name}</option>)}</select></Field><Field label="Semester"><input style={fieldStyle} type="number" min="1" max="20" value={userForm.current_semester} onChange={e => setUserForm({ ...userForm, current_semester: e.target.value })} /></Field><Field label="Section"><select style={fieldStyle} value={userForm.section_id} onChange={e => setUserForm({ ...userForm, section_id: e.target.value })}><option value="">Select section</option>{directorySections.filter(s => (!userForm.batch_id || String(s.batch_id) === String(userForm.batch_id)) && (!userForm.current_semester || String(s.section_name).startsWith(String(userForm.current_semester)))).map(s => <option key={s.section_id} value={s.section_id}>{s.section_name}</option>)}</select></Field></>}
          {!studentForm && userForm.user_type !== 'admin' && userForm.user_type !== 'director' && <Field label="Department"><select style={fieldStyle} value={userForm.department_id} onChange={e => setUserForm({ ...userForm, department_id: e.target.value })}><option value="">Select department</option>{directoryDepartments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_code} — {d.department_name}</option>)}</select></Field>}
          {['teacher','hod','dec','director'].includes(userForm.user_type) && <Field label="Designation"><input style={fieldStyle} value={userForm.designation} onChange={e => setUserForm({ ...userForm, designation: e.target.value })} placeholder="Faculty / Director" /></Field>}
        </div><div style={{ display: 'flex', gap: 10, marginTop: 18 }}><Btn style={adminPrimaryStyle} onClick={saveUser}>Save user</Btn><Btn variant="ghost" style={adminGhostStyle} onClick={() => setUserForm(null)}>Cancel</Btn></div></Card>}
        <Card className="admin-glass-card" style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}><thead><tr>{['Name', identifier.label, ...detailColumns.map(column => column.label), 'Email', 'Account status', 'Actions'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead><tbody>
          {visibleUsers.map(target => <tr key={target.user_id}><td style={td}><strong>{target.first_name} {target.last_name}</strong></td><td style={td}>{identifier.value(target)}</td>{detailColumns.map(column => <td key={column.label} style={td}>{column.value(target)}</td>)}<td style={td}>{target.email}</td><td style={td}><span style={{ color: target.is_active ? C.teal : C.red, fontWeight: 800 }}>{target.is_active ? 'Active' : 'Disabled'}</span></td><td style={td}><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{target.is_active ? <Btn size="sm" variant="danger" onClick={() => removeUser(target)}>Remove</Btn> : <Btn size="sm" variant="success" onClick={() => toggleUser(target)}>Restore</Btn>}<Btn size="sm" variant="ghost" onClick={() => revokeSessions(target)}>Sign out all</Btn></div></td></tr>)}
        </tbody></table>{visibleUsers.length === 0 && <p style={{ color: C.grey500 }}>No users match these filters.</p>}</Card>
      </PageWrap>
    </>;
  }

  if (activePage === 'admin-security') return (
    <><style>{adminLabsStyles}</style><PageWrap className="admin-glass-page" title="Security Audit" subtitle="Authentication, authorization, session, and rate-limit events" actions={<Btn onClick={loadSecurityEvents}>Refresh</Btn>}>
      {notice}<Card style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}><thead><tr>{['Time', 'Event', 'Outcome', 'User', 'IP address', 'Request', 'Object'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead><tbody>
        {securityEvents.map(event => <tr key={event.audit_id}><td style={td}>{new Date(event.created_at).toLocaleString()}</td><td style={{ ...td, fontFamily: 'monospace', fontWeight: 700 }}>{event.event_type}</td><td style={td}><span style={{ color: event.outcome === 'DENIED' ? C.red : C.teal, fontWeight: 800 }}>{event.outcome}</span></td><td style={td}>{event.email || 'Anonymous'}{event.user_type ? ` (${event.user_type})` : ''}</td><td style={{ ...td, fontFamily: 'monospace' }}>{event.ip_address || '—'}</td><td style={{ ...td, maxWidth: 270, wordBreak: 'break-word' }}>{event.method ? `${event.method} ` : ''}{event.request_path || '—'}</td><td style={td}>{event.object_type ? `${event.object_type}: ${event.object_id || '—'}` : '—'}</td></tr>)}
      </tbody></table>{securityEvents.length === 0 && <p style={{ color: C.grey500 }}>No security events have been recorded yet.</p>}</Card>
    </PageWrap></>
  );

  return <><style>{adminLabsStyles}</style><PageWrap className="admin-glass-page" title="Admin Control Center" subtitle="System-wide visibility and configuration">
    {notice}<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 16, marginBottom: 22 }}>
      <StatCard label="All users" value={overview.users ?? '—'} icon={Icon.users} />
      <StatCard label="Active users" value={overview.active_users ?? '—'} icon={Icon.userCheck} />
      <StatCard label="Configured labs" value={overview.labs ?? '—'} icon={Icon.server} />
      <StatCard label="All exams" value={overview.exams ?? '—'} icon={Icon.clipboardList} />
      <StatCard label="Live sessions" value={overview.active_sessions ?? '—'} icon={Icon.monitor} />
    </div>
    <Card><h3 style={{ color: C.navy, marginTop: 0 }}>Administrator access</h3><p style={{ color: C.grey500, lineHeight: 1.7, marginBottom: 0 }}>Use the sidebar to maintain lab network ranges, system-wide security defaults, and user access. Lab CIDR changes are applied by the network-validation service without changing source code.</p></Card>
  </PageWrap></>;
}

function Field({ label, help, children }) {
  return <label style={{ display: 'block' }}><span style={{ display: 'block', color: C.grey800, fontWeight: 700, fontSize: 12, marginBottom: 6, textTransform: 'capitalize' }}>{label}</span>{children}{help && <span style={{ display: 'block', color: C.grey500, fontSize: 11, marginTop: 5 }}>{help}</span>}</label>;
}

const th = { padding: '11px 12px', borderBottom: `2px solid ${C.grey200}`, textAlign: 'left', color: C.grey500, fontSize: 11, textTransform: 'uppercase' };
const td = { padding: '12px', borderBottom: `1px solid ${C.grey200}`, color: C.grey800, fontSize: 13 };
const uploadButtonStyle = { background: C.white, color: C.navy, border: `1.5px solid ${C.grey200}`, borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14, padding: '9px 20px', display: 'inline-flex', alignItems: 'center' };
