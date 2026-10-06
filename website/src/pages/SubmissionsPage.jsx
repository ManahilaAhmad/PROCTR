import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import { API_BASE_URL } from "../config/apiConfig";
import { C } from "../theme/colors";
import PageWrap from "../components/common/PageWrap";
import Card from "../components/common/Card";
import Btn from "../components/common/Btn";

const submissionsAdminStyles = `
  @keyframes submissionsAdminRise {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .admin-glass-page {
    position: relative;
    isolation: isolate;
    z-index: 0;
    background: transparent !important;
    min-width: 0;
  }
  .admin-glass-page::before {
    content: '';
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background:
      radial-gradient(circle at 16% 18%, rgba(255,255,255,.92), transparent 28%),
      radial-gradient(circle at 84% 12%, rgba(85,121,135,.16), transparent 24%),
      linear-gradient(90deg, #ffffff 0%, #ffffff 42%, #eef7fa 58%, #c3d8e4 100%);
  }
  .admin-glass-page .resp-page-padding {
    max-width: 1440px;
    margin: 0 auto;
  }
  .admin-glass-page h1 {
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif !important;
    color: #557987 !important;
    letter-spacing: -.5px !important;
    font-size: 30px !important;
  }
  .admin-glass-page .admin-glass-card {
    background: linear-gradient(145deg, rgba(255,255,255,.78), rgba(255,255,255,.56)) !important;
    border: 1px solid rgba(255,255,255,.86) !important;
    box-shadow: 0 22px 55px rgba(41,91,117,.16), inset 0 1px 0 rgba(255,255,255,.96) !important;
    backdrop-filter: blur(20px) saturate(135%);
    -webkit-backdrop-filter: blur(20px) saturate(135%);
    animation: submissionsAdminRise .4s ease both;
  }
  .admin-glass-page .admin-glass-card button {
    border-radius: 11px !important;
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif !important;
  }
  .admin-glass-page .admin-glass-folder {
    background: rgba(255,255,255,.42) !important;
    border: 1px solid rgba(255,255,255,.9) !important;
    box-shadow: 0 7px 22px rgba(63,145,177,.12);
    backdrop-filter: blur(10px);
    transition: transform .18s ease, box-shadow .18s ease;
  }
  .admin-glass-page .admin-glass-folder:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 28px rgba(41,91,117,.18);
  }
  .admin-glass-page table thead th {
    color: #557987 !important;
    border-bottom-color: rgba(255,255,255,.9) !important;
    font-size: 11px;
    letter-spacing: .5px;
    text-transform: uppercase;
  }
  .admin-glass-page table tbody tr:hover {
    background: rgba(255,255,255,.34);
  }
  .admin-glass-page table td {
    border-bottom-color: rgba(255,255,255,.65) !important;
  }
`;

function buildFileTree(files) {
  const root = { children: {} };
  files.forEach((file, index) => {
    const relativePath = file.relative_path || file.relativePath || file.name || `unnamed-file-${index + 1}`;
    const displayFile = { ...file, relative_path: relativePath, file_size: file.file_size ?? file.fileSize ?? file.size ?? 0 };
    const segments = relativePath.replace(/\\/g, "/").split("/").filter(Boolean);
    if (!segments.length) segments.push(`unnamed-file-${index + 1}`);
    let node = root;
    segments.forEach((segment, index) => {
      node.children[segment] ||= {
        name: segment,
        path: segments.slice(0, index + 1).join("/"),
        children: {},
      };
      node = node.children[segment];
      if (index === segments.length - 1) node.file = displayFile;
    });
  });
  return Object.values(root.children);
}

function SubmissionFileTree({ files, renderFile }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const nodes = buildFileTree(files);

  function renderNodes(items, depth = 0) {
    const folders = items.filter(node => !node.file);
    const fileNodes = items.filter(node => node.file);
    return (
      <>
        {fileNodes.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12, padding: 14, paddingLeft: 14 + depth * 18 }}>
            {fileNodes.map(node => renderFile(node.file, depth))}
          </div>
        )}
        {folders.map(node => {
      const isOpen = expanded.has(node.path);
      return (
        <div key={node.path}>
          <button
            type="button"
            onClick={() => setExpanded(current => {
              const next = new Set(current);
              if (next.has(node.path)) next.delete(node.path);
              else next.add(node.path);
              return next;
            })}
            style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "11px 12px", paddingLeft: 12 + depth * 22, border: 0, borderBottom: `1px solid ${C.grey100}`, background: "rgba(255,255,255,.26)", color: "#557987", textAlign: "left", cursor: "pointer", fontWeight: 700 }}
          >
            <span aria-hidden="true">{isOpen ? "📂" : "📁"}</span>
            {node.name}
            <span style={{ marginLeft: "auto", color: C.grey400, fontSize: 11 }}>{isOpen ? "−" : "+"}</span>
          </button>
          {isOpen && renderNodes(Object.values(node.children), depth + 1)}
        </div>
      );
        })}
      </>
    );
  }

  return <div style={{ overflow: "hidden", border: `1px solid ${C.grey200}`, borderRadius: 10 }}>{renderNodes(nodes)}</div>;
}

