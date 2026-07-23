import { useState, useEffect } from "react";
import { C } from "../theme/colors";
import { Icon } from "../theme/icons";
import PageWrap from "../components/common/PageWrap";
import Tabs from "../components/common/Tabs";
import Card from "../components/common/Card";
import Btn from "../components/common/Btn";
import Table from "../components/common/Table";
import StatCard from "../components/common/StatCard";
import Badge from "../components/common/Badge";

export default function HODPage({ activePage, setPage }) {
  const [activeTab, setActiveTab] = useState(activePage === "reports" ? "reports" : "queue");

  useEffect(() => {
    setActiveTab(activePage === "reports" ? "reports" : "queue");
  }, [activePage]);

  const [queue, setQueue] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [preview, setPreview] = useState(null);
  const [hodComment, setHodComment] = useState("");

  const fetchData = () => {
    fetch("http://localhost:5000/api/hod/queue")
      .then(res => res.json())
      .then(data => {
        if (data.status === "success" && Array.isArray(data.queue)) {
          setQueue(data.queue);
        }
      })
      .catch(() => {});

    fetch("http://localhost:5000/api/hod/decisions")
      .then(res => res.json())
      .then(data => {
        if (data.status === "success" && Array.isArray(data.decisions)) {
          setDecisions(data.decisions);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchData();
  }, []);

  function handleDecision(examId, decision, commentText) {
    fetch("http://localhost:5000/api/hod/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exam_id: examId,
        decision: decision, // "Approved" | "Rejected"
        comment: commentText || null,
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === "success") {
          setPreview(null);
          setHodComment("");
          fetchData();
        } else {
          alert(data.message || "Failed to save review decision.");
        }
      })
      .catch(err => alert("Network error. Failed to connect to server."));
  }

  const safeQueue = (Array.isArray(queue) ? queue : []).filter(Boolean);
  const safeDecisions = (Array.isArray(decisions) ? decisions : []).filter(Boolean);

  return (
    <PageWrap title={activeTab === "reports" ? "HOD Reports" : "Review Queue"} subtitle={activeTab === "reports" ? "Summary of exam approvals and faculty submissions" : "Exam papers awaiting your approval"}>
      {preview && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(17,29,51,.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setPreview(null)}>
          <div style={{ background: C.white, borderRadius: 16, padding: 40, width: 480, boxShadow: "0 24px 64px rgba(0,0,0,.18)", animation: "popIn .28s cubic-bezier(.22,.68,0,1.3) both" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.navy }}>{preview.course_code} {preview.exam_type}</h2>
              <button onClick={() => setPreview(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.grey400, display: "flex" }}>{Icon.x}</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {[
                ["Course Title", preview.course_title || "N/A"],
                ["Section", preview.section_name || "N/A"],
                ["Teacher", preview.teacher_name || "Faculty"],
                ["Submitted Date", preview.submitted_at ? new Date(preview.submitted_at).toLocaleDateString() : "Pending"],
                ["Total Marks", preview.total_marks || 100],
                ["Duration", `${preview.duration || 120} mins`],
                ["Exam Paper", preview.exam_paper_url ? <a href={preview.exam_paper_url} target="_blank" rel="noreferrer" style={{ color: C.teal, fontWeight: 700 }}>View Paper PDF</a> : "No File Uploaded"],
              ].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: C.grey50, borderRadius: 8 }}>
                  <span style={{ fontSize: 13, color: C.grey500 }}>{l}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.grey800, marginBottom: 6 }}>Comment to Teacher <span style={{ fontWeight: 400, color: C.grey400 }}>(optional)</span></label>
              <textarea value={hodComment} onChange={(e) => setHodComment(e.target.value)} placeholder="e.g. Please revise question 3 rubric before resubmitting…" style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: `1.5px solid ${C.grey200}`, fontSize: 13, color: C.grey800, background: C.grey50, minHeight: 72, resize: "vertical", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setPreview(null); setHodComment(""); }}>Cancel</Btn>
              <Btn variant="ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => handleDecision(preview.exam_id, "Rejected", hodComment || "Returned to teacher")}>Reject</Btn>
              <Btn variant="navy" style={{ flex: 1, justifyContent: "center" }} onClick={() => handleDecision(preview.exam_id, "Approved", hodComment || "Approved")}>Approve</Btn>
            </div>
          </div>
        </div>
      )}

      <Tabs tabs={[{ id: "queue", label: "Review Queue" }, { id: "reports", label: "Reports" }]} active={activeTab} onChange={(id) => {
        setActiveTab(id);
        if (setPage) {
          const pageMap = { queue: "hod", reports: "reports" };
          setPage(pageMap[id]);
        }
      }} />

      {/* ── REVIEW QUEUE ── */}
      {activeTab === "queue" && <>
        <div className="resp-grid-4" style={{ marginBottom: 28 }}>
          <StatCard label="Pending Review" value={safeQueue.length} icon={Icon.clipboardList} />
          <StatCard label="Approved Papers" value={safeDecisions.filter(d => d.decision === "Approved").length} icon={Icon.check} />
          <StatCard label="Rejected Papers" value={safeDecisions.filter(d => d.decision === "Rejected").length} icon={Icon.x} />
          <StatCard label="Total Reviewed" value={safeDecisions.length} icon={Icon.users} />
        </div>
        {safeQueue.length === 0 && (
          <Card style={{ textAlign: "center", padding: "40px 24px", marginBottom: 28 }}>
            <div style={{ color: C.teal, margin: "0 auto 12px", display: "flex", justifyContent: "center" }}>{Icon.check}</div>
            <p style={{ margin: 0, color: C.grey500, fontSize: 14 }}>All exam papers have been reviewed. No pending papers in queue.</p>
          </Card>
        )}
        {safeQueue.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 28 }}>
            {safeQueue.map((item, qi) => (
              <Card key={item.exam_id} className="resp-flex-row" style={{ gap: 22, alignItems: "center", animation: `slideInLeft .35s cubic-bezier(.22,.68,0,1.1) ${qi * 80}ms both` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.navy }}>{item.course_code} {item.exam_type}</h3>
                    <Badge>{item.section_name}</Badge>
                  </div>
                  <div style={{ display: "flex", gap: 22, fontSize: 13, color: C.grey500, flexWrap: "wrap", rowGap: 6 }}>
                    <span>{item.teacher_name || "Faculty"}</span>
                    <span>Submitted: {item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : "Recent"}</span>
                    <span>Duration: {item.duration || 120} min</span>
                    <span>Status: <span style={{ color: C.teal, fontWeight: 700 }}>{item.status}</span></span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                  <Btn variant="ghost" size="sm" onClick={() => setPreview(item)}>Preview & Review</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => handleDecision(item.exam_id, "Rejected", "Returned to teacher for revision")}>Reject</Btn>
                  <Btn variant="navy" size="sm" onClick={() => handleDecision(item.exam_id, "Approved", "Approved by HOD")}>Approve</Btn>
                </div>
              </Card>
            ))}
          </div>
        )}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.grey100}`, fontWeight: 700, fontSize: 15, color: C.navy }}>Recent Decisions</div>
          <Table columns={["Exam", "Teacher", "Decision", "Date", "Notes"]}
            rows={safeDecisions.map((d) => [
              `${d.course_code || ""} ${d.exam_type || "Exam"}`, d.teacher_name || "Faculty",
              <Badge color={d.decision === "Approved" ? C.teal : C.red} bg={d.decision === "Approved" ? C.tealLight : C.redLight}>{d.decision}</Badge>,
              d.date ? new Date(d.date).toLocaleDateString() : "Recent", d.notes || "—",
            ])} />
        </Card>
      </>}

      {/* ── REPORTS ── */}
      {activeTab === "reports" && <>
        <div className="resp-grid-3" style={{ marginBottom: 28 }}>
          <StatCard label="Total Submissions" value={safeQueue.length + safeDecisions.length} icon={Icon.fileText} />
          <StatCard label="Approval Rate" value={safeDecisions.length ? `${Math.round((safeDecisions.filter(d => d.decision === "Approved").length / safeDecisions.length) * 100)}%` : "—"} icon={Icon.check} accent={C.green} light={C.greenLight} />
          <StatCard label="Avg. Review Time" value="Same Day" icon={Icon.calendar} accent={C.amber} light={C.amberLight} />
        </div>
        <Card style={{ marginBottom: 22 }}>
          <h3 style={{ margin: "0 0 18px", fontWeight: 800, color: C.navy, fontSize: 15 }}>Decision Breakdown</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 80, marginBottom: 10 }}>
            {[["Approved", safeDecisions.filter(d => d.decision === "Approved").length, C.teal], ["Rejected", safeDecisions.filter(d => d.decision === "Rejected").length, C.red], ["Pending", safeQueue.length, C.amber]].map(([label, count, color]) => (
              <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.navy }}>{count}</span>
                <div style={{ width: "100%", height: Math.max(count * 20, 8), background: color, borderRadius: "5px 5px 0 0", opacity: 0.85 }} />
                <span style={{ fontSize: 11, color: C.grey400, fontWeight: 600 }}>{label}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.grey100}`, fontWeight: 700, fontSize: 15, color: C.navy }}>Full Decision Log</div>
          <Table columns={["Exam", "Teacher", "Decision", "Date", "Notes"]}
            rows={safeDecisions.map((d) => [
              `${d.course_code || ""} ${d.exam_type || "Exam"}`, d.teacher_name || "Faculty",
              <Badge color={d.decision === "Approved" ? C.teal : C.red} bg={d.decision === "Approved" ? C.tealLight : C.redLight}>{d.decision}</Badge>,
              d.date ? new Date(d.date).toLocaleDateString() : "Recent", d.notes || "—",
            ])} />
        </Card>
      </>}

      <div style={{ height: 48 }} />
    </PageWrap>
  );
}
