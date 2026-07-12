import { useState } from "react";
import { C } from "../theme/colors";
import { Icon } from "../theme/icons";
import PageWrap from "../components/common/PageWrap";
import Card from "../components/common/Card";
import Btn from "../components/common/Btn";
import Badge from "../components/common/Badge";
import StatCard from "../components/common/StatCard";
import JoinExamModal from "../components/JoinExamModal";

export default function StudentPage({ activePage }) {
  const [showJoin, setShowJoin] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);

  const pastExams = [
    { title: "Networks Lab Final", course: "CS-415", date: "Jun 18, 2026", score: 84, total: 100, grade: "A", time: "52 min", questions: 8, breakdown: [{ label: "Subnetting", score: 22, max: 25 }, { label: "Routing Protocols", score: 18, max: 25 }, { label: "Socket Programming", score: 24, max: 30 }, { label: "Network Security", score: 20, max: 20 }] },
    { title: "Database Lab Mid", course: "CS-312", date: "May 10, 2026", score: 71, total: 100, grade: "B", time: "48 min", questions: 6, breakdown: [{ label: "SQL Queries", score: 28, max: 35 }, { label: "Normalization", score: 20, max: 30 }, { label: "ER Diagrams", score: 23, max: 35 }] },
    { title: "OOP Lab Final", course: "CS-211", date: "Jan 22, 2026", score: 91, total: 100, grade: "A+", time: "58 min", questions: 7, breakdown: [{ label: "Inheritance", score: 30, max: 30 }, { label: "Polymorphism", score: 28, max: 30 }, { label: "STL & Templates", score: 33, max: 40 }] },
  ];

  function gradeColor(g) {
    if (g === "A+" || g === "A") return [C.navy, C.tealLight];
    if (g === "B") return [C.teal, C.tealLight];
    return [C.grey500, C.grey100];
  }

  const avg = Math.round(pastExams.reduce((s, e) => s + e.score, 0) / pastExams.length);

  return (
    <PageWrap title="Dashboard" subtitle="Join exam sessions and review your academic performance"
      actions={<Btn variant="primary" onClick={() => setShowJoin(true)}>Join Exam with Code</Btn>}>
      {showJoin && <JoinExamModal onClose={() => setShowJoin(false)} />}

      <div className="resp-grid-4" style={{ marginBottom: 28 }}>
        <StatCard label="Exams Completed" value={3} icon={Icon.clipboardList} delay={0} />
        <StatCard label="Average Score" value={`${avg}%`} icon={Icon.chart} delay={80} />
        <StatCard label="Best Grade" value="A+" icon={Icon.trendingUp} delay={160} />
        <StatCard label="Total Time Spent" value="2h 38m" icon={Icon.monitor} delay={240} />
      </div>

      <div className="resp-flex-space-between" style={{ background: C.navy, borderRadius: 14, padding: "26px 32px", marginBottom: 28, justifyContent: "space-between" }}>
        <div>
          <h3 style={{ color: C.white, margin: "0 0 6px", fontSize: 17, fontWeight: 800 }}>Ready to sit an exam?</h3>
          <p style={{ color: "rgba(255,255,255,.6)", margin: 0, fontSize: 14 }}>Enter the session code your invigilator shares at the start. You cannot view the paper until the session is opened.</p>
        </div>
        <Btn variant="primary" size="lg" onClick={() => setShowJoin(true)} style={{ flexShrink: 0 }}>Enter Session Code</Btn>
      </div>

      <h2 style={{ fontSize: 17, fontWeight: 800, color: C.navy, margin: "0 0 18px", letterSpacing: -0.2 }}>Past Exam Results</h2>
      <div className="resp-grid-3" style={{ marginBottom: 28 }}>
        {pastExams.map((e) => {
          const [gc] = gradeColor(e.grade);
          const pct = Math.round((e.score / e.total) * 100);
          const isSelected = selectedExam?.title === e.title;
          return (
            <Card key={e.title} style={{ cursor: "pointer", border: `2px solid ${isSelected ? C.teal : C.grey200}`, position: "relative", overflow: "hidden" }} onClick={() => setSelectedExam(isSelected ? null : e)}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: gc }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <Badge>{e.course}</Badge>
                <span style={{ fontSize: 24, fontWeight: 900, color: gc }}>{e.grade}</span>
              </div>
              <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 800, color: C.navy, lineHeight: 1.3 }}>{e.title}</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
                <div style={{ position: "relative", width: 52, height: 52, flexShrink: 0 }}>
                  <svg viewBox="0 0 52 52" width="52" height="52">
                    <circle cx="26" cy="26" r="20" fill="none" stroke={C.grey100} strokeWidth="5" />
                    <circle cx="26" cy="26" r="20" fill="none" stroke={gc} strokeWidth="5"
                      strokeDasharray={`${2 * Math.PI * 20 * pct / 100} ${2 * Math.PI * 20}`}
                      strokeLinecap="round" transform="rotate(-90 26 26)" />
                    <text x="26" y="30" textAnchor="middle" fontSize="10" fontWeight="800" fill={C.navy}>{pct}%</text>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 19, fontWeight: 900, color: C.navy }}>{e.score}<span style={{ fontSize: 12, color: C.grey400, fontWeight: 600 }}>/{e.total}</span></div>
                  <div style={{ fontSize: 12, color: C.grey400, marginTop: 1 }}>{e.date}</div>
                  <div style={{ fontSize: 12, color: C.grey400 }}>{e.time} · {e.questions} questions</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: C.teal, fontWeight: 700, borderTop: `1px solid ${C.grey100}`, paddingTop: 10, textAlign: "center" }}>
                {isSelected ? "Hide breakdown" : "View breakdown"}
              </div>
            </Card>
          );
        })}
      </div>

      {selectedExam && (
        <Card style={{ marginBottom: 28, borderTop: `4px solid ${C.teal}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
            <div>
              <h3 style={{ margin: "0 0 3px", fontSize: 16, fontWeight: 800, color: C.navy }}>{selectedExam.title} — Breakdown</h3>
              <span style={{ fontSize: 13, color: C.grey500 }}>Score by topic</span>
            </div>
            <button onClick={() => setSelectedExam(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.grey400, display: "flex" }}>{Icon.x}</button>
          </div>
          <div className="resp-grid-2" style={{ gap: "4px 40px" }}>
            {selectedExam.breakdown.map((b) => {
              const pct = Math.round((b.score / b.max) * 100);
              return (
                <div key={b.label} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: C.grey800, marginBottom: 6 }}>
                    <span>{b.label}</span><span style={{ color: C.grey500 }}>{b.score}/{b.max}</span>
                  </div>
                  <div style={{ height: 7, background: C.grey100, borderRadius: 99 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: C.teal, borderRadius: 99 }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 18, padding: "12px 16px", background: C.grey50, borderRadius: 9, fontSize: 13, color: C.grey500, display: "flex", gap: 28, flexWrap: "wrap" }}>
            <span>Total: <strong style={{ color: C.navy }}>{selectedExam.score}/{selectedExam.total}</strong></span>
            <span>Time: <strong style={{ color: C.navy }}>{selectedExam.time}</strong></span>
            <span>Questions: <strong style={{ color: C.navy }}>{selectedExam.questions}</strong></span>
            <span>Grade: <strong style={{ color: C.navy }}>{selectedExam.grade}</strong></span>
          </div>
        </Card>
      )}

      <Card>
        <h3 style={{ margin: "0 0 18px", fontWeight: 800, color: C.navy, fontSize: 15 }}>Score Trend</h3>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 96, marginBottom: 8 }}>
          {[...pastExams].reverse().map((e) => {
            const h = Math.round((e.score / e.total) * 96);
            return (
              <div key={e.title} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.navy }}>{e.score}%</span>
                <div style={{ width: "100%", height: h, background: `linear-gradient(to top, ${C.teal}, ${C.tealMid})`, borderRadius: "5px 5px 0 0", minHeight: 8 }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[...pastExams].reverse().map((e) => (
            <div key={e.title} style={{ flex: 1, textAlign: "center", fontSize: 11, color: C.grey400, fontWeight: 600 }}>{e.course}</div>
          ))}
        </div>
      </Card>
      <div style={{ height: 48 }} />
    </PageWrap>
  );
}
