import { C } from "../../theme/colors";
import { Icon } from "../../theme/icons";

const navItems = {
  teacher: [
    { id: "teacher", icon: Icon.clipboardList, label: "My Exams" },
    { id: "upload", icon: Icon.upload, label: "Upload Exam" },
    { id: "monitor", icon: Icon.monitor, label: "Live Monitor" },
  ],
  student: [
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
  invigilator: [
    { id: "invigilator", icon: Icon.clipboard, label: "My Schedule" },
    { id: "inv-exams", icon: Icon.play, label: "Start Exam" },
    { id: "inv-monitor", icon: Icon.monitor, label: "Live Monitor" },
  ],
  dec: [
    { id: "dec", icon: Icon.chart, label: "Overview" },
    { id: "dec-exams", icon: Icon.calendar, label: "Scheduled Exams" },
    { id: "dec-invigilators", icon: Icon.userCheck, label: "Invigilators" },
    { id: "dec-swaps", icon: Icon.bell, label: "Swap Requests" },
  ],
};

export default function Sidebar({ role, activePage, setPage, setRole, sidebarOpen, setSidebarOpen }) {
  const items = navItems[role] || [];
  return (
    <aside className={`resp-sidebar ${sidebarOpen ? "open" : ""}`} style={{ background: C.navy, minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 22px 18px", borderBottom: "1px solid rgba(255,255,255,.08)", animation: "fadeIn .4s ease both" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: C.teal, display: "flex", alignItems: "center", justifyContent: "center", color: C.white }}>
              {Icon.shield}
            </div>
            <div>
              <div style={{ color: C.white, fontWeight: 800, fontSize: 16, letterSpacing: -0.3 }}>PROCTR</div>
              <div style={{ color: C.teal, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{role}</div>
            </div>
          </div>
          <button 
            className="show-mobile" 
            onClick={() => setSidebarOpen(false)} 
            style={{ background: "none", border: "none", color: "rgba(255,255,255,.45)", cursor: "pointer", display: "flex", padding: "6px" }}
            aria-label="Close menu"
          >
            {Icon.x}
          </button>
        </div>
      </div>
      <nav style={{ flex: 1, padding: "14px 10px", overflowY: "auto" }}>
        {items.map((item, i) => (
          <button key={item.id} onClick={() => setPage(item.id)} className="nav-btn"
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "10px 13px", borderRadius: 8, border: "none", cursor: "pointer", marginBottom: 2, fontWeight: 600, fontSize: 13.5, background: activePage === item.id ? C.teal : "transparent", color: activePage === item.id ? C.white : "rgba(255,255,255,.55)", textAlign: "left", animation: `slideInLeft .35s cubic-bezier(.22,.68,0,1.2) ${i * 60 + 80}ms both` }}>
            <span style={{ display: "flex", flexShrink: 0, opacity: activePage === item.id ? 1 : 0.7, transition: "transform .2s ease", transform: activePage === item.id ? "scale(1.15)" : "scale(1)" }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div style={{ padding: "14px 10px", borderTop: "1px solid rgba(255,255,255,.08)" }}>
        <button onClick={() => { setRole(null); setPage("login"); }}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", borderRadius: 8, border: "none", cursor: "pointer", background: "transparent", color: "rgba(255,255,255,.4)", fontSize: 13, fontWeight: 600 }}>
          <span style={{ display: "flex" }}>{Icon.logout}</span> Log out
        </button>
      </div>
    </aside>
  );
}
