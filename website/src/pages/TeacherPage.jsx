import { useState, useEffect, useRef } from "react";
import { C } from "../theme/colors";
import { Icon } from "../theme/icons";
import PageWrap from "../components/common/PageWrap";
import Tabs from "../components/common/Tabs";
import Card from "../components/common/Card";
import Btn from "../components/common/Btn";
import Input from "../components/common/Input";
import Select from "../components/common/Select";
import StatCard from "../components/common/StatCard";
import Table from "../components/common/Table";
import Badge from "../components/common/Badge";
import NotificationBell from "../components/common/NotificationBell";
import WhitelistBuilder from "../components/common/WhitelistBuilder";


// ── Main Component ─────────────────────────────────────────────────────────
export default function TeacherPage({ activePage, setPage, user }) {
  const initTab = activePage === "upload" ? "upload" : activePage === "inv-schedule" ? "invigilation" : "exams";
  const [activeTab, setActiveTab] = useState(initTab);

  useEffect(() => {
    const target = activePage === "upload" ? "upload" : activePage === "inv-schedule" ? "invigilation" : "exams";
    setActiveTab(target);
  }, [activePage]);

  const [exams, setExams] = useState([]);
  const [invigilatorAssignments, setInvigilatorAssignments] = useState([]);
  const [teachersPool, setTeachersPool] = useState([]);
  const [mySwaps, setMySwaps] = useState([]);
  const [incomingSwaps, setIncomingSwaps] = useState([]);
  const [myCourses, setMyCourses] = useState([]);

  const [showCreate, setShowCreate] = useState(false);
  const [selectedCourseOffering, setSelectedCourseOffering] = useState("");
  const [newTitle,  setNewTitle]  = useState("");
  const [newCourse, setNewCourse] = useState("");
  const [newDate,   setNewDate]   = useState("");
  const [toast,     setToast]     = useState(null);
  const [selectedExamForUpload, setSelectedExamForUpload] = useState("");

  // File upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadNotes, setUploadNotes] = useState("");
  const fileInputRef = useRef(null);

  // Swap state
  const [swapModal,  setSwapModal]  = useState(null); // duty to swap
  const [swapFor,    setSwapFor]    = useState("");
  const [swapReason, setSwapReason] = useState("");
  const [viewSwap,   setViewSwap]   = useState(null);

  const ALLOWED_EXTENSIONS = [".pdf", ".docx"];
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

  function validateAndSetFile(file) {
    if (!file) return;
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      alert("Only PDF and DOCX files are allowed.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      alert("File is too large. Max size is 10 MB.");
      return;
    }
    setSelectedFile(file);
  }

  function handleFileInputChange(e) {
    validateAndSetFile(e.target.files?.[0]);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    validateAndSetFile(e.dataTransfer.files?.[0]);
  }

  const [selectedFileType, setSelectedFileType] = useState("question_paper");

  function handlePaperUpload() {
    if (!selectedExamForUpload) { alert("Please select an exam first."); return; }
    if (!selectedFile) { alert("Please choose a file to upload."); return; }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("exam_id", selectedExamForUpload);
    formData.append("file_type", selectedFileType);
    if (uploadNotes.trim()) formData.append("notes", uploadNotes.trim());

    setUploading(true);
    fetch("http://localhost:5000/api/exam-files/upload", {
      method: "POST",
      body: formData,
    })
      .then(res => res.json())
      .then(data => {
        setUploading(false);
        if (data.status === "success") {
          showToast(`${selectedFileType.replace("_", " ").toUpperCase()} uploaded successfully!`);
          setSelectedExamForUpload("");
          setSelectedFile(null);
          setUploadNotes("");
          fetchData();
        } else {
          alert(data.message || "Failed to upload file.");
        }
      })
      .catch(() => {
        setUploading(false);
        alert("Network error. Upload failed.");
      });
  }

  function shareWithDEC(examId) {
    fetch(`http://localhost:5000/api/exams/${examId}/share-dec`, {
      method: "POST",
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === "success") {
          showToast("Exam paper shared with Director Exam!");
          fetchData();
        } else {
          alert(data.message || "Failed to share with Director Exam.");
        }
      })
      .catch(() => alert("Network error. Failed to share with Director Exam."));
  }

  const fetchData = () => {
    if (!user) return;
    fetch(`http://localhost:5000/api/teacher/${user.userId}/schedule`)
      .then(res => res.json())
      .then(data => {
        if (data.status === "success") {
          setExams(data.schedule.filter(s => s.is_instructor));
          setInvigilatorAssignments(data.schedule.filter(s => s.is_invigilator));
        }
      });

    fetch("http://localhost:5000/api/teachers")
      .then(res => res.json())
      .then(data => { if (data.status === "success") setTeachersPool(data.teachers); });

    // Fetch swap requests created by this teacher
    fetch(`http://localhost:5000/api/teacher/${user.userId}/swap-requests/outgoing`)
      .then(res => res.json())
      .then(data => {
        if (data.status === "success") {
          setMySwaps(data.requests);
        }
      });

    // Fetch courses this teacher is teaching (for exam creation dropdown)
    fetch(`http://localhost:5000/api/teacher/${user.userId}/courses`)
      .then(res => res.json())
      .then(data => { if (data.status === "success") setMyCourses(data.courses); });

    // Fetch incoming swap requests for this teacher
    fetch(`http://localhost:5000/api/teacher/${user.userId}/swap-requests/incoming`)
      .then(res => res.json())
      .then(data => { if (data.status === "success") setIncomingSwaps(data.incoming); });
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const hasDuty = invigilatorAssignments.length > 0;

  function showToast(msg, type = "ok") { setToast({ msg, type }); setTimeout(() => setToast(null), 3200); }

  function submitToHOD(examId) {
    fetch("http://localhost:5000/api/exams/submit-hod", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exam_id: examId }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === "success") {
          showToast("Exam submitted to HOD for review.");
          fetchData();
        } else {
          alert(data.message || "Failed to submit.");
        }
      })
      .catch(() => alert("Connection error."));
  }

  function shareWithDEC(examId) {
    fetch(`http://localhost:5000/api/exams/${examId}/share-dec`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user?.userId }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === "success") {
          showToast("Exam paper shared with Director Examination!");
          fetchData();
        } else {
          alert(data.message || "Failed to share exam paper.");
        }
      })
      .catch(() => alert("Connection error."));
  }
  function handleCourseSelect(e) {
    const coId = e.target.value;
    setSelectedCourseOffering(coId);
    if (!coId) { setNewCourse(""); return; }
    const found = myCourses.find(c => String(c.course_offering_id) === String(coId));
    if (found) setNewCourse(found.course_code);
  }

  const [isSubmitting, setIsSubmitting] = useState(false);

  function createExam() {
    if (isSubmitting) return;
    if (!selectedCourseOffering || !newTitle || !newDate) {
      alert("Please fill in all fields.");
      return;
    }
    setIsSubmitting(true);
    fetch("http://localhost:5000/api/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user?.userId,
        course_offering_id: parseInt(selectedCourseOffering),
        exam_type: newTitle,
        course_code: newCourse,
        proposed_date: newDate,
      }),
    })
      .then(res => res.json())
      .then(data => {
        setIsSubmitting(false);
        if (data.status === "success") {
          setShowCreate(false);
          setSelectedCourseOffering(""); setNewTitle(""); setNewCourse(""); setNewDate("");
          showToast("Exam draft created!");
          fetchData();
        } else {
          alert(data.message || "Failed to create exam.");
        }
      })
      .catch(() => {
        setIsSubmitting(false);
        alert("Connection error.");
      });
  }
  function submitSwap() {
    if (!swapFor || !swapReason.trim()) return;
    fetch("http://localhost:5000/api/swap-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schedule_id: swapModal.schedule_id,
        user_id: user?.userId || 1,
        replacement_teacher_id: parseInt(swapFor),
        reason: swapReason.trim(),
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === "success") {
          setSwapModal(null); setSwapFor(""); setSwapReason("");
          showToast(`Swap request sent successfully!`);
          fetchData();
        } else {
          alert(data.message || "Failed to submit swap request.");
        }
      })
      .catch(err => alert("Connection error to swap api."));
  }
  function respondIncoming(requestId, decision) {
    fetch(`http://localhost:5000/api/teacher/swap-requests/${requestId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user?.userId, decision }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === "success") {
          showToast(decision === "Accepted" ? "Agreed to swap — sent to DEC for final approval." : "Swap request declined.");
          fetchData();
        } else {
          alert(data.message || "Failed to process response.");
        }
      })
      .catch(() => alert("Network error."));
  }
  function cancelSwap(id) {
    showToast("Swap cancellation requires DEC review.", "warn");
  }

  const statusBadge = (s) => {
    const map = {
      Confirmed: [C.teal,   C.tealLight],
      Upcoming:  [C.amber,  C.amberLight],
      Accepted:  [C.green,  C.greenLight],
      Declined:  [C.red,    C.redLight],
      Pending:   [C.amber,  C.amberLight],
      Approved:  [C.green,  C.greenLight],
      Rejected:  [C.red,    C.redLight],
    };
    const [c, bg] = map[s] || [C.grey500, C.grey100];
    return <Badge color={c} bg={bg}>{s}</Badge>;
  };

  // NOTE: key changed from "Pending HOD" (with space) to "PendingHOD"
  // (no space) to match the actual status string stored in the DB
  // (exam.status CHECK constraint only allows 'PendingHOD').
  const examBadge = (s) => {
    const map = { Draft: [C.grey500, C.grey100], PendingHOD: [C.navy, C.grey200], Approved: [C.teal, C.tealLight], Rejected: [C.grey800, C.grey200] };
    const [c, bg] = map[s] || [C.grey500, C.grey100];
    return <Badge color={c} bg={bg}>{s}</Badge>;
  };

  const pendingIncoming = 0;

  const titleMap    = { exams: "My Exams", upload: "Upload Exam", invigilation: "Invigilation Duty" };
  const subtitleMap = {
    exams:       "Create exam papers and submit for HOD approval",
    upload:      "Upload your exam paper file",
    invigilation:"View your assigned invigilator duties and manage swap requests",
  };

  return (
    <PageWrap
      title={titleMap[activeTab]}
      subtitle={subtitleMap[activeTab]}
      actions={
  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
    <NotificationBell userId={user?.userId} />
    {activeTab === "exams" && (
      <Btn variant="primary" onClick={() => setShowCreate(true)}>+ Create Exam</Btn>
    )}
  </div>
}
    >
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 24, right: 24, zIndex: 300, background: toast.type === "warn" ? C.amber : C.navy, color: C.white, padding: "13px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,.2)", display: "flex", alignItems: "center", gap: 10, animation: "popIn .25s ease both" }}>
          {toast.type === "warn" ? Icon.alertTriangle : Icon.check} {toast.msg}
        </div>
      )}

      {/* Create Exam Modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(17,29,51,.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowCreate(false)}>
          <div style={{ background: C.white, borderRadius: 16, padding: 40, width: 460, boxShadow: "0 24px 64px rgba(0,0,0,.18)", animation: "popIn .28s cubic-bezier(.22,.68,0,1.3) both" }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: C.navy }}>Create New Exam</h2>
            <p style={{ margin: "0 0 22px", fontSize: 13, color: C.grey500 }}>Saved as draft. Submit to HOD when ready.</p>

            {/* Course dropdown — backend returns only courses without an existing exam */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.grey500, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Course Title *</label>
              {myCourses.length === 0 ? (
                <div style={{ padding: "10px 14px", borderRadius: 8, background: C.grey100, border: `1px solid ${C.grey200}`, fontSize: 13, color: C.grey500, fontWeight: 600 }}>
                  ✓ All of your assigned courses already have an exam created.
                </div>
              ) : (
                <select
                  value={selectedCourseOffering}
                  onChange={handleCourseSelect}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${selectedCourseOffering ? C.teal : C.grey200}`, fontSize: 13, fontWeight: 600, color: selectedCourseOffering ? C.navy : C.grey400, background: C.white, outline: "none", boxSizing: "border-box", cursor: "pointer" }}
                >
                  <option value="">Select a course you teach…</option>
                  {myCourses.map(c => (
                    <option key={c.course_offering_id} value={c.course_offering_id}>
                      {c.course_title} — {c.section_name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Course Code — auto-filled, read-only */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.grey500, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Course Code</label>
              <div style={{ padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${C.grey200}`, fontSize: 13, fontWeight: 700, color: newCourse ? C.navy : C.grey400, background: C.grey50, minHeight: 40 }}>
                {newCourse || "Auto-filled when you select a course"}
              </div>
            </div>

            {/* Exam Type */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.grey500, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Exam Type *</label>
              <select
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${newTitle ? C.teal : C.grey200}`, fontSize: 13, fontWeight: 600, color: newTitle ? C.navy : C.grey400, background: C.white, outline: "none", boxSizing: "border-box", cursor: "pointer" }}
              >
                <option value="">Select exam type…</option>
                <option value="LabMid">Lab Mid</option>
                <option value="LabFinal">Lab Final</option>
                <option value="LabPractical">Lab Practical</option>
              </select>
            </div>

            <Input label="Proposed Exam Date" type="date" min={new Date().toISOString().split('T')[0]} value={newDate} onChange={e => setNewDate(e.target.value)} />
            
            <WhitelistBuilder onChange={(domains) => console.log('Whitelist updated:', domains)} />

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <Btn variant="ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setShowCreate(false); setSelectedCourseOffering(""); setNewTitle(""); setNewCourse(""); setNewDate(""); }} disabled={isSubmitting}>Cancel</Btn>
              <Btn variant="navy"  style={{ flex: 1, justifyContent: "center", opacity: isSubmitting ? 0.6 : 1 }} onClick={createExam} disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Save Draft"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Swap Request Modal */}
      {swapModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(17,29,51,.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setSwapModal(null)}>
          <div style={{ background: C.white, borderRadius: 18, padding: 36, width: 480, boxShadow: "0 28px 72px rgba(0,0,0,.22)", animation: "popIn .28s cubic-bezier(.22,.68,0,1.3) both" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: C.amberLight, display: "flex", alignItems: "center", justifyContent: "center", color: C.amber }}>{Icon.bell}</div>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.navy }}>Request Duty Swap</h2>
                <p style={{ margin: 0, fontSize: 13, color: C.grey500 }}>{swapModal.course_code} {swapModal.exam_type} · {new Date(swapModal.exam_date).toLocaleDateString()}</p>
              </div>
            </div>
            <div style={{ padding: "11px 14px", background: C.grey50, borderRadius: 9, fontSize: 13, color: C.grey500, marginBottom: 18, lineHeight: 1.6 }}>
              <strong style={{ color: C.navy }}>How it works: </strong>You nominate a replacement → they accept → DEC gives final approval.
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.grey500, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Replacement Teacher *</label>
              <select value={swapFor} onChange={e => setSwapFor(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${swapFor ? C.teal : C.grey200}`, fontSize: 13, fontWeight: 600, color: C.navy, background: C.white, outline: "none", boxSizing: "border-box" }}>
                <option value="">Select a teacher…</option>
                {teachersPool.map(t => <option key={t.id} value={t.id}>{t.name} ({t.designation})</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.grey500, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Reason *</label>
              <textarea value={swapReason} onChange={e => setSwapReason(e.target.value)} placeholder="e.g. Family emergency, conference, medical leave…" rows={3} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${swapReason.trim() ? C.teal : C.grey200}`, fontSize: 13, color: C.navy, background: C.grey50, resize: "vertical", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="ghost"   style={{ flex: 1, justifyContent: "center" }} onClick={() => setSwapModal(null)}>Cancel</Btn>
              <Btn variant="primary" style={{ flex: 1, justifyContent: "center", opacity: (!swapFor || !swapReason.trim()) ? 0.5 : 1 }} onClick={submitSwap}>Submit Swap Request</Btn>
            </div>
          </div>
        </div>
      )}

      {/* View Swap Detail Modal */}
      {viewSwap && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(17,29,51,.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setViewSwap(null)}>
          <div style={{ background: C.white, borderRadius: 16, padding: 36, width: 450, boxShadow: "0 24px 64px rgba(0,0,0,.18)", animation: "popIn .28s cubic-bezier(.22,.68,0,1.3) both" }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 18px", fontSize: 17, fontWeight: 800, color: C.navy }}>Swap Request Details</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 20 }}>
              {[["Exam", viewSwap.exam], ["Date", viewSwap.date], ["Replacement", viewSwap.replacement], ["Reason", viewSwap.reason], ["Submitted", viewSwap.submittedOn]].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: C.grey50, borderRadius: 7 }}>
                  <span style={{ fontSize: 13, color: C.grey500 }}>{l}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.navy, textAlign: "right", maxWidth: 230 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.grey500, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Approval Pipeline</div>
              {[
                { label: "Your Request", status: "Submitted", c: C.teal,  bg: C.tealLight },
                { label: `${viewSwap.replacement} (Replacement)`, status: viewSwap.replacementStatus, c: viewSwap.replacementStatus === "Accepted" ? C.green : C.amber, bg: viewSwap.replacementStatus === "Accepted" ? C.greenLight : C.amberLight },
                { label: "DEC Approval", status: viewSwap.decStatus, c: viewSwap.decStatus === "Approved" ? C.green : viewSwap.decStatus === "Rejected" ? C.red : C.grey400, bg: viewSwap.decStatus === "Approved" ? C.greenLight : viewSwap.decStatus === "Rejected" ? C.redLight : C.grey100 },
              ].map(({ label, status, c, bg }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 13px", background: bg, borderRadius: 7, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{label}</span>
                  <Badge color={c} bg={bg}>{status}</Badge>
                </div>
              ))}
            </div>
            <Btn variant="ghost" style={{ width: "100%", justifyContent: "center" }} onClick={() => setViewSwap(null)}>Close</Btn>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: "exams",        label: "My Exams" },
          { id: "upload",       label: "Upload Exam" },
          { id: "invigilation", label: `Invigilation Duty${pendingIncoming ? ` (${pendingIncoming})` : ""}` },
        ]}
        active={activeTab}
        onChange={(id) => {
          setActiveTab(id);
          if (setPage) {
            const pageMap = { exams: "teacher", upload: "upload", invigilation: "inv-schedule" };
            setPage(pageMap[id]);
          }
        }}
      />

      {/* ═══════════════ MY EXAMS ═══════════════ */}
      {activeTab === "exams" && <>
        <div className="steps-container" style={{ marginBottom: 26, padding: "14px 22px", background: C.navy, borderRadius: 12 }}>
          {[["1","Create Draft"],["2","Submit to HOD"],["3","HOD Reviews"],["4","Invigilator Runs Exam"]].map(([n, label], i) => (
            <div key={n} style={{ display: "flex", alignItems: "center", flex: i < 3 ? 1 : undefined }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: C.teal, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: C.white, flexShrink: 0 }}>{n}</div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,.8)", whiteSpace: "nowrap" }}>{label}</span>
              </div>
              {i < 3 && <div className="step-line" />}
            </div>
          ))}
        </div>
        <div className="resp-grid-4" style={{ marginBottom: 28 }}>
          <StatCard label="Total Exams"      value={exams.length}                                          icon={Icon.clipboardList} delay={0}   />
          <StatCard label="Pending HOD"       value={exams.filter(e => e.exam_status === "PendingHOD").length}  icon={Icon.bell}          delay={80}  />
          <StatCard label="Approved"          value={exams.filter(e => e.exam_status === "Approved").length}    icon={Icon.check}         delay={160} />
          <StatCard label="Students Enrolled" value={exams.reduce((s, e) => s + (e.students || 0), 0)}      icon={Icon.users}         delay={240} />
        </div>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.grey100}`, fontWeight: 700, fontSize: 15, color: C.navy }}>Exam Papers</div>
          <Table columns={["Course", "Section", "Exam Date", "Lab", "Status", "Actions"]}
            rows={exams.map(e => [
              <span style={{ fontWeight: 700, color: C.navy }}>{e.course_code} {e.exam_type}</span>,
              <Badge>{e.section_name}</Badge>,
              new Date(e.exam_date).toLocaleDateString(),
              e.lab_name,
              examBadge(e.exam_status),
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {e.exam_status === "Draft" && <Btn variant="navy" size="sm" onClick={() => submitToHOD(e.exam_id)}>Submit to HOD</Btn>}
                {e.exam_status === "Approved" && !e.shared_with_dec_at && (
                  <Btn variant="navy" size="sm" onClick={() => shareWithDEC(e.exam_id)}>Share with Director Exam</Btn>
                )}
                {e.exam_status === "Approved" && (
                  <>
                    <Btn variant="primary" size="sm" onClick={() => setPage && setPage("live-monitor")}>
                      📡 Live Monitor
                    </Btn>
                    <Btn variant="ghost" size="sm" onClick={() => setPage && setPage("exam-reports")}>
                      📊 Post-Exam Report
                    </Btn>
                  </>
                )}
                {e.exam_status === "PendingHOD" && <span style={{ fontSize: 12, color: C.grey400, padding: "7px 0" }}>Awaiting review</span>}
                {e.exam_status === "Rejected" && (
                  <Btn variant="primary" size="sm" onClick={() => submitToHOD(e.exam_id)}>Resubmit to HOD</Btn>
                )}
              </div>,
            ])} />
        </Card>
      </>}

      {/* ═══════════════ UPLOAD EXAM ═══════════════ */}
      {activeTab === "upload" && <>
        <div className="resp-grid-2">
          <Card>
            <h3 style={{ margin: "0 0 20px", fontWeight: 800, color: C.navy, fontSize: 15 }}>Upload Exam Paper</h3>
            <Select label="Select Exam" value={selectedExamForUpload} onChange={e => setSelectedExamForUpload(e.target.value)}>
              <option value="">Choose exam…</option>
              {exams.map(e => <option key={e.exam_id} value={e.exam_id}>{e.course_code} {e.exam_type} – {e.section_name}</option>)}
            </Select>

            <Select label="File Attachment Type" value={selectedFileType} onChange={e => setSelectedFileType(e.target.value)}>
              <option value="question_paper">Question Paper (PDF/DOCX)</option>
              <option value="rubric">Rubric File (PDF/DOCX)</option>
              <option value="starter_file">Starter Code Files (ZIP)</option>
              <option value="word_template">Word Report Template (DOCX)</option>
            </Select>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx"
              onChange={handleFileInputChange}
              style={{ display: "none" }}
            />

            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? C.teal : selectedFile ? C.teal : C.grey200}`,
                borderRadius: 10,
                padding: "36px 24px",
                textAlign: "center",
                background: isDragging ? C.tealLight : selectedFile ? C.tealLight : C.grey50,
                marginBottom: 18,
                cursor: "pointer",
                transition: "background .15s, border-color .15s",
              }}
            >
              <div style={{ color: selectedFile ? C.teal : C.grey400, display: "flex", justifyContent: "center", marginBottom: 12 }}>
                {selectedFile ? Icon.fileText : Icon.upload}
              </div>
              {selectedFile ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 4 }}>{selectedFile.name}</div>
                  <div style={{ fontSize: 12, color: C.grey500, marginBottom: 16 }}>
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB — click to change
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.grey800, marginBottom: 6 }}>Drag and drop file here</div>
                  <div style={{ fontSize: 12, color: C.grey400, marginBottom: 16 }}>PDF, DOCX — Max 10 MB</div>
                </>
              )}
              <Btn
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              >
                {selectedFile ? "Choose a Different File" : "Browse Files"}
              </Btn>
            </div>

            <Input
              label="Notes for HOD (optional)"
              placeholder="e.g. Review question 4 rubric"
              value={uploadNotes}
              onChange={e => setUploadNotes(e.target.value)}
            />
            <Btn
              variant="navy"
              style={{ width: "100%", justifyContent: "center", opacity: uploading ? 0.7 : 1 }}
              onClick={handlePaperUpload}
              disabled={uploading}
            >
              {uploading ? "Uploading…" : "Upload and Attach"}
            </Btn>
          </Card>
          <Card>
            <h3 style={{ margin: "0 0 20px", fontWeight: 800, color: C.navy, fontSize: 15 }}>Previously Uploaded</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {exams.filter(e => e.exam_paper_url).length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: C.grey400, fontSize: 13 }}>
                  <div style={{ marginBottom: 6, display: "flex", justifyContent: "center", opacity: 0.4 }}>{Icon.fileText}</div>
                  No papers uploaded yet.
                </div>
              ) : exams.filter(e => e.exam_paper_url).map(e => (
                <div key={e.exam_id} style={{ display: "flex", gap: 14, alignItems: "center", padding: "13px 16px", background: C.grey50, borderRadius: 9, border: `1px solid ${C.grey200}` }}>
                  <div style={{ color: C.teal, display: "flex" }}>{Icon.fileText}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: C.navy, fontSize: 13 }}>{e.course_code} {e.exam_type}</div>
                    <div style={{ fontSize: 12, color: C.grey400 }}>{e.section_name} · {new Date(e.exam_date).toLocaleDateString()}</div>
                  </div>
                  <Btn variant="ghost" size="sm" onClick={() => window.open(e.exam_paper_url, "_blank")}>View</Btn>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </>}

      {/* ═══════════════ INVIGILATION DUTY ═══════════════ */}
      {activeTab === "invigilation" && <>
        {/* Incoming Swap Requests Section */}
        {incomingSwaps.length > 0 && (
          <Card style={{ marginBottom: 24, border: `2px solid ${C.amber}`, background: C.amberLight }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ color: C.amber, display: "flex" }}>{Icon.bell}</div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.navy }}>Incoming Swap Requests</h3>
              <Badge color={C.amber} bg={C.white}>{incomingSwaps.length} pending</Badge>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {incomingSwaps.map(req => (
                <div key={req.request_id} style={{ padding: "14px 18px", borderRadius: 10, background: C.white, border: `1.5px solid ${C.grey200}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: C.navy, marginBottom: 3 }}>
                      {req.requester_name} requests you to cover: {req.course_code} {req.exam_type}
                    </div>
                    <div style={{ fontSize: 12, color: C.grey500, marginBottom: 2 }}>
                      Date: <strong style={{ color: C.navy }}>{new Date(req.exam_date).toLocaleDateString()}</strong> · Lab: <strong style={{ color: C.navy }}>{req.lab_name}</strong> · Section: <strong style={{ color: C.navy }}>{req.section_name}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: C.grey500 }}>
                      Reason: <em>"{req.reason}"</em>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn variant="primary" size="sm" onClick={() => respondIncoming(req.request_id, "Accepted")}>
                      Accept Swap
                    </Btn>
                    <Btn variant="ghost" size="sm" style={{ color: C.red, borderColor: C.redLight }} onClick={() => respondIncoming(req.request_id, "Declined")}>
                      Decline
                    </Btn>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {!hasDuty && incomingSwaps.length === 0 ? (
          <Card style={{ textAlign: "center", padding: "64px 24px" }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: C.grey100, display: "flex", alignItems: "center", justifyContent: "center", color: C.grey400, margin: "0 auto 20px" }}>{Icon.clipboard}</div>
            <h3 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 800, color: C.navy }}>No Invigilation Duty Assigned</h3>
            <p style={{ margin: "0 auto", color: C.grey500, fontSize: 14, maxWidth: 380, lineHeight: 1.65 }}>You have not been assigned any invigilator duties this semester. Duties are assigned by the Departmental Exam Committee (DEC).</p>
          </Card>
        ) : <>
          <div style={{ padding: "12px 20px", background: C.tealLight, border: `1.5px solid ${C.tealMid}`, borderRadius: 10, marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: C.teal, display: "flex" }}>{Icon.userCheck}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>You have <strong>{invigilatorAssignments.length}</strong> invigilator {invigilatorAssignments.length === 1 ? "duty" : "duties"} assigned this semester.</span>
          </div>

          <div className="resp-grid-4" style={{ marginBottom: 28 }}>
            <StatCard label="Assigned Exams" value={invigilatorAssignments.length} icon={Icon.clipboard} />
            <StatCard label="Total Capacity" value={invigilatorAssignments.reduce((s,a) => s + (a.capacity || 0), 0)} icon={Icon.users} />
            <StatCard label="Swap Requests"  value={mySwaps.length} icon={Icon.bell} accent={mySwaps.length ? C.amber : C.teal} light={mySwaps.length ? C.amberLight : C.tealLight} />
            <StatCard label="Next Exam"      value={invigilatorAssignments.length > 0 ? new Date(invigilatorAssignments[0].exam_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "None"} icon={Icon.calendar} />
          </div>

          <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 800, color: C.navy }}>My Schedule</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
            {invigilatorAssignments.map((a, ai) => {
              const alreadyRequested = mySwaps.some(r => r.schedule_id === a.schedule_id);
              return (
                <Card key={a.schedule_id} style={{ border: alreadyRequested ? `2px solid ${C.amber}` : undefined, animation: `slideInLeft .38s cubic-bezier(.22,.68,0,1.1) ${ai * 100}ms both` }}>
                  <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ width: 50, height: 50, borderRadius: 13, background: C.tealLight, display: "flex", alignItems: "center", justifyContent: "center", color: C.teal, flexShrink: 0 }}>{Icon.clipboard}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 5, flexWrap: "wrap" }}>
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.navy }}>{a.course_code} {a.exam_type}</h3>
                        <Badge>{a.section_name}</Badge>
                        {alreadyRequested && <Badge color={C.amber} bg={C.amberLight}>Swap Requested</Badge>}
                        {a.exam_paper_url && <Badge color={C.teal} bg={C.tealLight}>Paper Available</Badge>}
                      </div>
                      <div style={{ display: "flex", gap: 18, rowGap: 4, fontSize: 13, color: C.grey500, flexWrap: "wrap" }}>
                        <span>{new Date(a.exam_date).toLocaleDateString()} · {a.start_time?.substring(0,5)}</span>
                        <span>Lab: <strong style={{ color: C.navy }}>{a.lab_name}</strong></span>
                        <span>Section: <strong style={{ color: C.navy }}>{a.section_name}</strong></span>
                        <span>Capacity: <strong style={{ color: C.navy }}>{a.capacity}</strong></span>
                        <span>Status: <strong style={{ color: C.navy }}>{a.assignment_status || "Confirmed"}</strong></span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      {a.exam_paper_url && (
                        <Btn variant="ghost" size="sm" onClick={() => window.open(a.exam_paper_url, "_blank")}>View Paper</Btn>
                      )}
                      <Btn variant="ghost" size="sm" style={alreadyRequested ? { borderColor: C.amber, color: C.amber } : {}} onClick={() => !alreadyRequested && setSwapModal(a)}>
                        {alreadyRequested ? "Swap Pending" : "Request Swap"}
                      </Btn>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.navy }}>My Swap Requests</h3>
              {mySwaps.filter(r => r.dec_status === "Pending").length > 0 && <Badge color={C.amber} bg={C.amberLight}>{mySwaps.filter(r => r.dec_status === "Pending").length} pending</Badge>}
            </div>
            {mySwaps.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: C.grey400, fontSize: 13 }}>
                <div style={{ marginBottom: 6, display: "flex", justifyContent: "center", opacity: 0.4 }}>{Icon.bell}</div>
                No swap requests yet. Use <strong>"Request Swap"</strong> on a duty card above.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {mySwaps.map(req => (
                  <div key={req.request_id} style={{ padding: "13px 16px", borderRadius: 10, background: C.grey50, border: `1.5px solid ${C.grey200}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: C.navy, marginBottom: 2 }}>{req.course_code} {req.exam_type}</div>
                      <div style={{ fontSize: 12, color: C.grey500 }}>{req?.exam_date ? new Date(req.exam_date).toLocaleDateString() : "TBD"} · Replacement: <strong style={{ color: C.navy }}>{req?.replacement_name || "Teacher"}</strong></div>
                      <div style={{ fontSize: 12, color: C.grey500 }}>Reason: {req.reason}</div>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: C.grey400, marginBottom: 3, fontWeight: 700, textTransform: "uppercase" }}>Replacement</div>
                        {statusBadge(req.replacement_status)}
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: C.grey400, marginBottom: 3, fontWeight: 700, textTransform: "uppercase" }}>DEC</div>
                        {statusBadge(req.dec_status)}
                      </div>
                      <Btn variant="ghost" size="sm" onClick={() => setViewSwap(req)}>Details</Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>}
      </>}

      <div style={{ height: 48 }} />
    </PageWrap>
  );
}
