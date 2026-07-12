import { useState } from "react";
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

export default function TeacherPage({ activePage }) {
  const tabFromPage = { upload: "upload", monitor: "monitor", teacher: "exams" };
  const [activeTab, setActiveTab] = useState(tabFromPage[activePage] || "exams");
  const [exams, setExams] = useState([
    { title: "Data Structures Lab", course: "CS-301", date: "2026-07-02", status: "Approved", students: 34 },
    { title: "Operating Systems Lab", course: "CS-402", date: "2026-07-08", status: "Pending HOD", students: 28 },
    { title: "Networks Lab Final", course: "CS-415", date: "2026-07-15", status: "Draft", students: 30 },
    { title: "AI Lab Practical", course: "CS-501", date: "2026-07-20", status: "Rejected", students: 22 },
  ]);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCourse, setNewCourse] = useState("");
  const [newDate, setNewDate] = useState("");
  const [toast, setToast] = useState("");

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  function submitToHOD(title) {
    setExams((e) => e.map((x) => x.title === title ? { ...x, status: "Pending HOD" } : x));
    showToast("Exam submitted to HOD for review.");
  }

  function createExam() {
    if (!newTitle.trim() || !newCourse.trim()) return;
    setExams((e) => [...e, { title: newTitle, course: newCourse, date: newDate || "TBD", status: "Draft", students: 0 }]);
    setNewTitle(""); setNewCourse(""); setNewDate(""); setShowCreate(false);
    showToast("Draft created. Submit to HOD when ready.");
  }

  const teacherStatusBadge = (s) => {
    const map = { Draft: [C.grey500, C.grey100], "Pending HOD": [C.navy, C.grey200], Approved: [C.teal, C.tealLight], Rejected: [C.grey800, C.grey200] };
    const [c, bg] = map[s] || [C.grey500, C.grey100];
    return <Badge color={c} bg={bg}>{s}</Badge>;
  };

  const titleMap = { exams: "My Exams", upload: "Upload Exam", monitor: "Live Monitor" };
  const subtitleMap = { exams: "Create exam papers and submit for HOD approval", upload: "Upload your exam paper file", monitor: "View live student activity during an active session" };

  return (
    <PageWrap title={titleMap[activeTab]} subtitle={subtitleMap[activeTab]}
      actions={activeTab === "exams" ? <Btn variant="primary" onClick={() => setShowCreate(true)}>+ Create Exam</Btn> : undefined}>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 24, right: 24, zIndex: 300, background: C.navy, color: C.white, padding: "13px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,.2)", display: "flex", alignItems: "center", gap: 10, animation: "popIn .25s ease both" }}>
          {Icon.check} {toast}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(17,29,51,.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowCreate(false)}>
          <div style={{ background: C.white, borderRadius: 16, padding: 40, width: 440, boxShadow: "0 24px 64px rgba(0,0,0,.18)", animation: "popIn .28s cubic-bezier(.22,.68,0,1.3) both" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: C.navy }}>Create New Exam</h2>
            <p style={{ margin: "0 0 22px", fontSize: 13, color: C.grey500 }}>Saved as draft. Submit to HOD when the paper is ready.</p>
            <Input label="Exam Title" placeholder="e.g. Networks Lab Final" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            <Input label="Course Code" placeholder="e.g. CS-415" value={newCourse} onChange={(e) => setNewCourse(e.target.value)} />
            <Input label="Proposed Exam Date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <Btn variant="ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setShowCreate(false)}>Cancel</Btn>
              <Btn variant="navy" style={{ flex: 1, justifyContent: "center" }} onClick={createExam}>Save Draft</Btn>
            </div>
          </div>
        </div>
      )}

      <Tabs tabs={[{ id: "exams", label: "My Exams" }, { id: "upload", label: "Upload Exam" }, { id: "monitor", label: "Live Monitor" }]} active={activeTab} onChange={setActiveTab} />

      {/* ── MY EXAMS ── */}
      {activeTab === "exams" && <>
        <div className="steps-container" style={{ marginBottom: 26, padding: "14px 22px", background: C.navy, borderRadius: 12 }}>
          {[["1", "Create Draft"], ["2", "Submit to HOD"], ["3", "HOD Reviews"], ["4", "Invigilator Runs Exam"]].map(([n, label], i) => (
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
          <StatCard label="Total Exams" value={exams.length} icon={Icon.clipboardList} delay={0} />
          <StatCard label="Pending HOD" value={exams.filter(e => e.status === "Pending HOD").length} icon={Icon.bell} delay={80} />
          <StatCard label="Approved" value={exams.filter(e => e.status === "Approved").length} icon={Icon.check} delay={160} />
          <StatCard label="Students Enrolled" value={exams.reduce((s, e) => s + e.students, 0)} icon={Icon.users} delay={240} />
        </div>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.grey100}`, fontWeight: 700, fontSize: 15, color: C.navy }}>Exam Papers</div>
          <Table columns={["Title", "Course", "Exam Date", "Students", "Status", "Actions"]}
            rows={exams.map((e) => [
              <span style={{ fontWeight: 700, color: C.navy }}>{e.title}</span>,
              <Badge>{e.course}</Badge>,
              e.date, e.students,
              teacherStatusBadge(e.status),
              <div style={{ display: "flex", gap: 8 }}>
                {e.status === "Draft" && <Btn variant="navy" size="sm" onClick={() => submitToHOD(e.title)}>Submit to HOD</Btn>}
                {e.status === "Approved" && <span style={{ fontSize: 12, color: C.teal, fontWeight: 700, padding: "7px 0" }}>Forwarded to Invigilator</span>}
                {e.status === "Rejected" && <Btn variant="ghost" size="sm" onClick={() => { setExams((x) => x.map((r) => r.title === e.title ? { ...r, status: "Draft" } : r)); showToast("Exam returned to Draft for revision."); }}>Revise</Btn>}
                {e.status === "Pending HOD" && <span style={{ fontSize: 12, color: C.grey400, padding: "7px 0" }}>Awaiting review</span>}
              </div>,
            ])} />
        </Card>
      </>}

      {/* ── UPLOAD EXAM ── */}
      {activeTab === "upload" && <>
        <div className="resp-grid-2">
          <Card>
            <h3 style={{ margin: "0 0 20px", fontWeight: 800, color: C.navy, fontSize: 15 }}>Upload Exam Paper</h3>
            <Select label="Select Exam to Attach Paper To">
              {exams.map(e => <option key={e.title}>{e.title} ({e.course})</option>)}
            </Select>
            <div style={{ border: `2px dashed ${C.grey200}`, borderRadius: 10, padding: "36px 24px", textAlign: "center", background: C.grey50, marginBottom: 18 }}>
              <div style={{ color: C.grey400, display: "flex", justifyContent: "center", marginBottom: 12 }}>{Icon.upload}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.grey800, marginBottom: 6 }}>Drag and drop your exam file here</div>
              <div style={{ fontSize: 12, color: C.grey400, marginBottom: 16 }}>Supported formats: PDF, DOCX — Max 10 MB</div>
              <Btn variant="ghost" size="sm">Browse Files</Btn>
            </div>
            <Input label="Add Notes for HOD (optional)" placeholder="e.g. Please review question 4 rubric" />
            <Btn variant="navy" style={{ width: "100%", justifyContent: "center" }}>Upload and Attach</Btn>
          </Card>
          <Card>
            <h3 style={{ margin: "0 0 20px", fontWeight: 800, color: C.navy, fontSize: 15 }}>Previously Uploaded</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[{ name: "DS_Lab_Final_v2.pdf", course: "CS-301", uploaded: "Jun 20", size: "1.2 MB" }, { name: "OS_Lab_Midterm.docx", course: "CS-402", uploaded: "Jun 10", size: "780 KB" }].map(f => (
                <div key={f.name} style={{ display: "flex", gap: 14, alignItems: "center", padding: "13px 16px", background: C.grey50, borderRadius: 9, border: `1px solid ${C.grey200}` }}>
                  <div style={{ color: C.teal, display: "flex" }}>{Icon.fileText}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: C.navy, fontSize: 13 }}>{f.name}</div>
                    <div style={{ fontSize: 12, color: C.grey400 }}>{f.course} · {f.uploaded} · {f.size}</div>
                  </div>
                  <Btn variant="ghost" size="sm">View</Btn>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </>}

      {/* ── LIVE MONITOR ── */}
      {activeTab === "monitor" && <>
        <Card style={{ textAlign: "center", padding: "52px 24px" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: C.grey100, display: "flex", alignItems: "center", justifyContent: "center", color: C.grey400, margin: "0 auto 16px" }}>{Icon.monitor}</div>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800, color: C.navy }}>No Active Session</h3>
          <p style={{ margin: "0 0 6px", color: C.grey500, fontSize: 14 }}>Live monitoring is available during an active exam session.</p>
          <p style={{ margin: 0, color: C.grey400, fontSize: 13 }}>The invigilator starts the session — it will appear here automatically once active.</p>
        </Card>
      </>}

      <div style={{ height: 48 }} />
    </PageWrap>
  );
}
