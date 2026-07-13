import { useState } from "react";
import { C } from "../theme/colors";
import { Icon } from "../theme/icons";
import PageWrap from "../components/common/PageWrap";
import Card from "../components/common/Card";
import Btn from "../components/common/Btn";
import Input from "../components/common/Input";
import Badge from "../components/common/Badge";
import StatCard from "../components/common/StatCard";

// Mock faculty / coordinator notifications
const initialNotifications = [
  { id: 1, sender: "Coordinator", date: "Jul 12, 2026", subject: "July Exam Schedule Published", msg: "The final datesheet for BSCS 6th Semester lab exams has been published. Please review your schedules under the date sheet section.", isCritical: true },
  { id: 2, sender: "Prof. Arif Khan", date: "Jul 10, 2026", subject: "Networks Lab Seating Plan", msg: "Students of section A are directed to report to Lab-2, and section B to Lab-3 for the upcoming practical final.", isCritical: false },
  { id: 3, sender: "Dept. Exam Committee", date: "Jul 08, 2026", subject: "Mandatory Student ID Cards", msg: "No student will be allowed to sit in the lab final exam without their physical student registration card.", isCritical: true },
];

export default function StudentPage({ activePage }) {
  const [selectedExam, setSelectedExam] = useState(null);

  // Profile states
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [toast, setToast] = useState(null);

  // Student details (Read-only)
  const studentInfo = {
    name: "Ali Hassan",
    rollNo: "2021-CS-101",
    email: "ali.hassan@university.edu",
    phone: "+92 300 1234567",
    degree: "BS Computer Science",
    semester: "6th Semester (Spring 2026)",
    advisor: "Dr. Sana Mir",
    gpa: "3.78",
  };

  const [avatarImg, setAvatarImg] = useState(null); // File object url or null

  const pastExams = [
    { title: "Networks Lab Final", course: "CS-415", date: "Jun 18, 2026", score: 84, total: 100, grade: "A", time: "52 min", questions: 8, breakdown: [{ label: "Subnetting", score: 22, max: 25 }, { label: "Routing Protocols", score: 18, max: 25 }, { label: "Socket Programming", score: 24, max: 30 }, { label: "Network Security", score: 20, max: 20 }] },
    { title: "Database Lab Mid", course: "CS-312", date: "May 10, 2026", score: 71, total: 100, grade: "B", time: "48 min", questions: 6, breakdown: [{ label: "SQL Queries", score: 28, max: 35 }, { label: "Normalization", score: 20, max: 30 }, { label: "ER Diagrams", score: 23, max: 35 }] },
    { title: "OOP Lab Final", course: "CS-211", date: "Jan 22, 2026", score: 91, total: 100, grade: "A+", time: "58 min", questions: 7, breakdown: [{ label: "Inheritance", score: 30, max: 30 }, { label: "Polymorphism", score: 28, max: 30 }, { label: "STL & Templates", score: 33, max: 40 }] },
  ];

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }

  function handlePasswordUpdate() {
    if (!currentPass || !newPass || !confirmPass) {
      showToast("Please fill all password fields.", "warn");
      return;
    }
    if (newPass !== confirmPass) {
      showToast("Passwords do not match.", "warn");
      return;
    }
    showToast("Password updated successfully!");
    setCurrentPass(""); setNewPass(""); setConfirmPass("");
  }

  function handleAvatarChange(e) {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast("Image size must be less than 2MB.", "warn");
        return;
      }
      setAvatarImg(URL.createObjectURL(file));
      showToast("Profile picture updated!");
    }
  }

  function gradeColor(g) {
    if (g === "A+" || g === "A") return [C.navy, C.tealLight];
    if (g === "B") return [C.teal, C.tealLight];
    return [C.grey500, C.grey100];
  }

  const avg = Math.round(pastExams.reduce((s, e) => s + e.score, 0) / pastExams.length);

  // ── Render Dashboard Page ──
  if (activePage === "student") {
    return (
      <PageWrap title="Student Dashboard" subtitle="Manage your profile, update credentials, and check announcements">
        {toast && (
          <div style={{ position: "fixed", top: 24, right: 24, zIndex: 300, background: toast.type === "warn" ? C.amber : C.navy, color: C.white, padding: "13px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,.2)", display: "flex", alignItems: "center", gap: 10 }}>
            {toast.type === "warn" ? Icon.alertTriangle : Icon.check} {toast.msg}
          </div>
        )}

        <div className="resp-grid-2" style={{ gap: 24, marginBottom: 28 }}>
          {/* Profile Card */}
          <Card style={{ display: "flex", flexDirection: "column", gap: 22, position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                {/* Avatar with click-to-upload option */}
                <div style={{ position: "relative", width: 76, height: 76, borderRadius: "50%", overflow: "hidden", cursor: "pointer", border: `2px solid ${C.teal}` }} onClick={() => document.getElementById("avatar-upload-input").click()}>
                  {avatarImg ? (
                    <img src={avatarImg} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: C.tealLight, display: "flex", alignItems: "center", justifyContent: "center", color: C.teal, fontSize: 24, fontWeight: 800 }}>
                      {studentInfo.name.split(" ").map(w => w[0]).join("")}
                    </div>
                  )}
                  {/* Photo Overlay */}
                  <div style={{ position: "absolute", inset: 0, background: "rgba(11,25,46,0.5)", display: "flex", alignItems: "center", justifyContent: "center", color: C.white, opacity: 0, transition: "opacity 0.2s" }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                    <span style={{ fontSize: 11, fontWeight: 700 }}>Upload</span>
                  </div>
                </div>
                <input id="avatar-upload-input" type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
                
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: C.navy }}>{studentInfo.name}</h3>
                  <Badge>{studentInfo.rollNo}</Badge>
                </div>
              </div>
            </div>

            {/* Profile fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, borderTop: `1px solid ${C.grey100}`, paddingTop: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 0" }}>
                <span style={{ color: C.grey500 }}>Roll Number</span>
                <span style={{ color: C.navy, fontWeight: 700 }}>{studentInfo.rollNo}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 0" }}>
                <span style={{ color: C.grey500 }}>Email Address</span>
                <span style={{ color: C.navy, fontWeight: 700 }}>{studentInfo.email}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 0" }}>
                <span style={{ color: C.grey500 }}>Phone Number</span>
                <span style={{ color: C.navy, fontWeight: 700 }}>{studentInfo.phone}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 0" }}>
                <span style={{ color: C.grey500 }}>Degree Program</span>
                <span style={{ color: C.navy, fontWeight: 700 }}>{studentInfo.degree}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 0" }}>
                <span style={{ color: C.grey500 }}>Semester</span>
                <span style={{ color: C.navy, fontWeight: 700 }}>{studentInfo.semester}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 0" }}>
                <span style={{ color: C.grey500 }}>Academic Advisor</span>
                <span style={{ color: C.navy, fontWeight: 700 }}>{studentInfo.advisor}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 0" }}>
                <span style={{ color: C.grey500 }}>Current CGPA</span>
                <span style={{ color: C.navy, fontWeight: 700 }}>{studentInfo.gpa}</span>
              </div>
            </div>
          </Card>

          {/* Password Update Card */}
          <Card>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800, color: C.navy }}>Change Security Password</h3>
            <Input label="Current Password" type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} />
            <Input label="New Password" type="password" value={newPass} onChange={e => setNewPass(e.target.value)} />
            <Input label="Confirm New Password" type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} />
            <Btn variant="navy" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={handlePasswordUpdate}>Update Password</Btn>
          </Card>
        </div>

        {/* Notifications from Faculty */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <div style={{ color: C.navy, display: "flex" }}>{Icon.bell}</div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.navy }}>Faculty Announcements & Broadcasts</h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {initialNotifications.map(n => (
              <div key={n.id} style={{ padding: "16px 20px", borderRadius: 10, background: n.isCritical ? "rgba(225,29,72,.05)" : C.grey50, border: `1px solid ${n.isCritical ? "#f43f5e33" : C.grey200}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: n.isCritical ? C.red : C.teal, textTransform: "uppercase", letterSpacing: 0.5 }}>{n.sender}</span>
                    <h4 style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 800, color: C.navy }}>{n.subject}</h4>
                  </div>
                  <span style={{ fontSize: 12, color: C.grey400 }}>{n.date}</span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: C.grey600, lineHeight: 1.6 }}>{n.msg}</p>
              </div>
            ))}
          </div>
        </Card>
      </PageWrap>
    );
  }

  // ── Render Results Page ──
  return (
    <PageWrap title="My Results" subtitle="Detailed breakdown of your academic performances and final lab exams">
      <div className="resp-grid-4" style={{ marginBottom: 28 }}>
        <StatCard label="Exams Completed" value={3} icon={Icon.clipboardList} delay={0} />
        <StatCard label="Average Score" value={`${avg}%`} icon={Icon.chart} delay={80} />
        <StatCard label="Best Grade" value="A+" icon={Icon.trendingUp} delay={160} />
        <StatCard label="Total Time Spent" value="2h 38m" icon={Icon.monitor} delay={240} />
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

      <Card style={{ marginBottom: 24 }}>
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
    </PageWrap>
  );
}
