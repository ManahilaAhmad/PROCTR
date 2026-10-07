import { useEffect, useState } from "react";
import { C } from "./theme/colors";
import { Icon } from "./theme/icons";
import Sidebar from "./components/common/Sidebar";
import LoginPage from "./pages/LoginPage";
import AboutPage from "./pages/AboutPage";
import TeacherPage from "./pages/TeacherPage";
import StudentPage from "./pages/StudentPage";
import HODPage from "./pages/HODPage";
import DirectorPage from "./pages/DirectorPage";
import CoordinatorPage from "./pages/CoordinatorPage";
import InvigilatorPage from "./pages/InvigilatorPage";
import DECPage from "./pages/DECPage";
import LiveDashboardPage from "./pages/LiveDashboardPage";
import PostExamReportPage from "./pages/PostExamReportPage";
import AdminPage from "./pages/AdminPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import SubmissionsPage from "./pages/SubmissionsPage";

import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { API_BASE_URL } from "./config/apiConfig";

const dashboardPages = ["teacher", "student", "hod", "director", "coordinator", "invigilator", "dec"];

export default function App() {
  const resetToken = new URLSearchParams(window.location.search).get("reset_token");
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("proctr_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [role, setRole] = useState(() => {
    return localStorage.getItem("proctr_role") || null;
  });

  const [page, setPage] = useState(() => {
    if (resetToken) return "reset-password";
    const savedUser = localStorage.getItem("proctr_user");
    const savedPage = localStorage.getItem("proctr_page");
    if (savedUser && savedPage) {
      if (["admin", "admin-security", "admin-users"].includes(savedPage)) return "admin-students";
      if (savedPage === "director" || savedPage === "dir-results") return "dir-timetable";
      return savedPage;
    }
    return "login";
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch(`${API_BASE_URL}/auth/session`, { credentials: "include" })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || Number(data.session?.userId) !== Number(user.userId) || data.session?.userType !== user.userType) {
          throw new Error("Session is no longer valid.");
        }
      })
      .catch(() => {
        if (cancelled) return;
        localStorage.removeItem("proctr_user");
        localStorage.removeItem("proctr_role");
        localStorage.removeItem("proctr_page");
        setUser(null);
        setRole(null);
        setPage("login");
      });
    return () => { cancelled = true; };
  }, [user]);

  const navigateTo = (p) => {
    const targetPage = p === "home" ? "login" : p === "director" || p === "dir-results" ? "dir-timetable" : p;
    setPage(targetPage);
    setSidebarOpen(false);
    if (targetPage === "login" || targetPage === "forgot-password" || targetPage === "reset-password") {
      localStorage.removeItem("proctr_page");
    } else {
      localStorage.setItem("proctr_page", targetPage);
    }
  };

  const handleLogout = () => {
    fetch(`${API_BASE_URL}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
    localStorage.removeItem("proctr_user");
    localStorage.removeItem("proctr_role");
    localStorage.removeItem("proctr_page");
    setUser(null);
    setRole(null);
    navigateTo("login");
  };

  function renderDashboardContent() {
    switch (page) {
      case "submissions":
        return ["student", "teacher"].includes(user?.userType) ? <SubmissionsPage user={user} /> : <p>Access denied.</p>;
      case "admin-labs":
      case "admin-students":
      case "admin-teachers":
      case "admin-hod":
      case "admin-coordinator":
      case "admin-director":
      case "admin-dec":
      case "admin-admins":
        return <AdminPage activePage={page} setPage={navigateTo} user={user} />;
      case "teacher":
        return <TeacherPage activePage="teacher" setPage={navigateTo} user={user} />;
      case "upload":
        return <TeacherPage activePage="upload" setPage={navigateTo} user={user} />;
      case "inv-schedule":
        return <TeacherPage activePage="inv-schedule" setPage={navigateTo} user={user} />;
      case "teacher-swaps":
        return <TeacherPage activePage="teacher-swaps" setPage={navigateTo} user={user} />;
      case "student":
        return <StudentPage activePage="student" setPage={navigateTo} user={user} />;
      case "results":
        return <StudentPage activePage="results" setPage={navigateTo} user={user} />;
      case "hod":
        return <HODPage activePage="hod" setPage={navigateTo} user={user} />;
      case "reports":
        return <HODPage activePage="reports" setPage={navigateTo} user={user} />;
      case "director":
        return <DirectorPage activePage="dir-timetable" setPage={navigateTo} user={user} />;
      case "dir-papers":
        return <DirectorPage activePage="dir-papers" setPage={navigateTo} user={user} />;
      case "dir-timetable":
        return <DirectorPage activePage="dir-timetable" setPage={navigateTo} user={user} />;
      case "dir-labs":
        return <DirectorPage activePage="dir-labs" setPage={navigateTo} user={user} />;
      case "dir-results":
        return <DirectorPage activePage="dir-timetable" setPage={navigateTo} user={user} />;
      case "coordinator":
        return <CoordinatorPage activePage="coordinator" user={user} />;
      case "coordinator-broadcast":
        return <CoordinatorPage activePage="coordinator-broadcast" user={user} />;
      case "rooms":
        return <CoordinatorPage user={user} />;
      case "dec":
        return <DECPage activePage="dec" setPage={navigateTo} user={user} />;
      case "dec-exams":
        return <DECPage activePage="dec-exams" setPage={navigateTo} user={user} />;
      case "dec-invigilators":
        return <DECPage activePage="dec-invigilators" setPage={navigateTo} user={user} />;
      case "dec-swaps":
        return <DECPage activePage="dec-swaps" setPage={navigateTo} user={user} />;
      case "invigilator":
        return <InvigilatorPage activePage="schedule" setPage={navigateTo} user={user} />;
      case "inv-exams":
        return <InvigilatorPage activePage="start" setPage={navigateTo} user={user} />;
      case "inv-monitor":
        return <InvigilatorPage activePage="monitor" setPage={navigateTo} user={user} />;
      case "live-monitor":
        return <LiveDashboardPage setPage={navigateTo} user={user} />;
      case "exam-reports":
        return <PostExamReportPage setPage={navigateTo} user={user} />;
      default:
        return <DECPage activePage="dec" setPage={navigateTo} user={user} />;
    }
  }

  function renderPage() {
    if (page === "home") return <LoginPage setPage={navigateTo} setRole={setRole} setUser={setUser} />;
    if (page === "about") return <AboutPage setPage={navigateTo} />;
    if (page === "login") return <LoginPage setPage={navigateTo} setRole={setRole} setUser={setUser} />;
    if (page === "forgot-password") return <ForgotPasswordPage setPage={navigateTo} />;
    if (page === "reset-password") return <ResetPasswordPage token={resetToken} setPage={navigateTo} />;

    const isDashboard = dashboardPages.includes(page) ||
      ["submissions", "admin-labs", "admin-students", "admin-teachers", "admin-hod", "admin-coordinator", "admin-director", "admin-dec", "admin-admins", "upload", "inv-schedule", "teacher-swaps", "coordinator-broadcast", "live-monitor", "exam-reports", "results", "reports", "dir-papers", "dir-timetable", "dir-labs", "dir-results", "rooms", "dec-exams", "dec-invigilators", "dec-swaps", "inv-exams", "inv-monitor"].includes(page);

    if (isDashboard) {
      return (
        <div className={`resp-layout-container${role === "teacher" || role === "hod" || role === "coordinator" || role === "dec" ? " teacher-workspace" : ""}`}>
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
              <div style={{ width: 28, height: 28, borderRadius: 6, background: role === "teacher" || role === "hod" || role === "coordinator" || role === "dec" ? "#1a2b4b" : C.teal, display: "flex", alignItems: "center", justifyContent: "center", color: C.white }}>
                {Icon.shield}
              </div>
              <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: -0.3 }}>PROCTR</span>
              <span style={{ background: role === "teacher" || role === "hod" || role === "coordinator" || role === "dec" ? "rgba(85,121,135,.15)" : "rgba(0,180,166,.15)", color: role === "teacher" || role === "hod" || role === "coordinator" || role === "dec" ? "#557987" : C.teal, fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 10, textTransform: "uppercase" }}>{role}</span>
            </div>
            <button
              onClick={handleLogout}
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
            role={role || (page.startsWith("admin") ? "admin" : role)}
            activePage={page}
            setPage={navigateTo}
            onLogout={handleLogout}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
          />
          <ErrorBoundary>
            {renderDashboardContent()}
          </ErrorBoundary>
        </div>
      );
    }
    return <LoginPage setPage={navigateTo} setRole={setRole} setUser={setUser} />;
  }

  return (
    <div style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", minHeight: "100vh" }}>
      <style>{`
        .teacher-workspace {
          position: relative;
          isolation: isolate;
          z-index: 0;
          background: transparent !important;
        }
        .teacher-workspace::before {
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
        .teacher-workspace .resp-page-padding {
          width: 100%;
          max-width: 1440px;
          margin: 0 auto;
          padding: 36px 40px 48px;
          box-sizing: border-box;
        }
        .teacher-workspace .proctr-page-wrap {
          background: transparent !important;
        }
        .teacher-workspace h1 {
          font-family: 'Inter', 'Segoe UI', system-ui, sans-serif !important;
          color: #557987 !important;
          font-size: 30px !important;
          font-weight: 800 !important;
          letter-spacing: -.5px !important;
        }
        .teacher-workspace h2,
        .teacher-workspace h3,
        .teacher-workspace h4 {
          font-family: 'Inter', 'Segoe UI', system-ui, sans-serif !important;
          color: #557987 !important;
          line-height: 1.25;
          font-weight: 800;
          letter-spacing: -.3px;
        }
        .teacher-workspace p,
        .teacher-workspace label,
        .teacher-workspace input,
        .teacher-workspace select,
        .teacher-workspace textarea,
        .teacher-workspace button {
          font-family: 'Inter', 'Segoe UI', system-ui, sans-serif !important;
        }
        .teacher-workspace .proctr-card {
          background: linear-gradient(145deg, rgba(255,255,255,.78), rgba(255,255,255,.56)) !important;
          border: 1px solid rgba(255,255,255,.86) !important;
          box-shadow: 0 22px 55px rgba(41,91,117,.16), inset 0 1px 0 rgba(255,255,255,.96) !important;
          backdrop-filter: blur(20px) saturate(135%);
          -webkit-backdrop-filter: blur(20px) saturate(135%);
        }
        .teacher-workspace .proctr-card input,
        .teacher-workspace .proctr-card select,
        .teacher-workspace .proctr-card textarea {
          background: rgba(255,255,255,.5) !important;
          border-color: rgba(255,255,255,.9) !important;
          border-radius: 11px !important;
          box-shadow: inset 0 1px 2px rgba(48,91,112,.06), 0 7px 22px rgba(47,110,139,.14);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          outline: none;
        }
        .teacher-workspace .proctr-card input:focus,
        .teacher-workspace .proctr-card select:focus,
        .teacher-workspace .proctr-card textarea:focus {
          border-color: rgba(85,121,135,.62) !important;
          box-shadow: 0 0 0 3px rgba(85,121,135,.12), 0 7px 22px rgba(47,110,139,.18);
        }
        .teacher-workspace .proctr-btn-primary {
          background: linear-gradient(135deg, #557987 0%, #7899a6 100%) !important;
          box-shadow: 0 10px 24px rgba(47,110,139,.18);
        }
        .teacher-workspace .proctr-btn-navy {
          background: linear-gradient(135deg, #557987 0%, #7899a6 100%) !important;
          box-shadow: 0 10px 24px rgba(47,110,139,.18);
        }
        .teacher-workspace .proctr-card button {
          border-radius: 11px !important;
          font-size: 13px;
          font-weight: 700;
          transition: transform .18s ease, box-shadow .18s ease;
        }
        .teacher-workspace .proctr-badge-default {
          background: #e5f0f4 !important;
          color: #557987 !important;
        }
        .teacher-workspace .proctr-tab.active {
          color: #557987 !important;
          border-bottom-color: #557987 !important;
        }
        .teacher-workspace table thead th {
          color: #557987 !important;
          border-bottom-color: rgba(255,255,255,.9) !important;
        }
        .teacher-workspace table thead tr {
          background: rgba(255,255,255,.42) !important;
        }
        .teacher-workspace table tbody tr:hover {
          background: rgba(255,255,255,.34);
        }
        .teacher-workspace table td {
          border-bottom-color: rgba(255,255,255,.65) !important;
        }
        @media (max-width: 768px) {
          .teacher-workspace h1 { font-size: 27px !important; }
          .teacher-workspace .resp-page-padding { padding: 20px 16px 32px; }
          .teacher-workspace .resp-mobile-header {
            background: #c3d8e4;
            color: #1a2b4b;
            border-bottom-color: rgba(255,255,255,.82);
          }
          .teacher-workspace .resp-mobile-header button { color: #557987 !important; }
        }
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
        @keyframes slideDown { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:translateY(0)} }
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
      <div>
        {renderPage()}
      </div>
    </div>
  );
}
