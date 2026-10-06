import { C } from "../../theme/colors";
import { Icon } from "../../theme/icons";

const navItems = {
  admin: [
    { id: "admin-labs", icon: Icon.server, label: "Labs & Networks" },
    { id: "admin-students", icon: Icon.users, label: "Students" },
    { id: "admin-teachers", icon: Icon.userCheck, label: "Teachers" },
    { id: "admin-hod", icon: Icon.check, label: "Heads of Department" },
    { id: "admin-coordinator", icon: Icon.calendar, label: "Coordinators" },
    { id: "admin-director", icon: Icon.chart, label: "Directors" },
    { id: "admin-dec", icon: Icon.shield, label: "DEC Members" },
    { id: "admin-admins", icon: Icon.server, label: "Administrators" },
  ],
  teacher: [
    { id: "submissions", icon: Icon.fileText, label: "Submitted Work" },
    { id: "teacher", icon: Icon.clipboardList, label: "My Exams" },
    { id: "upload", icon: Icon.upload, label: "Upload Exam" },
    { id: "live-monitor", icon: Icon.bell, label: "Live Monitor" },
    { id: "exam-reports", icon: Icon.fileText, label: "Post-Exam Reports" },
    { id: "__divider__", icon: null, label: "Invigilation Duty", isDivider: true },
    { id: "inv-schedule", icon: Icon.clipboard, label: "My Schedule" },
  ],
  student: [
    { id: "submissions", icon: Icon.fileText, label: "Submitted Work" },
    { id: "student", icon: Icon.home, label: "Dashboard" },
    { id: "results", icon: Icon.chart, label: "My Results" },
  ],
  hod: [
    { id: "hod", icon: Icon.check, label: "Review Queue" },
    { id: "reports", icon: Icon.fileText, label: "Reports" },
  ],
  director: [
    { id: "director", icon: Icon.chart, label: "Overview" },
    { id: "dir-timetable", icon: Icon.calendar, label: "Timetable" },
    { id: "dir-labs", icon: Icon.server, label: "Labs" },
    { id: "dir-results", icon: Icon.fileText, label: "Section Results" },
  ],
  coordinator: [
    { id: "coordinator", icon: Icon.calendar, label: "Date Sheets" },
    { id: "rooms", icon: Icon.building, label: "Lab Rooms" },
  ],
  dec: [
    { id: "dec", icon: Icon.chart, label: "Overview" },
    { id: "dec-exams", icon: Icon.calendar, label: "Scheduled Exams" },
    { id: "dec-invigilators", icon: Icon.userCheck, label: "Invigilators" },
    { id: "dec-swaps", icon: Icon.bell, label: "Swap Requests" },
  ],
};

export default function Sidebar({ role, activePage, setPage, onLogout, sidebarOpen, setSidebarOpen }) {
  const items = navItems[role] || [];
  const isAdmin = role === "admin";
  return (
    <aside className={`resp-sidebar ${sidebarOpen ? "open" : ""}`} style={{ background: isAdmin ? "#c3d8e4" : C.navy, borderRight: isAdmin ? "1px solid rgba(255,255,255,.82)" : "none", boxShadow: isAdmin ? "10px 0 35px rgba(41,91,117,.22), inset -1px 0 0 rgba(255,255,255,.55)" : "none", backdropFilter: isAdmin ? "blur(24px) saturate(145%)" : "none", minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 22px 18px", borderBottom: isAdmin ? "1px solid rgba(255,255,255,.8)" : "1px solid rgba(255,255,255,.08)", animation: "fadeIn .4s ease both" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 11, background: isAdmin ? C.navy : C.teal, boxShadow: isAdmin ? "0 0 0 5px rgba(0,180,166,.22), 0 10px 24px rgba(47,110,139,.25)" : "none", display: "flex", alignItems: "center", justifyContent: "center", color: C.white }}>
              {Icon.shield}
            </div>
            <div>
              <div style={{ color: isAdmin ? C.navy : C.white, fontWeight: 800, fontSize: 16, letterSpacing: -0.3 }}>PROCTR</div>
              <div style={{ color: isAdmin ? "#557987" : C.teal, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{role}</div>
            </div>
          </div>
          <button
            className="show-mobile"
            onClick={() => setSidebarOpen(false)}
              style={{ background: "none", border: "none", color: isAdmin ? "#557987" : "rgba(255,255,255,.45)", cursor: "pointer", display: "flex", padding: "6px" }}
            aria-label="Close menu"
          >
            {Icon.x}
          </button>
        </div>
      </div>
      <nav style={{ flex: 1, padding: "14px 10px", overflow: "hidden" }}>
        {items.map((item, i) => {
          if (item.isDivider) {
            return (
              <div key={item.id} style={{ padding: "14px 13px 5px", fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: isAdmin ? "rgba(85,121,135,.58)" : "rgba(255,255,255,.28)", marginTop: 6, borderTop: isAdmin ? "1px solid rgba(255,255,255,.75)" : "1px solid rgba(255,255,255,.07)" }}>
                {item.label}
              </div>
            );
          }
          return (
            <button key={item.id} onClick={() => setPage(item.id)} className="nav-btn"
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "10px 13px", borderRadius: 10, border: isAdmin && activePage === item.id ? "1px solid rgba(255,255,255,.54)" : "1px solid transparent", cursor: "pointer", marginBottom: 4, fontWeight: 600, fontSize: 13.5, background: activePage === item.id ? (isAdmin ? "linear-gradient(140deg, rgba(64,111,133,.94), rgba(78,149,170,.84))" : C.teal) : (isAdmin ? "rgba(255,255,255,.18)" : "transparent"), color: activePage === item.id ? C.white : (isAdmin ? "#557987" : "rgba(255,255,255,.55)"), boxShadow: isAdmin && activePage === item.id ? "0 0 36px rgba(58,177,215,.36), 0 10px 26px rgba(47,110,139,.2), inset 0 1px 0 rgba(255,255,255,.24)" : (isAdmin ? "0 7px 22px rgba(63,145,177,.08)" : "none"), textAlign: "left", animation: `slideInLeft .35s cubic-bezier(.22,.68,0,1.2) ${i * 60 + 80}ms both` }}>
              <span style={{ display: "flex", flexShrink: 0, opacity: activePage === item.id ? 1 : 0.7, color: isAdmin ? "inherit" : undefined, transition: "transform .2s ease", transform: activePage === item.id ? "scale(1.15)" : "scale(1)" }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>
      <div style={{ marginTop: "auto", padding: "14px 10px 18px", borderTop: isAdmin ? "1px solid rgba(255,255,255,.8)" : "1px solid rgba(255,255,255,.08)" }}>
        <button onClick={onLogout || (() => setPage("login"))}
          className="sidebar-logout-btn"
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", borderRadius: 11, border: isAdmin ? "1px solid rgba(255,255,255,.82)" : "1px solid rgba(255,255,255,.1)", cursor: "pointer", background: isAdmin ? "rgba(255,255,255,.28)" : "rgba(255,255,255,.06)", color: isAdmin ? "#557987" : "rgba(255,255,255,.72)", fontSize: 13, fontWeight: 700, textAlign: "left", boxShadow: isAdmin ? "0 7px 22px rgba(63,145,177,.1), inset 0 1px 0 rgba(255,255,255,.65)" : "none" }}>
          <span style={{ display: "flex" }}>{Icon.logout}</span> Log out
        </button>
      </div>
    </aside>
  );
}
