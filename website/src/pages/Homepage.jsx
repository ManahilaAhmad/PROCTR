import { C } from "../theme/colors";
import { Icon } from "../theme/icons";
import Btn from "../components/common/Btn";
import Badge from "../components/common/Badge";

export default function Homepage({ setPage }) {
  return (
    <div style={{ minHeight: "100vh", background: C.white }}>
      <nav className="homepage-nav" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 66, borderBottom: `1px solid ${C.grey200}`, position: "sticky", top: 0, background: "rgba(255,255,255,.92)", backdropFilter: "blur(12px)", zIndex: 50, animation: "fadeIn .5s ease both" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: C.navy, display: "flex", alignItems: "center", justifyContent: "center", color: C.white }}>{Icon.shield}</div>
          <span style={{ fontWeight: 900, fontSize: 19, color: C.navy, letterSpacing: -0.5 }}>PROCTR</span>
        </div>
        <div className="hide-mobile" style={{ display: "flex", gap: 32 }}>
          {["Features", "Roles", "Security", "About"].map((l) => (
            <span key={l} className="tab-btn" onClick={() => l === "About" && setPage("about")} style={{ fontSize: 14, fontWeight: 600, color: C.grey500, cursor: "pointer" }}>{l}</span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="ghost" size="sm" onClick={() => setPage("login")}>Log in</Btn>
          <Btn variant="primary" size="sm" className="cta-btn" onClick={() => setPage("login")}>Get started</Btn>
        </div>
      </nav>

      {/* HERO */}
      <section className="homepage-hero" style={{ background: `linear-gradient(135deg, ${C.navyDark} 0%, ${C.navy} 45%, #1e3a5f 100%)`, backgroundSize: "200% 200%", animation: "gradientShift 8s ease infinite", textAlign: "center", position: "relative", overflow: "hidden" }}>
        {/* Animated particle field */}
        {[
          { top: "12%", left: "7%", size: 6, delay: "0s", dur: "3.8s" },
          { top: "28%", left: "18%", size: 4, delay: "0.6s", dur: "5s" },
          { top: "65%", left: "5%", size: 8, delay: "1.2s", dur: "4.2s" },
          { top: "80%", left: "25%", size: 3, delay: "0.3s", dur: "6s" },
          { top: "15%", right: "9%", size: 5, delay: "1s", dur: "4.5s" },
          { top: "45%", right: "6%", size: 7, delay: "0.5s", dur: "3.5s" },
          { top: "72%", right: "18%", size: 4, delay: "1.4s", dur: "5.2s" },
          { top: "88%", right: "32%", size: 6, delay: "0.8s", dur: "4s" },
          { top: "35%", left: "45%", size: 3, delay: "2s", dur: "7s" },
        ].map((p, i) => (
          <div key={i} style={{ position: "absolute", top: p.top, left: p.left, right: p.right, width: p.size, height: p.size, borderRadius: "50%", background: C.teal, opacity: .35, animation: `drift ${p.dur} ease-in-out ${p.delay} infinite`, pointerEvents: "none" }} />
        ))}
        {/* Glowing rings */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 600, borderRadius: "50%", border: `1px solid ${C.teal}18`, pointerEvents: "none", animation: "pulse2 4s ease infinite" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 900, height: 900, borderRadius: "50%", border: `1px solid ${C.teal}0d`, pointerEvents: "none", animation: "pulse2 4s ease infinite .8s" }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="hero-badge"><Badge color={C.teal} bg="rgba(0,180,166,.15)">FYP Project — Faculty of Computing & AI</Badge></div>
          <h1 className="hero-text hero-title" style={{ color: C.white, fontWeight: 900, letterSpacing: -1.8, margin: "22px auto 18px", maxWidth: 720 }}>
            Secure Lab Exams,<br /><span style={{ color: C.teal, position: "relative" }}>Intelligent Monitoring</span>
          </h1>
          <p className="hero-sub" style={{ color: "rgba(255,255,255,.65)", fontSize: 17, maxWidth: 540, margin: "0 auto 40px", lineHeight: 1.75 }}>
            PROCTR combines AI behavioral analysis, environment control, and automated evaluation to eliminate cheating while reducing instructor workload.
          </p>
          <div className="hero-btns hero-btns-container">
            <button className="cta-btn" onClick={() => setPage("login")} style={{ padding: "14px 32px", borderRadius: 10, border: "none", background: C.teal, color: C.white, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Sign in to PROCTR</button>
            <button className="cta-btn" onClick={() => setPage("about")} style={{ padding: "14px 32px", borderRadius: 10, border: "1px solid rgba(255,255,255,.2)", background: "rgba(255,255,255,.1)", color: C.white, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Learn more</button>
          </div>
          <div className="hero-stats hero-stats-container">
            {[["6", "User Roles"], ["8", "System Modules"], ["AI", "Cheating Detection"], ["100%", "Privacy-Friendly"]].map(([v, l], i) => (
              <div key={l} style={{ textAlign: "center", animation: `countUp .6s cubic-bezier(.22,.68,0,1.2) ${.7 + i * .12}s both` }}>
                <div style={{ fontSize: 36, fontWeight: 900, color: C.teal }}>{v}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)", marginTop: 5, fontWeight: 600, letterSpacing: .5, textTransform: "uppercase" }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="resp-page-padding" style={{ paddingBottom: 64 }}>
        <div style={{ textAlign: "center", marginBottom: 52, animation: "fadeUp .6s ease both" }}>
          <Badge>Core Features</Badge>
          <h2 style={{ fontSize: 34, fontWeight: 800, color: C.navy, margin: "14px 0 10px", letterSpacing: -.7 }}>Everything you need for secure exams</h2>
          <p style={{ color: C.grey500, fontSize: 15 }}>Built for real university lab environments</p>
        </div>
        <div className="resp-grid-3" style={{ maxWidth: 1060, margin: "0 auto" }}>
          {[
            { icon: Icon.users, title: "AI Cheating Detection", desc: "Behavioral risk scores based on window switching, clipboard usage, and suspicious activity patterns." },
            { icon: Icon.lock, title: "Environment Control", desc: "Restrict USB access, block unauthorized applications, and prevent exam application from closing." },
            { icon: Icon.monitor, title: "Live Monitoring", desc: "Real-time dashboard for invigilators with per-student activity feeds and instant alerts." },
            { icon: Icon.clipboardList, title: "Exam Management", desc: "Teachers upload papers, HOD approves, coordinator schedules — a complete workflow." },
            { icon: Icon.chart, title: "Auto Evaluation", desc: "Intelligent agent grades submissions using teacher-defined rubrics with instant results." },
            { icon: Icon.server, title: "Network Validation", desc: "Only approved lab IP ranges can connect — no external devices allowed during exams." },
          ].map((f, i) => (
            <div key={f.title} className="feature-card" style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.grey200}`, padding: 30, animation: `popIn .5s cubic-bezier(.22,.68,0,1.2) ${.1 + i * .09}s both` }}>
              <div style={{ color: C.teal, marginBottom: 16, display: "flex" }}>{f.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: C.navy, margin: "0 0 9px" }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: C.grey500, margin: 0, lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ROLES */}
      <section className="resp-page-padding" style={{ paddingBottom: 64, background: C.grey50 }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <Badge>Who uses PROCTR</Badge>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: C.navy, margin: "14px 0 0", letterSpacing: -.6 }}>Built for every stakeholder</h2>
        </div>
        <div className="roles-container">
          {[
            { role: "Student", icon: Icon.users, desc: "View schedules, sit exams, receive feedback" },
            { role: "Teacher", icon: Icon.clipboardList, desc: "Upload papers, submit to HOD, track approvals" },
            { role: "HOD", icon: Icon.check, desc: "Approve or reject exam papers with feedback" },
            { role: "Invigilator", icon: Icon.userCheck, desc: "Start approved sessions and monitor students live" },
            { role: "Coordinator", icon: Icon.calendar, desc: "Create date sheets and assign lab rooms" },
            { role: "Director Exam", icon: Icon.chart, desc: "View analytics, reports and exam quality data" },
          ].map((r, i) => (
            <div key={r.role} className="role-card" style={{ background: C.white, border: `1px solid ${C.grey200}`, borderRadius: 12, padding: "26px 22px", width: 185, textAlign: "center", animation: `popIn .5s cubic-bezier(.22,.68,0,1.2) ${i * .08}s both` }}>
              <div style={{ color: C.teal, display: "flex", justifyContent: "center", marginBottom: 14 }}>{r.icon}</div>
              <div style={{ fontWeight: 800, color: C.navy, fontSize: 15, marginBottom: 7 }}>{r.role}</div>
              <div style={{ fontSize: 13, color: C.grey500, lineHeight: 1.55 }}>{r.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="homepage-footer" style={{ background: C.navy }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: C.teal, display: "flex", alignItems: "center", justifyContent: "center", color: C.white }}>{Icon.shield}</div>
          <span style={{ color: C.white, fontWeight: 800, fontSize: 17 }}>PROCTR</span>
        </div>
        <span style={{ color: "rgba(255,255,255,.35)", fontSize: 13 }}>Faculty of Computing & Artificial Intelligence · FYP 2025–26</span>
        <Btn variant="primary" size="sm" onClick={() => setPage("login")}>Sign in</Btn>
      </footer>
    </div>
  );
}
