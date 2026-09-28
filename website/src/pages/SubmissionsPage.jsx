import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config/apiConfig';
import PageWrap from '../components/common/PageWrap';
import Card from '../components/common/Card';
import Btn from '../components/common/Btn';

export default function SubmissionsPage({ user }) {
  const teacher = user?.userType === 'teacher';
  const owner = teacher ? user.teacherId : user.studentId;
  const [lab, setLab] = useState(null);
  const [student, setStudent] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const [preview, setPreview] = useState(null);
  const prefix = `/submission/${teacher ? 'teacher' : 'student'}/${owner}`;
  const endpoint = !lab ? `${prefix}/labs` : teacher && !student
    ? `${prefix}/lab/${lab.course_offering_id}/students`
    : teacher ? `${prefix}/lab/${lab.course_offering_id}/student/${student.student_id}/files`
      : `${prefix}/lab/${lab.course_offering_id}/files`;

  useEffect(() => {
    const abort = new AbortController();
    fetch(`${API_BASE_URL}${endpoint}`, {
      headers: { Authorization: `Bearer ${user?.accessToken || ''}` }, signal: abort.signal
    }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Could not load submissions.');
      if (!abort.signal.aborted) { setData(result); setError(''); }
    }).catch(err => { if (!abort.signal.aborted) { setError(err.message); setData(null); } });
    return () => abort.abort();
  }, [endpoint, user?.accessToken, version]);

  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview]);

  async function openFile(endpoint, name, download) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, { headers: { Authorization: `Bearer ${user.accessToken || ''}` } });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || 'Could not retrieve the file.');
      }
      const blob = await response.blob();
      if (download) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = name.split('/').pop(); link.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      } else if (/\.(txt|py|java|js|ts|jsx|tsx|c|cpp|h|cs|sql|json|md|csv|xml|css|log)$/i.test(name)) {
        setPreview({ name, text: await blob.text() });
      } else if (/\.(pdf|png|jpg|jpeg|gif|webp|html?)$/i.test(name)) {
        setPreview({ name, url: URL.createObjectURL(blob) });
      } else {
        setError('Preview is not available for this file type. Use Download to open it on your computer.');
      }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  function navigate(nextLab, nextStudent = null) {
    setLab(nextLab); setStudent(nextStudent); setData(null); setPreview(null); setError('');
  }
  const tableStyle = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
  return <PageWrap title="Submitted Work" subtitle="Confirmed submissions stored in Cloudinary">
    <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
      {lab && <Btn onClick={() => navigate(null)}>All labs</Btn>}
      {student && <Btn onClick={() => navigate(lab)}>Back to students</Btn>}
      <Btn onClick={() => { setData(null); setVersion(v => v + 1); }}>Refresh</Btn>
    </div>
    {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
    {!data && !error && <p>Loading submissions…</p>}
    {data && <Card>
      {lab && <h3>{lab.label || lab.course_code}{student ? ` — ${student.name}` : ''}</h3>}
      {data.labs && (data.labs.length ? data.labs.map(item => <p key={item.course_offering_id}>
        <Btn onClick={() => navigate(item)}>{item.label}{teacher ? ` (${item.submission_count})` : ''}</Btn>
      </p>) : <p>No confirmed submissions yet.</p>)}
      {data.students && (data.students.length ? data.students.map(item => <p key={item.student_id}>
        <Btn onClick={() => navigate(lab, item)}>{item.registration_no} — {item.name} ({item.file_count} files)</Btn>
      </p>) : <p>No students have submitted to this lab yet.</p>)}
      {data.files && <>
        <p>Submitted: {new Date(data.submission?.submitted_at || data.submitted_at).toLocaleString()}</p>
        {!data.files.length ? <p>This submission contains no work files.</p> : <table style={tableStyle}>
          <thead><tr><th>File</th><th>Size</th><th>Actions</th></tr></thead>
          <tbody>{data.files.map(file => {
            const url = `/submission/file/${data.submission?.submission_id || file.submission_id}?relativePath=${encodeURIComponent(file.relative_path)}`;
            return <tr key={file.relative_path}><td style={{ padding: '12px 0', overflowWrap: 'anywhere' }}>{file.relative_path}</td>
              <td>{file.file_size.toLocaleString()} bytes</td><td>
                <Btn disabled={busy} onClick={() => openFile(url, file.relative_path, false)}>Open</Btn>{' '}
                <Btn disabled={busy} onClick={() => openFile(`${url}&download=true`, file.relative_path, true)}>Download</Btn>
              </td></tr>;
          })}</tbody>
        </table>}
        {teacher && data.submission?.has_report && <p>
          <Btn disabled={busy} onClick={() => openFile(`${prefix}/report/${data.submission.submission_id}`, 'security_log_report.html', false)}>Security report</Btn>{' '}
          <Btn disabled={busy} onClick={() => openFile(`${prefix}/report/${data.submission.submission_id}?download=true`, 'security_log_report.html', true)}>Download report</Btn>
        </p>}
      </>}
    </Card>}
    {preview && <Card>
      <h3>{preview.name}</h3><Btn onClick={() => setPreview(null)}>Close preview</Btn>
      {preview.text !== undefined ? <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{preview.text}</pre>
        : <iframe title={preview.name} sandbox="allow-scripts" src={preview.url} style={{ width: '100%', height: '65vh', marginTop: 12 }} />}
    </Card>}
  </PageWrap>;
}