function SubmissionFileCard({ file, onOpen, onDownload, busy }) {
  const name = file.relative_path.split("/").pop();
  const extension = name.split(".").pop()?.toLowerCase();
  const isEmpty = Number(file.file_size) === 0;
  const fileIcon = extension === "docx" || extension === "doc"
    ? { label: "W", background: "#e7f0fb", color: "#2b579a" }
    : extension === "zip"
      ? { label: "ZIP", background: "#fff4dc", color: "#9a6700" }
      : ["cpp", "cc", "cxx", "c", "h", "hpp"].includes(extension)
        ? { label: "C++", background: "#e9e9ff", color: "#5146a5" }
        : { label: extension && extension.length <= 5 ? extension.toUpperCase() : "FILE", background: "#eef2f6", color: "#557987" };

  return (
    <div style={{ minWidth: 0, padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,.9)", background: "rgba(255,255,255,.56)", boxShadow: "0 7px 22px rgba(41,91,117,.08)", textAlign: "center" }}>
      <button
        type="button"
        onClick={onOpen}
        title={isEmpty ? "This submitted file is empty and cannot be opened." : `Open ${name}`}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: "100%", padding: 6, border: 0, background: "transparent", color: "#557987", cursor: busy ? "wait" : "pointer", opacity: isEmpty ? .72 : 1 }}
      >
        <span aria-hidden="true" style={{ display: "grid", placeItems: "center", width: 54, height: 62, borderRadius: 9, background: fileIcon.background, color: fileIcon.color, fontSize: fileIcon.label.length > 2 ? 12 : 15, fontWeight: 800 }}>
          {fileIcon.label}
        </span>
        <strong style={{ width: "100%", overflowWrap: "anywhere", fontSize: 12, lineHeight: 1.35 }}>{name}</strong>
        <span style={{ color: isEmpty ? C.red : C.grey500, fontSize: 11 }}>
          {`${Number(file.file_size || 0).toLocaleString()} bytes${isEmpty ? " · Empty file" : ""}`}
        </span>
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onDownload}
        style={{ marginTop: 7, padding: "6px 10px", border: `1px solid ${C.grey200}`, borderRadius: 8, background: "rgba(255,255,255,.7)", color: C.grey500, fontSize: 11, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}
      >
        Download
      </button>
    </div>
  );
}

function WordPreview({ blob }) {
  const bodyRef = useRef(null);
  const styleRef = useRef(null);
  const [renderError, setRenderError] = useState(null);

  useEffect(() => {
    const body = bodyRef.current;
    const styles = styleRef.current;
    if (!body || !styles) return undefined;
    let disposed = false;
    body.replaceChildren();
    styles.replaceChildren();

    renderAsync(blob, body, styles, {
      className: "submitted-docx",
      renderAltChunks: false,
      renderComments: false,
    }).catch(renderError => {
      if (!disposed) setRenderError({ blob, message: renderError.message || "Could not preview this Word document." });
    });

    return () => {
      disposed = true;
      body.replaceChildren();
      styles.replaceChildren();
    };
  }, [blob]);

  return (
    <div style={{ marginTop: 12, maxHeight: "70vh", overflow: "auto", padding: 16, borderRadius: 10, background: "#e9eef1" }}>
      {renderError?.blob === blob && <p role="alert" style={{ color: C.red, margin: "0 0 12px" }}>{renderError.message}</p>}
      <div ref={styleRef} />
      <div ref={bodyRef} style={{ minHeight: 180 }} />
    </div>
  );
}

