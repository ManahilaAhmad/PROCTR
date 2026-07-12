import { C } from "../theme/colors";
import { Icon } from "../theme/icons";
import Btn from "../components/common/Btn";
import Card from "../components/common/Card";
import Badge from "../components/common/Badge";

export default function AboutPage({ setPage }) {
  return (
    <div style={{ minHeight: "100vh", background: C.white }}>
      <nav className="homepage-nav" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 66, borderBottom: `1px solid ${C.grey200}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setPage("home")}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: C.navy, display: "flex", alignItems: "center", justifyContent: "center", color: C.white }}>{Icon.shield}</div>
          <span style={{ fontWeight: 900, fontSize: 19, color: C.navy }}>PROCTR</span>
        </div>
        <Btn variant="navy" size="sm" onClick={() => setPage("login")}>Sign in</Btn>
      </nav>

      <div className="resp-page-padding" style={{ maxWidth: 840, margin: "0 auto", paddingBottom: 64 }}>
        <Badge>About the project</Badge>
        <h1 className="about-title" style={{ fontWeight: 900, color: C.navy, margin: "18px 0 14px", letterSpacing: -1 }}>
          Intelligent Secure Lab Examination System with Behavioral Risk Analysis
        </h1>
        <p style={{ fontSize: 16, color: C.grey500, lineHeight: 1.8, marginBottom: 44 }}>
          PROCTR is a Final Year Project developed at the Faculty of Computing and Artificial Intelligence. It addresses the growing challenge of cheating in lab exams through AI-driven behavioral monitoring, automated evaluation, and a complete LMS workflow for all academic stakeholders.
        </p>

        <div className="resp-grid-2" style={{ marginBottom: 48 }}>
          <Card style={{ borderLeft: `4px solid ${C.teal}` }}>
            <h3 style={{ margin: "0 0 9px", color: C.navy, fontSize: 15, fontWeight: 800 }}>Problem</h3>
            <p style={{ margin: 0, fontSize: 14, color: C.grey500, lineHeight: 1.7 }}>Teachers cannot supervise many students at once. Students exploit this with unauthorized apps, USBs, and files — existing solutions rely on invasive cameras or incomplete browser locks.</p>
          </Card>
          <Card style={{ borderLeft: `4px solid ${C.navy}` }}>
            <h3 style={{ margin: "0 0 9px", color: C.navy, fontSize: 15, fontWeight: 800 }}>Solution</h3>
            <p style={{ margin: 0, fontSize: 14, color: C.grey500, lineHeight: 1.7 }}>A desktop application on lab PCs that monitors behavior at the OS level, combined with a web LMS for exam creation, approval, scheduling, and result visualization — no cameras needed.</p>
          </Card>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.navy, marginBottom: 20, letterSpacing: -0.3 }}>System Modules</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 48 }}>
          {[
            ["Authentication Module", "Role-based login for all 6 user types with secure session management"],
            ["Lab Network Validation", "IP-range verification ensures only lab computers can join an exam session"],
            ["Exam Session Management", "Create, distribute, time, and collect exam submissions in one flow"],
            ["Exam Environment Control", "USB blocking, app restrictions, and anti-close enforcement"],
            ["Student Activity Tracking", "Logs window switching, clipboard events, and USB insertion attempts"],
            ["AI Cheating Detection", "Risk scoring based on behavioral patterns with timeline reports"],
            ["Live Monitoring Module", "Real-time per-student feeds for invigilators"],
            ["Crash Recovery & Resume", "Exam state preserved — students resume seamlessly after a disconnect"],
            ["AI Exam Checking", "Automated rubric-based evaluation of student submissions"],
            ["Admin Control Module", "System-wide settings, user management, and notification configuration"],
          ].map(([name, desc]) => (
            <div key={name} style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: "14px 18px", background: C.grey50, borderRadius: 9, border: `1px solid ${C.grey200}` }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.teal, marginTop: 6, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, color: C.navy, fontSize: 14 }}>{name}</div>
                <div style={{ fontSize: 13, color: C.grey500, marginTop: 2 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.navy, marginBottom: 18, letterSpacing: -0.3 }}>Project Team</h2>
        <div className="resp-grid-4" style={{ gap: 14 }}>
          {[
            { name: "Manahil Ahmad", id: "231557", role: "Team Member" },
            { name: "Sumaiyyah Masood", id: "231596", role: "Team Member" },
            { name: "Shanawar Raza", id: "231593", role: "Team Member" },
            { name: "Dr Sumaira Farid", id: "", role: "Supervisor" },
          ].map((m) => (
            <Card key={m.name} style={{ textAlign: "center", padding: "22px 14px" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: m.role === "Supervisor" ? C.navy : C.tealLight, display: "flex", alignItems: "center", justifyContent: "center", color: m.role === "Supervisor" ? C.white : C.teal, margin: "0 auto 12px" }}>{Icon.users}</div>
              <div style={{ fontWeight: 800, color: C.navy, fontSize: 14 }}>{m.name}</div>
              {m.id && <div style={{ color: C.grey400, fontSize: 12, marginTop: 2 }}>{m.id}</div>}
              <div style={{ marginTop: 8 }}><Badge color={m.role === "Supervisor" ? C.navy : C.teal} bg={m.role === "Supervisor" ? C.grey100 : C.tealLight}>{m.role}</Badge></div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

