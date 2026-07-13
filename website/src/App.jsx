import { useState } from "react";
import { C } from "./theme/colors";
import { Icon } from "./theme/icons";
import Sidebar from "./components/common/Sidebar";
import LoginPage from "./pages/LoginPage";
import Homepage from "./pages/Homepage";
import AboutPage from "./pages/AboutPage";
import TeacherPage from "./pages/TeacherPage";
import StudentPage from "./pages/StudentPage";
import HODPage from "./pages/HODPage";
import DirectorPage from "./pages/DirectorPage";
import CoordinatorPage from "./pages/CoordinatorPage";
import InvigilatorPage from "./pages/InvigilatorPage";
import DECPage from "./pages/DECPage";

const dashboardPages = ["teacher", "student", "hod", "director", "coordinator", "invigilator", "dec"];

export default function App() {
  const [page, setPage] = useState("login");
  const [role, setRole] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigateTo = (p) => {
    setPage(p);
    setSidebarOpen(false);
  };

  function renderPage() {
    if (page === "home") return <Homepage setPage={navigateTo} />;
    if (page === "about") return <AboutPage setPage={navigateTo} />;
    if (page === "login") return <LoginPage setPage={navigateTo} setRole={setRole} />;

    const isDashboard = dashboardPages.includes(page) ||
      ["upload", "inv-schedule", "results", "reports", "dir-timetable", "dir-labs", "dir-results", "rooms", "dec-exams", "dec-invigilators", "dec-swaps"].includes(page);

    if (isDashboard) {
      const mainPage = {
        teacher: <TeacherPage activePage="teacher" setPage={navigateTo} />,
        upload: <TeacherPage activePage="upload" setPage={navigateTo} />,
        "inv-schedule": <TeacherPage activePage="inv-schedule" setPage={navigateTo} />,
        student: <StudentPage activePage="student" setPage={navigateTo} />,
        results: <StudentPage activePage="results" setPage={navigateTo} />,
        hod: <HODPage activePage="hod" setPage={navigateTo} />,
        reports: <HODPage activePage="reports" setPage={navigateTo} />,
        director: <DirectorPage activePage="overview" setPage={navigateTo} />,
        "dir-timetable": <DirectorPage activePage="dir-timetable" setPage={navigateTo} />,
        "dir-labs": <DirectorPage activePage="dir-labs" setPage={navigateTo} />,
        "dir-results": <DirectorPage activePage="dir-results" setPage={navigateTo} />,
        coordinator: <CoordinatorPage activePage="coordinator" setPage={navigateTo} />,
        rooms: <CoordinatorPage activePage="rooms" setPage={navigateTo} />,
        dec: <DECPage activePage="dec" setPage={navigateTo} />,
        "dec-exams": <DECPage activePage="dec-exams" setPage={navigateTo} />,
        "dec-invigilators": <DECPage activePage="dec-invigilators" setPage={navigateTo} />,
        "dec-swaps": <DECPage activePage="dec-swaps" setPage={navigateTo} />,
      }[page];

      return (
        <div className="resp-layout-container">
          {/* Mobile top navigation header */}
          <header className="resp-mobile-header">
            <button
              onClick={() => setSidebarOpen(true)}
              style={{ background: "none", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "6px" }}
              aria-label="Open navigation menu"
            >
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: C.teal, display: "flex", alignItems: "center", justifyContent: "center", color: C.white }}>
                {Icon.shield}
              </div>
              <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: -0.3 }}>PROCTR</span>
              <span style={{ background: "rgba(0,180,166,.15)", color: C.teal, fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 10, textTransform: "uppercase" }}>{role}</span>
            </div>
            <button
              onClick={() => { setRole(null); navigateTo("login"); }}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,.6)", cursor: "pointer", display: "flex", alignItems: "center", padding: "6px" }}
              aria-label="Logout"
            >
              {Icon.logout}
            </button>
          </header>

          {/* Backdrop for mobile sidebar drawer */}
          <div
            className={`resp-sidebar-backdrop ${sidebarOpen ? "show" : ""}`}
            onClick={() => setSidebarOpen(false)}
          />

          <Sidebar
            role={role}
            activePage={page}
            setPage={navigateTo}
            setRole={setRole}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
          />
          {mainPage}
        </div>
      );
    }
    return <Homepage setPage={navigateTo} />;
  }

  return (
    <div style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", minHeight: "100vh" }}>
      <style>{`
        @keyframes pageIn   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideInLeft { from{opacity:0;transform:translateX(-32px)} to{opacity:1;transform:translateX(0)} }
        @keyframes slideInRight { from{opacity:0;transform:translateX(32px)} to{opacity:1;transform:translateX(0)} }
        @keyframes popIn    { from{opacity:0;transform:scale(.88)} to{opacity:1;transform:scale(1)} }
        @keyframes countUp  { from{opacity:0;transform:translateY(14px) scale(.9)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes shimmer  { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        @keyframes pulse2   { 0%,100%{opacity:1} 50%{opacity:.45} }
        @keyframes ripple   { 0%{transform:scale(0);opacity:.5} 100%{transform:scale(2.8);opacity:0} }
        @keyframes drift    { 0%{transform:translate(0,0) rotate(0deg)} 33%{transform:translate(12px,-18px) rotate(120deg)} 66%{transform:translate(-8px,10px) rotate(240deg)} 100%{transform:translate(0,0) rotate(360deg)} }
        @keyframes heroTextIn { from{opacity:0;transform:translateY(40px) skewY(2deg)} to{opacity:1;transform:translateY(0) skewY(0)} }
        @keyframes heroBadgeIn{ from{opacity:0;transform:translateY(-14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes gradientShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes spin     { to{transform:rotate(360deg)} }
        @keyframes shakeX   { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
        @keyframes floatDot { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-18px)} }
        @keyframes pulse-ring { 0%{transform:scale(1);opacity:.6} 70%{transform:scale(1.5);opacity:0} 100%{transform:scale(1.5);opacity:0} }
        @keyframes fadeUp   { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
        @keyframes rowIn    { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
        @keyframes barGrow  { from{width:0} to{width:var(--w)} }
        @keyframes liveBlip { 0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(239,68,68,.5)} 50%{transform:scale(1.15);box-shadow:0 0 0 8px rgba(239,68,68,0)} }
        @keyframes cardHover{ to{transform:translateY(-4px);box-shadow:0 16px 40px rgba(26,43,75,.13)} }
        .page-enter { animation: pageIn .35s cubic-bezier(.22,.68,0,1.1) both; }
        .stat-card  { animation: countUp .5s cubic-bezier(.22,.68,0,1.2) both; transition: transform .2s ease, box-shadow .2s ease; }
        .stat-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(26,43,75,.1); }
        .feature-card { transition: transform .22s cubic-bezier(.22,.68,0,1.2), box-shadow .22s ease, border-color .22s ease; }
        .feature-card:hover { transform: translateY(-6px) scale(1.02); box-shadow: 0 20px 48px rgba(26,43,75,.14); border-color: ${C.teal}; }
        .role-card  { transition: transform .22s cubic-bezier(.22,.68,0,1.2), box-shadow .22s ease; }
        .role-card:hover { transform: translateY(-5px); box-shadow: 0 14px 36px rgba(0,180,166,.18); }
        .nav-btn    { transition: all .18s cubic-bezier(.22,.68,0,1.2); }
        .nav-btn:hover { background: rgba(255,255,255,.08) !important; transform: translateX(3px); }
        .nav-btn-active { animation: slideInLeft .3s cubic-bezier(.22,.68,0,1.2) both; }
        .sidebar-enter > button { animation: slideInLeft .3s cubic-bezier(.22,.68,0,1.2) both; }
        .hero-text  { animation: heroTextIn .8s cubic-bezier(.22,.68,0,1.1) .15s both; }
        .hero-badge { animation: heroBadgeIn .6s cubic-bezier(.22,.68,0,1.2) both; }
        .hero-sub   { animation: heroTextIn .7s cubic-bezier(.22,.68,0,1.1) .35s both; }
        .hero-btns  { animation: heroTextIn .6s cubic-bezier(.22,.68,0,1.1) .5s both; }
        .hero-stats { animation: heroTextIn .6s cubic-bezier(.22,.68,0,1.1) .65s both; }
        .modal-enter{ animation: popIn .28s cubic-bezier(.22,.68,0,1.3) both; }
        .live-dot   { animation: liveBlip 1.4s ease infinite; }
        .row-in     { animation: rowIn .3s ease both; }
        .login-card { animation: fadeUp .55s cubic-bezier(.22,.68,0,1.2) both; }
        .login-bg   { animation: fadeIn .4s ease both; }
        .role-btn   { transition: all .18s cubic-bezier(.22,.68,0,1.2); }
        .role-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,180,166,.18); }
        .sign-btn   { transition: all .18s ease; }
        .sign-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(26,43,75,.3); }
        .sign-btn:active { transform: translateY(0); }
        .cta-btn    { transition: all .2s cubic-bezier(.22,.68,0,1.2); }
        .cta-btn:hover { transform: translateY(-2px) scale(1.03); box-shadow: 0 10px 28px rgba(0,180,166,.35); }
        .tab-btn    { transition: all .18s ease; }
        .tab-btn:hover { color: ${C.teal} !important; }
        tr.animated-row { animation: rowIn .25s ease both; }
      `}</style>
      <div key={page} className="page-enter">
        {renderPage()}
      </div>
    </div>
  );
}