export default function SubmissionsPage({ user }) {
  const isTeacher = user?.userType === "teacher";
  const ownerId = isTeacher ? user?.teacherId : user?.studentId;
  const [lab, setLab] = useState(null);
  const [course, setCourse] = useState(null);
  const [student, setStudent] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const prefix = `/submission/${isTeacher ? "teacher" : "student"}/${ownerId}`;
  const endpoint = !lab ? `${prefix}/labs`
    : isTeacher && !student ? `${prefix}/lab/${lab.course_offering_id}/students`
      : isTeacher ? `${prefix}/lab/${lab.course_offering_id}/student/${student.student_id}/files`
        : `${prefix}/submission/${lab.submission_id}/files`;

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
  }, [endpoint, ownerId, user?.sessionToken]);

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
      } else if (blob.size === 0) {
        setPreview({ name, empty: true });
      } else if (name === "security_log_report.html") {
        setPreview({ name, html: await blob.text() });
      } else if (/\.docx$/i.test(name)) {
        setPreview({ name, docx: blob });
      } else if (/\.(txt|py|java|js|ts|jsx|tsx|c|cc|cpp|cxx|h|hh|hpp|hxx|cs|sql|json|md|csv|xml|css|log)$/i.test(name)) {
        setPreview({ name, text: await blob.text() });
      } else if (/\.(pdf|png|jpg|jpeg|gif|webp|html?)$/i.test(name)) {
        setPreview({ name, url: URL.createObjectURL(blob) });
      } else {
        setPreview({ name, unsupported: true });
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
    setSelectedSubmissionId(null);
    setData(null);
    setPreview(null);
    setError("");
  }

  function openCourse(nextCourse) {
    setCourse(nextCourse);
    setSelectedSubmissionId(null);
    setPreview(null);
    setError("");
  }

  if (!ownerId) {
    return <><style>{submissionsAdminStyles}</style><PageWrap className="admin-glass-page" title={isTeacher ? "Submitted Exams" : "Submitted Work"} subtitle="Confirmed exam submissions"><Card className="admin-glass-card">Profile information is unavailable. Please sign in again.</Card></PageWrap></>;
  }

  const ownershipParam = `${isTeacher ? "teacherId" : "studentId"}=${encodeURIComponent(ownerId)}`;
  const studentCourses = !isTeacher && data
    ? data.courses || Object.values((data.labs || []).reduce((groups, item) => {
      const label = (item.label || item.course_code || "Course").split(" · ")[0];
      const key = item.course_offering_id || label;
      if (!groups[key]) {
        groups[key] = {
          course_id: key,
          course_code: label.split(" — ")[0],
          course_title: label,
          label,
          submissions: [],
        };
      }
      groups[key].submissions.push(item);
      return groups;
    }, {}))
    : [];
  const teacherSubmissions = isTeacher && student && data
    ? data.submissions ?? (data.submission && Array.isArray(data.files) ? [{
    ...data.submission,
    exam_type: data.submission.exam_type || data.submission.label || "Exam submission",
    files: data.files,
    has_report: Boolean(data.submission.has_report),
    migration_required: false,
    }] : null)
    : null;
  return (
    <>
    <style>{submissionsAdminStyles}</style>
    <PageWrap className="admin-glass-page" title={isTeacher ? "Submitted Exams" : "Submitted Work"} subtitle={isTeacher ? "Review student solutions and security reports" : "Review your confirmed exam submissions"}>
      {(lab || course || student) && <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        {isTeacher && lab && <Btn variant="ghost" onClick={() => navigate(null)}>All labs</Btn>}
        {!isTeacher && lab && <Btn variant="ghost" onClick={() => { setLab(null); setPreview(null); setError(""); }}>Back to course folder</Btn>}
        {!isTeacher && course && !lab && <Btn variant="ghost" onClick={() => openCourse(null)}>All courses</Btn>}
        {isTeacher && student && selectedSubmissionId && <Btn variant="ghost" onClick={() => { setSelectedSubmissionId(null); setPreview(null); }}>Back to submissions</Btn>}
        {isTeacher && student && !selectedSubmissionId && <Btn variant="ghost" onClick={() => navigate(lab)}>Back to students</Btn>}
      </div>}

      {error && <div role="alert" style={{ color: C.red, background: C.redLight, padding: 14, borderRadius: 9, marginBottom: 16 }}>{error}</div>}
      {!data && !error && <Card className="admin-glass-card">Loading submissions…</Card>}
      {data && <Card className="admin-glass-card">
        {course && !isTeacher && <h3 style={{ color: C.navy, marginTop: 0 }}>{course.label}</h3>}
        {lab && <h3 style={{ color: C.navy, marginTop: 0 }}>{isTeacher ? lab.label || lab.course_code : lab.label}{student ? ` — ${student.name}` : ""}</h3>}
        {!isTeacher && !course && (studentCourses.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 14 }}>
            {studentCourses.map(item => (
              <button
                key={item.course_id}
                type="button"
                onClick={() => openCourse(item)}
                className="admin-glass-folder"
                style={{ textAlign: "left", cursor: "pointer", padding: 18, borderRadius: 11, color: "#557987", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}
              >
                <span aria-hidden="true" style={{ display: "block", fontSize: 28, marginBottom: 8 }}>📁</span>
                <strong>{item.course_code}</strong>
                <span style={{ display: "block", marginTop: 5, color: C.grey500 }}>{item.course_title}</span>
                <span style={{ display: "block", marginTop: 10, color: C.grey500 }}>{item.submissions.length} submissions</span>
              </button>
            ))}
          </div>
        ) : <p>You are not currently enrolled in any courses.</p>)}
        {!isTeacher && course && !lab && (course.submissions.length ? course.submissions.map(item => (
          <section key={item.submission_id} style={{ padding: "16px 0", borderBottom: `1px solid ${C.grey100}` }}>
            <h4 style={{ color: C.navy, margin: "0 0 5px" }}>{item.label}</h4>
            <p style={{ color: C.grey500, margin: "0 0 12px", fontSize: 13 }}>
              Submitted {new Date(item.submitted_at).toLocaleString()}
            </p>
            {item.files_unavailable
              ? <p role="alert" style={{ color: C.red }}>{item.files_unavailable}</p>
              : !item.files?.length
                ? <p style={{ color: C.grey500 }}>No files in this submission.</p>
              : <SubmissionFileTree files={item.files} renderFile={file => {
                const fileUrl = `/submission/file/${item.submission_id}?relativePath=${encodeURIComponent(file.relative_path)}&${ownershipParam}`;
                return <SubmissionFileCard key={file.relative_path} file={file} busy={busy} onOpen={() => openFile(fileUrl, file.relative_path)} onDownload={() => openFile(`${fileUrl}&download=true`, file.relative_path, true)} />;
              }} />}
          </section>
        )) : <p>No submissions in this course yet.</p>)}
        {isTeacher && data.labs && (data.labs.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 12 }}>
            {data.labs.map(item => (
              <button key={item.course_offering_id} type="button" onClick={() => navigate(item)} className="admin-glass-folder"
                style={{ textAlign: "left", cursor: "pointer", padding: 18, borderRadius: 11, color: "#557987", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
                <span aria-hidden="true" style={{ display: "block", fontSize: 26, marginBottom: 8 }}>📁</span>
                <strong>{item.course_code}</strong>
                <span style={{ display: "block", marginTop: 5, color: C.grey500 }}>{item.label}</span>
                <span style={{ display: "block", marginTop: 8, color: C.grey500 }}>{item.submission_count} submission{item.submission_count === 1 ? "" : "s"}</span>
              </button>
            ))}
          </div>
        ) : <p>No courses are assigned to you yet.</p>)}
        {isTeacher && data.students && (data.students.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 12 }}>
            {data.students.map(item => (
              <button key={item.student_id} type="button" onClick={() => navigate(lab, item)} className="admin-glass-folder"
                style={{ textAlign: "left", cursor: "pointer", padding: 18, borderRadius: 11, color: "#557987", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
                <span aria-hidden="true" style={{ display: "block", fontSize: 26, marginBottom: 8 }}>📁</span>
                <strong>{item.registration_no} — {item.name}</strong>
                <span style={{ display: "block", marginTop: 7, color: C.grey500 }}>{item.submission_count} submission{item.submission_count === 1 ? "" : "s"} · {item.file_count} files in latest</span>
                {item.migration_required && <span style={{ display: "block", marginTop: 7, color: C.red, fontSize: 12 }}>Older submission needs Cloudinary migration</span>}
              </button>
            ))}
          </div>
        ) : <p>No students have submitted to this lab yet.</p>)}
        {teacherSubmissions && (() => {
          const selectedSubmission = teacherSubmissions.find(item => String(item.submission_id) === String(selectedSubmissionId));
          if (!selectedSubmission) {
            return teacherSubmissions.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                {teacherSubmissions.map(item => (
                  <button key={item.submission_id} type="button" onClick={() => setSelectedSubmissionId(item.submission_id)} className="admin-glass-folder"
                    style={{ textAlign: "left", cursor: "pointer", padding: 18, borderRadius: 11, color: "#557987", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
                    <span aria-hidden="true" style={{ display: "block", fontSize: 25, marginBottom: 8 }}>📁</span>
                    <strong>{item.exam_type || "Exam submission"}</strong>
                    <span style={{ display: "block", marginTop: 7, color: C.grey500 }}>{new Date(item.submitted_at).toLocaleString()}</span>
                    <span style={{ display: "block", marginTop: 7, color: C.grey500 }}>{item.files?.length || 0} files{item.has_report ? " · security report" : ""}</span>
                    {item.migration_required && <span style={{ display: "block", marginTop: 7, color: C.red, fontSize: 12 }}>Requires Cloudinary migration</span>}
                  </button>
                ))}
              </div>
            ) : <p>No submissions found for this student.</p>;
          }
          const selectedFiles = selectedSubmission.files || [];
          return (
            <section>
              <h4 style={{ color: "#557987", margin: "0 0 6px" }}>{selectedSubmission.exam_type || "Exam submission"}</h4>
              <p style={{ color: C.grey500, margin: "0 0 14px", fontSize: 13 }}>Submitted {new Date(selectedSubmission.submitted_at).toLocaleString()}</p>
              {selectedSubmission.migration_required
                ? <p role="alert" style={{ color: C.red }}>This older submission must be migrated to Cloudinary before its files can be accessed.</p>
                : selectedFiles.length
                  ? <SubmissionFileTree files={selectedFiles} renderFile={file => {
                    const fileUrl = `/submission/file/${selectedSubmission.submission_id}?relativePath=${encodeURIComponent(file.relative_path)}&${ownershipParam}`;
                    return <SubmissionFileCard key={file.relative_path} file={file} busy={busy} onOpen={() => openFile(fileUrl, file.relative_path)} onDownload={() => openFile(`${fileUrl}&download=true`, file.relative_path, true)} />;
                  }} />
                  : <p>This submission contains no work files.</p>}
              {selectedSubmission.has_report && <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                <Btn disabled={busy} onClick={() => openFile(`${prefix}/report/${selectedSubmission.submission_id}`, "security_log_report.html")}>Open security report</Btn>
                <Btn variant="ghost" disabled={busy} onClick={() => openFile(`${prefix}/report/${selectedSubmission.submission_id}?download=true`, "security_log_report.html", true)}>Download report</Btn>
              </div>}
            </section>
          );
        })()}
        {!isTeacher && data.files && <>
          <p style={{ color: C.grey500 }}>Submitted: {new Date(data.submission?.submitted_at || data.submitted_at).toLocaleString()}</p>
          {!data.files.length ? <p>This submission contains no work files.</p> : <SubmissionFileTree files={data.files} renderFile={file => {
            const fileUrl = `/submission/file/${data.submission?.submission_id || file.submission_id}?relativePath=${encodeURIComponent(file.relative_path)}&${ownershipParam}`;
            return <SubmissionFileCard key={file.relative_path} file={file} busy={busy} onOpen={() => openFile(fileUrl, file.relative_path)} onDownload={() => openFile(`${fileUrl}&download=true`, file.relative_path, true)} />;
          }} />}
        </>}
      </Card>}

      {preview && <Card className="admin-glass-card" style={{ marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}><h3>{preview.name}</h3><Btn variant="ghost" onClick={() => setPreview(null)}>Close preview</Btn></div>
        {preview.empty
          ? <div role="status" style={{ marginTop: 12, padding: 24, borderRadius: 10, background: "rgba(255,255,255,.58)", color: C.grey600, textAlign: "center" }}>
            <strong style={{ display: "block", color: "#557987", marginBottom: 6 }}>This file is present, but it is empty.</strong>
            <span>The submitted copy is 0 bytes, so there is no document content to preview. The file remains listed above and can still be downloaded.</span>
          </div>
          : preview.unsupported
            ? <div role="status" style={{ marginTop: 12, padding: 24, borderRadius: 10, background: "rgba(255,255,255,.58)", color: C.grey600, textAlign: "center" }}>
              <strong style={{ display: "block", color: "#557987", marginBottom: 6 }}>This file type cannot be previewed in the browser.</strong>
              <span>The file is still available above. Download it to open it with a compatible application.</span>
            </div>
            : preview.text !== undefined ? <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{preview.text}</pre>
          : preview.docx !== undefined
            ? <WordPreview blob={preview.docx} />
            : preview.html !== undefined
            ? <iframe title={preview.name} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={preview.html} style={{ width: "100%", height: "65vh", marginTop: 12, border: 0 }} />
            : <iframe title={preview.name} sandbox="allow-scripts" referrerPolicy="no-referrer" src={preview.url} style={{ width: "100%", height: "65vh", marginTop: 12, border: 0 }} />}
      </Card>}
    </PageWrap>
    </>
  );
}
