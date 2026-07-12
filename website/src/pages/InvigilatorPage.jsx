import { useState } from "react";
import { C } from "../theme/colors";
import { Icon } from "../theme/icons";
import PageWrap from "../components/common/PageWrap";
import Tabs from "../components/common/Tabs";
import Card from "../components/common/Card";
import Btn from "../components/common/Btn";
import Table from "../components/common/Table";
import StatCard from "../components/common/StatCard";
import Badge from "../components/common/Badge";
import statusBadge from "../components/common/statusBadge";

const invigilatorAssignments = [
  { exam: "Data Structures Lab", course: "CS-301", section: "CS-301 A", date: "Jul 2, 2026", time: "09:00 AM", lab: "Lab-3", students: 34, status: "Confirmed", questions: 5, duration: "90 min", approvedBy: "Dr. Imran HOD" },
  { exam: "OS Lab Final", course: "CS-402", section: "CS-402 A", date: "Jul 8, 2026", time: "11:00 AM", lab: "Lab-1", students: 28, status: "Confirmed", questions: 6, duration: "90 min", approvedBy: "Dr. Imran HOD" },
  { exam: "Networks Lab", course: "CS-415", section: "CS-415 A", date: "Jul 15, 2026", time: "02:00 PM", lab: "Lab-2", students: 30, status: "Upcoming", questions: 8, duration: "120 min", approvedBy: "Dr. Imran HOD" },
];


