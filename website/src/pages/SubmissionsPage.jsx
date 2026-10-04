import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config/apiConfig";
import { C } from "../theme/colors";
import PageWrap from "../components/common/PageWrap";
import Card from "../components/common/Card";
import Btn from "../components/common/Btn";

export default function SubmissionsPage({ user }) {
  const isTeacher = user?.userType === "teacher";
  const ownerId = isTeacher ? user?.teacherId : user?.studentId;
  const [lab, setLab] = useState(null);
  const [student, setStudent] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const [preview, setPreview] = useState(null);
  const prefix = `/submission/${isTeacher ? "teacher" : "student"}/${ownerId}`;
  const endpoint = !lab ? `${prefix}/labs`
    : isTeacher && !student ? `${prefix}/lab/${lab.course_offering_id}/students`
      : isTeacher ? `${prefix}/lab/${lab.course_offering_id}/student/${student.student_id}/files`
        : `${prefix}/lab/${lab.course_offering_id}/files`;

  useEffect(() => {
    if (!ownerId) return;
    const abort = new AbortController();
    fetch(`${API_BASE_URL}${endpoint}`, {
      headers: { Authorization: `Bearer ${user?.sessionToken || ""}` },
      signal: abort.signal,
    }).then(async response => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Could not load submissions.");
      if (!abort.signal.aborted) { setData(result); setError(""); }
    }).catch(fetchError => {
      if (!abort.signal.aborted) { setError(fetchError.message); setData(null); }
    });
    return () => abort.abort();
  }, [endpoint, ownerId, user?.sessionToken, version]);

  useEffect(() => () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
  }, [preview]);

  async function openFile(relativeEndpoint, name, download = false) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}${relativeEndpoint}`, {
        headers: { Authorization: `Bearer ${user?.sessionToken || ""}` },
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || "Could not retrieve the file.");
      }
      const blob = await response.blob();
      if (download) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = name.split("/").pop();
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      } else if (/\.(txt|py|java|js|ts|jsx|tsx|c|cpp|h|cs|sql|json|md|csv|xml|css|log)$/i.test(name)) {
        setPreview({ name, text: await blob.text() });
      } else if (/\.(pdf|png|jpg|jpeg|gif|webp|html?)$/i.test(name)) {
        setPreview({ name, url: URL.createObjectURL(blob) });
      } else {
        setError("Preview is unavailable for this file type. Use Download to open it on your computer.");
      }
    } catch (fileError) {
      setError(fileError.message);
    } finally {
      setBusy(false);
    }
  }

  function navigate(nextLab, nextStudent = null) {
    setLab(nextLab);
    setStudent(nextStudent);
    setData(null);
    setPreview(null);
    setError("");
  }

  if (!ownerId) {
    return <PageWrap title="Submitted Work" subtitle="Confirmed exam submissions"><Card>Profile information is unavailable. Please sign in again.</Card></PageWrap>;
  }

  const ownershipParam = `${isTeacher ? "teacherId" : "studentId"}=${encodeURIComponent(ownerId)}`;
  return (
    <PageWrap title="Submitted Work" subtitle={isTeacher ? "Review student solutions and security reports" : "Review your confirmed exam submissions"}>
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        {lab && <Btn variant="ghost" onClick={() => navigate(null)}>All labs</Btn>}
        {student && <Btn variant="ghost" onClick={() => navigate(lab)}>Back to students</Btn>}
        <Btn variant="navy" onClick={() => { setData(null); setVersion(value => value + 1); }}>Refresh</Btn>
      </div>

      {error && <div role="alert" style={{ color: C.red, background: C.redLight, padding: 14, borderRadius: 9, marginBottom: 16 }}>{error}</div>}
      {!data && !error && <Card>Loading submissions…</Card>}
      {data && <Card>
        {lab && <h3 style={{ color: C.navy, marginTop: 0 }}>{lab.label || lab.course_code}{student ? ` — ${student.name}` : ""}</h3>}
        {data.labs && (data.labs.length ? data.labs.map(item => (
          <div key={item.course_offering_id} style={{ padding: "12px 0", borderBottom: `1px solid ${C.grey100}` }}>
            <Btn variant="ghost" onClick={() => navigate(item)}>{item.label}{isTeacher ? ` (${item.submission_count})` : ""}</Btn>
          </div>
        )) : <p>No confirmed submissions yet.</p>)}
        {data.students && (data.students.length ? data.students.map(item => (
          <div key={item.student_id} style={{ padding: "12px 0", borderBottom: `1px solid ${C.grey100}` }}>
            <Btn variant="ghost" onClick={() => navigate(lab, item)}>{item.registration_no} — {item.name} ({item.file_count} files)</Btn>
          </div>
        )) : <p>No students have submitted to this lab yet.</p>)}
        {data.files && <>
          <p style={{ color: C.grey500 }}>Submitted: {new Date(data.submission?.submitted_at || data.submitted_at).toLocaleString()}</p>
          {!data.files.length ? <p>This submission contains no work files.</p> : (
            <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead><tr><th style={{ padding: 10 }}>File</th><th>Size</th><th>Actions</th></tr></thead>
              <tbody>{data.files.map(file => {
                const separator = ownershipParam ? "&" : "?";
                const fileUrl = `/submission/file/${data.submission?.submission_id || file.submission_id}?relativePath=${encodeURIComponent(file.relative_path)}${separator}${ownershipParam}`;
                return <tr key={file.relative_path} style={{ borderTop: `1px solid ${C.grey100}` }}>
                  <td style={{ padding: 12, overflowWrap: "anywhere" }}>{file.relative_path}</td>
                  <td>{Number(file.file_size || 0).toLocaleString()} bytes</td>
                  <td><Btn size="sm" disabled={busy} onClick={() => openFile(fileUrl, file.relative_path)}>Open</Btn>{" "}<Btn size="sm" variant="ghost" disabled={busy} onClick={() => openFile(`${fileUrl}&download=true`, file.relative_path, true)}>Download</Btn></td>
                </tr>;
              })}</tbody>
            </table></div>
          )}
          {isTeacher && data.submission?.has_report && <p>
            <Btn disabled={busy} onClick={() => openFile(`${prefix}/report/${data.submission.submission_id}`, "security_log_report.html")}>Security report</Btn>{" "}
            <Btn variant="ghost" disabled={busy} onClick={() => openFile(`${prefix}/report/${data.submission.submission_id}?download=true`, "security_log_report.html", true)}>Download report</Btn>
          </p>}
        </>}
      </Card>}

      {preview && <Card style={{ marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}><h3>{preview.name}</h3><Btn variant="ghost" onClick={() => setPreview(null)}>Close preview</Btn></div>
        {preview.text !== undefined ? <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{preview.text}</pre>
          : <iframe title={preview.name} sandbox="allow-scripts" src={preview.url} style={{ width: "100%", height: "65vh", marginTop: 12, border: 0 }} />}
      </Card>}
    </PageWrap>
  );
}
