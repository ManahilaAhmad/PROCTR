import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../config/apiConfig';
import { C } from '../theme/colors';
import { Icon } from '../theme/icons';
import PageWrap from '../components/common/PageWrap';
import Card from '../components/common/Card';
import Btn from '../components/common/Btn';
import StatCard from '../components/common/StatCard';

const emptyLab = { department_id: '', lab_name: '', total_pcs: 1, capacity: 1, network_range: '', status: 'Available' };
const fieldStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${C.grey200}`, boxSizing: 'border-box', fontFamily: 'inherit', color: C.navy, background: C.white };

export default function AdminPage({ activePage, user }) {
  const [overview, setOverview] = useState({});
  const [labs, setLabs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [settings, setSettings] = useState({});
  const [definitions, setDefinitions] = useState({});
  const [users, setUsers] = useState([]);
  const [labForm, setLabForm] = useState(null);
  const [editingLabId, setEditingLabId] = useState(null);
  const [message, setMessage] = useState(null);

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API_BASE_URL}/admin${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.sessionToken || ''}`, ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Request failed.');
    return data;
  }, [user?.sessionToken]);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3500);
  };

  const loadOverview = useCallback(() => request('/overview').then(data => setOverview(data.overview)), [request]);
  const loadLabs = useCallback(() => request('/labs').then(data => { setLabs(data.labs); setDepartments(data.departments); }), [request]);
  const loadSettings = useCallback(() => request('/settings').then(data => {
    setSettings(Object.fromEntries(data.settings.map(item => [item.setting_key, item.setting_value])));
    setDefinitions(data.definitions || {});
  }), [request]);
  const loadUsers = useCallback(() => request('/users').then(data => setUsers(data.users)), [request]);

  useEffect(() => {
    const loader = activePage === 'admin-labs' ? loadLabs : activePage === 'admin-settings' ? loadSettings : activePage === 'admin-users' ? loadUsers : loadOverview;
    loader().catch(error => showMessage(error.message, 'error'));
  }, [activePage, loadLabs, loadOverview, loadSettings, loadUsers]);

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

  async function removeLab(lab) {
    if (!window.confirm(`Delete ${lab.lab_name}? Scheduled labs cannot be deleted.`)) return;
    try {
      const data = await request(`/labs/${lab.lab_id}`, { method: 'DELETE' });
      showMessage(data.message);
      await loadLabs();
    } catch (error) { showMessage(error.message, 'error'); }
  }

  async function saveSettings() {
    try {
      const data = await request('/settings', { method: 'PUT', body: JSON.stringify({ settings }) });
      showMessage(data.message);
      await loadSettings();
    } catch (error) { showMessage(error.message, 'error'); }
  }

  async function toggleUser(target) {
    try {
      const data = await request(`/users/${target.user_id}/status`, { method: 'PATCH', body: JSON.stringify({ is_active: !target.is_active }) });
      showMessage(data.message);
      await loadUsers();
    } catch (error) { showMessage(error.message, 'error'); }
  }

  const notice = message && <div style={{ marginBottom: 18, padding: '11px 14px', borderRadius: 8, background: message.type === 'error' ? C.redLight : C.tealLight, color: message.type === 'error' ? C.red : C.navy, fontWeight: 700, fontSize: 13 }}>{message.text}</div>;

  if (activePage === 'admin-labs') return (
    <PageWrap title="Lab & Network Management" subtitle="Define each physical lab, its capacity, and its authoritative CIDR range" actions={<Btn onClick={() => { setEditingLabId(null); setLabForm({ ...emptyLab, department_id: departments[0]?.department_id || '' }); }}>Add Lab</Btn>}>
      {notice}
      {labForm && <Card style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0, color: C.navy }}>{editingLabId ? 'Edit Lab' : 'Add Lab'}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
          <Field label="Lab name"><input style={fieldStyle} value={labForm.lab_name} onChange={e => setLabForm({ ...labForm, lab_name: e.target.value })} placeholder="Lab-1" /></Field>
          <Field label="Department"><select style={fieldStyle} value={labForm.department_id} onChange={e => setLabForm({ ...labForm, department_id: e.target.value })}><option value="">Select department</option>{departments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_code} — {d.department_name}</option>)}</select></Field>
          <Field label="Total PCs"><input style={fieldStyle} type="number" min="1" value={labForm.total_pcs} onChange={e => setLabForm({ ...labForm, total_pcs: Number(e.target.value) })} /></Field>
          <Field label="Exam capacity"><input style={fieldStyle} type="number" min="1" value={labForm.capacity} onChange={e => setLabForm({ ...labForm, capacity: Number(e.target.value) })} /></Field>
          <Field label="Network CIDR"><input style={fieldStyle} value={labForm.network_range} onChange={e => setLabForm({ ...labForm, network_range: e.target.value })} placeholder="192.168.18.0/24" /></Field>
          <Field label="Status"><select style={fieldStyle} value={labForm.status} onChange={e => setLabForm({ ...labForm, status: e.target.value })}>{['Available', 'InUse', 'Maintenance'].map(s => <option key={s}>{s}</option>)}</select></Field>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}><Btn onClick={saveLab}>Save Lab</Btn><Btn variant="ghost" onClick={() => setLabForm(null)}>Cancel</Btn></div>
      </Card>}
      <Card style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}><thead><tr>{['Lab', 'Department', 'PCs', 'Capacity', 'Network range', 'Status', 'Actions'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{labs.map(lab => <tr key={lab.lab_id}><td style={td}><strong>{lab.lab_name}</strong></td><td style={td}>{lab.department_code}</td><td style={td}>{lab.total_pcs}</td><td style={td}>{lab.capacity}</td><td style={{ ...td, fontFamily: 'monospace', fontWeight: 700 }}>{lab.network_range}</td><td style={td}>{lab.status}</td><td style={td}><div style={{ display: 'flex', gap: 8 }}><Btn size="sm" variant="ghost" onClick={() => { setEditingLabId(lab.lab_id); setLabForm({ ...lab }); }}>Edit</Btn><Btn size="sm" variant="danger" onClick={() => removeLab(lab)}>Delete</Btn></div></td></tr>)}</tbody>
        </table>
        {labs.length === 0 && <p style={{ color: C.grey500 }}>No labs configured.</p>}
      </Card>
    </PageWrap>
  );

  if (activePage === 'admin-settings') return (
    <PageWrap title="System Configuration" subtitle="Central security defaults used by exam and desktop services" actions={<Btn onClick={saveSettings}>Save Settings</Btn>}>
      {notice}<Card><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18 }}>
        {Object.entries(definitions).map(([key, definition]) => <Field key={key} label={key.replaceAll('_', ' ')} help={definition.description}>
          {definition.type === 'boolean' ? <select style={fieldStyle} value={String(Boolean(settings[key]))} onChange={e => setSettings({ ...settings, [key]: e.target.value === 'true' })}><option value="false">Disabled</option><option value="true">Enabled</option></select> : <input style={fieldStyle} type={definition.type === 'integer' ? 'number' : 'text'} min={definition.min} max={definition.max} value={settings[key] ?? ''} onChange={e => setSettings({ ...settings, [key]: definition.type === 'integer' ? Number(e.target.value) : e.target.value })} />}
        </Field>)}
      </div></Card>
    </PageWrap>
  );

  if (activePage === 'admin-users') return (
    <PageWrap title="User Administration" subtitle="View accounts and immediately enable or disable access">
      {notice}<Card style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}><thead><tr>{['Name', 'Email', 'Role', 'Status', 'Last login', 'Action'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead><tbody>
        {users.map(target => <tr key={target.user_id}><td style={td}><strong>{target.first_name} {target.last_name}</strong></td><td style={td}>{target.email}</td><td style={{ ...td, textTransform: 'capitalize' }}>{target.user_type}</td><td style={td}><span style={{ color: target.is_active ? C.teal : C.red, fontWeight: 800 }}>{target.is_active ? 'Active' : 'Disabled'}</span></td><td style={td}>{target.last_login_at ? new Date(target.last_login_at).toLocaleString() : 'Never'}</td><td style={td}><Btn size="sm" variant={target.is_active ? 'danger' : 'success'} onClick={() => toggleUser(target)}>{target.is_active ? 'Disable' : 'Enable'}</Btn></td></tr>)}
      </tbody></table></Card>
    </PageWrap>
  );

  return <PageWrap title="Admin Control Center" subtitle="System-wide visibility and configuration">
    {notice}<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 16, marginBottom: 22 }}>
      <StatCard label="All users" value={overview.users ?? '—'} icon={Icon.users} />
      <StatCard label="Active users" value={overview.active_users ?? '—'} icon={Icon.userCheck} />
      <StatCard label="Configured labs" value={overview.labs ?? '—'} icon={Icon.server} />
      <StatCard label="All exams" value={overview.exams ?? '—'} icon={Icon.clipboardList} />
      <StatCard label="Live sessions" value={overview.active_sessions ?? '—'} icon={Icon.monitor} />
    </div>
    <Card><h3 style={{ color: C.navy, marginTop: 0 }}>Administrator access</h3><p style={{ color: C.grey500, lineHeight: 1.7, marginBottom: 0 }}>Use the sidebar to maintain lab network ranges, system-wide security defaults, and user access. Lab CIDR changes are applied by the network-validation service without changing source code.</p></Card>
  </PageWrap>;
}

function Field({ label, help, children }) {
  return <label style={{ display: 'block' }}><span style={{ display: 'block', color: C.grey800, fontWeight: 700, fontSize: 12, marginBottom: 6, textTransform: 'capitalize' }}>{label}</span>{children}{help && <span style={{ display: 'block', color: C.grey500, fontSize: 11, marginTop: 5 }}>{help}</span>}</label>;
}

const th = { padding: '11px 12px', borderBottom: `2px solid ${C.grey200}`, textAlign: 'left', color: C.grey500, fontSize: 11, textTransform: 'uppercase' };
const td = { padding: '12px', borderBottom: `1px solid ${C.grey200}`, color: C.grey800, fontSize: 13 };