export default function InvigilatorPage({ activePage }) {
  const tabMap = { "inv-exams": "start", "inv-monitor": "monitor", invigilator: "schedule" };
  const [activeTab, setActiveTab] = useState(tabMap[activePage] || "schedule");
  const [sessionStarted, setSessionStarted] = useState(null);
  const [showStart, setShowStart] = useState(null);
  const [sessionCode, setSessionCode] = useState("");
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastSent, setBroadcastSent] = useState(false);

  const liveStudents = [
    { name: "Ali Hassan", id: "F21-301", status: "Active", risk: "Low", flags: 0, progress: 72 },
    { name: "Sara Malik", id: "F21-302", status: "Active", risk: "Medium", flags: 2, progress: 58 },
    { name: "Hamza Raza", id: "F21-303", status: "Active", risk: "High", flags: 5, progress: 44 },
    { name: "Nida Fatima", id: "F21-304", status: "Active", risk: "Low", flags: 0, progress: 85 },
    { name: "Bilal Cheema", id: "F21-305", status: "Idle", risk: "Low", flags: 1, progress: 30 },
    { name: "Zara Khan", id: "F21-306", status: "Active", risk: "Low", flags: 0, progress: 91 },
  ];

  function riskBadge(r) {
    const map = { Low: [C.teal, C.tealLight], Medium: [C.amber, C.amberLight], High: [C.red, C.redLight] };
    const [c, bg] = map[r] || [C.grey500, C.grey100];
    return <Badge color={c} bg={bg}>{r}</Badge>;
  }

  function handleStartExam(exam) {
    const code = exam.course.replace("CS-", "") + "-" + Math.floor(1000 + Math.random() * 9000);
    setSessionCode(code);
    setSessionStarted(exam.exam);
    setShowStart(null);
    setActiveTab("monitor");
  }

  return (
    <PageWrap title="Invigilator Panel" subtitle="View your assigned exams, start sessions, and monitor students live">
      {/* Start Exam Confirmation Modal */}
      {showStart && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(17,29,51,.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowStart(null)}>
          <div style={{ background: C.white, borderRadius: 16, padding: 40, width: 460, boxShadow: "0 24px 64px rgba(0,0,0,.18)", animation: "popIn .28s cubic-bezier(.22,.68,0,1.3) both" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: C.tealLight, display: "flex", alignItems: "center", justifyContent: "center", color: C.teal, marginBottom: 20 }}>{Icon.play}</div>
            <h2 style={{ margin: "0 0 8px", fontSize: 19, fontWeight: 800, color: C.navy }}>Start Exam Session</h2>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: C.grey500, lineHeight: 1.6 }}>You are about to start the exam for <strong style={{ color: C.navy }}>{showStart.exam}</strong>. A session code will be generated and shared with students in <strong style={{ color: C.navy }}>{showStart.lab}</strong>.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {[["Course", showStart.course], ["Lab", showStart.lab], ["Students", showStart.students], ["Duration", showStart.duration], ["HOD Approval", showStart.approvedBy]].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: C.grey50, borderRadius: 8 }}>
                  <span style={{ fontSize: 13, color: C.grey500 }}>{l}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setShowStart(null)}>Cancel</Btn>
              <Btn variant="primary" style={{ flex: 1, justifyContent: "center" }} onClick={() => handleStartExam(showStart)}>Start Session</Btn>
            </div>
          </div>
        </div>
      )}

      <Tabs
        tabs={[
          { id: "schedule", label: "My Schedule" },
          { id: "start", label: "Start Exam" },
          { id: "monitor", label: "Live Monitor" },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {/* Broadcast Modal */}
      {showBroadcast && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(17,29,51,.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => { setShowBroadcast(false); setBroadcastSent(false); setBroadcastMsg(""); }}>
          <div style={{ background: C.white, borderRadius: 16, padding: 40, width: 440, boxShadow: "0 24px 64px rgba(0,0,0,.18)", animation: "popIn .28s cubic-bezier(.22,.68,0,1.3) both" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: C.navy }}>Broadcast Message</h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: C.grey500 }}>Send a message to all students currently in the session.</p>
            {broadcastSent ? (
              <div style={{ padding: "16px", background: C.tealLight, borderRadius: 9, textAlign: "center", fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 16 }}>
                {Icon.check} Message broadcast to all students.
              </div>
            ) : (
              <>
                <textarea value={broadcastMsg} onChange={(e) => setBroadcastMsg(e.target.value)} placeholder="e.g. 30 minutes remaining. Please save your work." style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: `1.5px solid ${C.grey200}`, fontSize: 14, color: C.grey800, background: C.grey50, minHeight: 100, resize: "vertical", boxSizing: "border-box", outline: "none", fontFamily: "inherit", marginBottom: 16 }} />
                <div style={{ display: "flex", gap: 10 }}>
                  <Btn variant="ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setShowBroadcast(false); setBroadcastMsg(""); }}>Cancel</Btn>
                  <Btn variant="navy" style={{ flex: 1, justifyContent: "center" }} onClick={() => { if (broadcastMsg.trim()) setBroadcastSent(true); }}>Send to All Students</Btn>
                </div>
              </>
            )}
            {broadcastSent && <Btn variant="ghost" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={() => { setShowBroadcast(false); setBroadcastSent(false); setBroadcastMsg(""); }}>Close</Btn>}
          </div>
        </div>
      )}

      {/* ── SCHEDULE ─────────────────────────────────────────────── */}
      {activeTab === "schedule" && <>
        <div className="resp-grid-4" style={{ marginBottom: 28 }}>
          <StatCard label="Assigned Exams" value={invigilatorAssignments.length} icon={Icon.clipboard} />
          <StatCard label="Confirmed" value={invigilatorAssignments.filter(a => a.status === "Confirmed").length} icon={Icon.check} />
          <StatCard label="Total Students" value={invigilatorAssignments.reduce((s, a) => s + a.students, 0)} icon={Icon.users} />
          <StatCard label="Next Exam" value="Jul 2" icon={Icon.calendar} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 28 }}>
          {invigilatorAssignments.map((a, ai) => (
            <Card key={a.exam + a.section} className="resp-flex-row" style={{ gap: 24, alignItems: "center", animation: `slideInLeft .38s cubic-bezier(.22,.68,0,1.1) ${ai * 100}ms both` }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: a.status === "Confirmed" ? C.tealLight : C.grey100, display: "flex", alignItems: "center", justifyContent: "center", color: a.status === "Confirmed" ? C.teal : C.grey500, flexShrink: 0 }}>{Icon.clipboard}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.navy }}>{a.exam}</h3>
                  <Badge>{a.course}</Badge>
                  {statusBadge(a.status)}
                </div>
                <div style={{ display: "flex", gap: 22, rowGap: 6, fontSize: 13, color: C.grey500, flexWrap: "wrap" }}>
                  <span>{Icon.calendar && ""}{a.date} · {a.time}</span>
                  <span>Lab: <strong style={{ color: C.navy }}>{a.lab}</strong></span>
                  <span>Section: <strong style={{ color: C.navy }}>{a.section}</strong></span>
                  <span>Students: <strong style={{ color: C.navy }}>{a.students}</strong></span>
                  <span>Duration: <strong style={{ color: C.navy }}>{a.duration}</strong></span>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: C.grey400 }}>Approved by {a.approvedBy} · {a.questions} questions</div>
              </div>
              <Btn variant="ghost" size="sm" onClick={() => { setActiveTab("start"); setShowStart(a); }}>Start Exam</Btn>
            </Card>
          ))}
        </div>

        <Card>
          <h3 style={{ margin: "0 0 18px", fontWeight: 800, color: C.navy, fontSize: 15 }}>Exam Paper Details</h3>
          <Table
            columns={["Exam", "Course", "Section", "Date", "Time", "Lab", "Students", "Duration", "Status"]}
            rows={invigilatorAssignments.map((a) => [
              <span style={{ fontWeight: 700, color: C.navy }}>{a.exam}</span>,
              <Badge>{a.course}</Badge>,
              a.section, a.date, a.time, a.lab, a.students, a.duration,
              statusBadge(a.status),
            ])} />
        </Card>
        <div style={{ height: 48 }} />
      </>}

      {/* ── START EXAM ───────────────────────────────────────────── */}
      {activeTab === "start" && <>
        {sessionStarted && (
          <div className="resp-flex-space-between" style={{ marginBottom: 24, padding: "20px 26px", background: C.tealLight, borderRadius: 12, border: `2px solid ${C.teal}`, justifyContent: "space-between", animation: "popIn .4s cubic-bezier(.22,.68,0,1.2) both", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${C.teal}, transparent)`, animation: "gradientShift 2s linear infinite", backgroundSize: "200% 100%" }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.teal, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Session Active</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: C.navy }}>{sessionStarted}</div>
              <div style={{ fontSize: 13, color: C.grey500, marginTop: 3 }}>Share this code with students in the lab</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: 6, color: C.navy, background: C.white, padding: "10px 24px", borderRadius: 10, border: `2px solid ${C.tealMid}` }}>{sessionCode}</div>
            </div>
          </div>
        )}

        <h3 style={{ fontSize: 16, fontWeight: 800, color: C.navy, margin: "0 0 16px" }}>HOD-Approved Exams Ready to Start</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
          {invigilatorAssignments.filter(a => a.status === "Confirmed").map((a) => {
            const isLive = sessionStarted === a.exam;
            return (
              <Card key={a.exam} style={{ border: `2px solid ${isLive ? C.teal : C.grey200}`, background: isLive ? C.tealLight : C.white }}>
                <div className="resp-flex-space-between" style={{ justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.navy }}>{a.exam}</h3>
                      <Badge>{a.course}</Badge>
                      {isLive && <Badge color={C.teal} bg={C.tealLight}>LIVE</Badge>}
                    </div>
                    <div style={{ fontSize: 13, color: C.grey500 }}>{a.lab} · {a.date} · {a.time} · {a.students} students</div>
                    {isLive && <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: C.teal }}>Session code: {sessionCode}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
                    {!isLive && <Btn variant="primary" onClick={() => setShowStart(a)}>Start Session</Btn>}
                    {isLive && <><Btn variant="ghost" size="sm" onClick={() => setActiveTab("monitor")}>Go to Monitor</Btn><Btn variant="navy" size="sm" onClick={() => { setSessionStarted(null); setSessionCode(""); }}>End Session</Btn></>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <Card style={{ background: C.grey50 }}>
          <h4 style={{ margin: "0 0 12px", fontWeight: 800, color: C.navy, fontSize: 14 }}>Invigilator Responsibilities</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {["Verify student IDs before admitting to the exam", "Start the session only when all students are seated", "Monitor for suspicious activity using the Live Monitor tab", "End the session only after all students have submitted", "Report any irregularities to HOD immediately after the exam"].map((r) => (
              <div key={r} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: C.grey800 }}>
                <div style={{ width: 18, height: 18, borderRadius: 5, background: C.tealLight, display: "flex", alignItems: "center", justifyContent: "center", color: C.teal, flexShrink: 0, marginTop: 1 }}>{Icon.check}</div>
                {r}
              </div>
            ))}
          </div>
        </Card>
        <div style={{ height: 48 }} />
      </>}

      {/* ── LIVE MONITOR ─────────────────────────────────────────── */}
      {activeTab === "monitor" && <>
        {!sessionStarted ? (
          <Card style={{ textAlign: "center", padding: "48px 24px" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: C.grey100, display: "flex", alignItems: "center", justifyContent: "center", color: C.grey400, margin: "0 auto 16px" }}>{Icon.monitor}</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800, color: C.navy }}>No Active Session</h3>
            <p style={{ margin: "0 0 20px", color: C.grey500, fontSize: 14 }}>Start an exam session from the Start Exam tab to enable live monitoring.</p>
            <Btn variant="primary" onClick={() => setActiveTab("start")}>Go to Start Exam</Btn>
          </Card>
        ) : <>
          <div className="resp-grid-4" style={{ marginBottom: 24 }}>
            <StatCard label="Students Online" value={liveStudents.length} icon={Icon.users} />
            <StatCard label="High Risk" value={liveStudents.filter(s => s.risk === "High").length} icon={Icon.alertTriangle} accent={C.red} light={C.redLight} />
            <StatCard label="Medium Risk" value={liveStudents.filter(s => s.risk === "Medium").length} icon={Icon.bell} accent={C.amber} light={C.amberLight} />
            <StatCard label="Session Code" value={sessionCode} icon={Icon.key} />
          </div>

          <div className="resp-flex-space-between" style={{ marginBottom: 20, padding: "12px 18px", background: C.tealLight, borderRadius: 10, border: `1px solid ${C.tealMid}`, justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>Live Session: {sessionStarted}</span>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Btn variant="ghost" size="sm" onClick={() => setShowBroadcast(true)}>Broadcast Message</Btn>
              <Btn variant="navy" size="sm" onClick={() => { setSessionStarted(null); setSessionCode(""); setActiveTab("start"); }}>End Session</Btn>
            </div>
          </div>

          <div className="resp-grid-3" style={{ marginBottom: 28 }}>
            {liveStudents.map((s, i) => {
              const riskColors = { Low: [C.teal, C.tealLight], Medium: [C.amber, C.amberLight], High: [C.red, C.redLight] };
              const [rc, rbg] = riskColors[s.risk];
              return (
                <Card key={s.id} style={{ border: `2px solid ${s.risk === "High" ? C.red : s.risk === "Medium" ? C.amber : C.grey200}`, animation: `popIn .4s cubic-bezier(.22,.68,0,1.2) ${i * 80}ms both`, transition: "transform .2s ease, box-shadow .2s ease" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="live-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: s.risk === "High" ? C.red : s.risk === "Medium" ? C.amber : C.teal, flexShrink: 0 }} />
                        <div style={{ fontWeight: 800, color: C.navy, fontSize: 14 }}>{s.name}</div>
                      </div>
                      <div style={{ fontSize: 12, color: C.grey400, marginTop: 2 }}>{s.id}</div>
                    </div>
                    {riskBadge(s.risk)}
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.grey500, marginBottom: 5 }}>
                      <span>Progress</span><span style={{ fontWeight: 700, color: C.navy }}>{s.progress}%</span>
                    </div>
                    <div style={{ height: 6, background: C.grey100, borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${s.progress}%`, background: s.risk === "High" ? C.red : C.teal, borderRadius: 99, animation: `barGrow .9s cubic-bezier(.22,.68,0,1.1) ${i * 80 + 200}ms both`, "--w": `${s.progress}%` }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.grey500 }}>
                    <span>Status: <strong style={{ color: s.status === "Active" ? C.teal : C.grey500 }}>{s.status}</strong></span>
                    <span>Flags: <strong style={{ color: s.flags > 2 ? C.red : C.grey800 }}>{s.flags}</strong></span>
                  </div>
                </Card>
              );
            })}
          </div>

          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.grey100}`, fontWeight: 700, fontSize: 15, color: C.navy }}>Risk Summary</div>
            <Table
              columns={["Student", "ID", "Status", "Risk Level", "Flag Count", "Progress"]}
              rows={liveStudents.map((s) => [
                <span style={{ fontWeight: 700, color: C.navy }}>{s.name}</span>,
                s.id, s.status, riskBadge(s.risk),
                <span style={{ fontWeight: 700, color: s.flags > 2 ? C.red : C.grey800 }}>{s.flags}</span>,
                <span style={{ fontWeight: 700, color: C.navy }}>{s.progress}%</span>,
              ])} />
          </Card>
        </>}
        <div style={{ height: 48 }} />
      </>}
    </PageWrap>
  );
}
