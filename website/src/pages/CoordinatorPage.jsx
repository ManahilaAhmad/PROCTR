import { useState } from "react";
import { C } from "../theme/colors";
import { Icon } from "../theme/icons";
import PageWrap from "../components/common/PageWrap";
import Tabs from "../components/common/Tabs";
import Card from "../components/common/Card";
import Btn from "../components/common/Btn";
import Input from "../components/common/Input";
import Select from "../components/common/Select";
import Table from "../components/common/Table";
import StatCard from "../components/common/StatCard";
import Badge from "../components/common/Badge";
import statusBadge from "../components/common/statusBadge";
import { timetableData, labsData } from "../data/mockData";

export default function CoordinatorPage({ activePage }) {
  const [activeTab, setActiveTab] = useState(activePage === "rooms" ? "rooms" : "schedule");
  const [notifSubject, setNotifSubject] = useState("");
  const [notifMsg, setNotifMsg] = useState("");
  const [notifAudience, setNotifAudience] = useState("All Students");
  const [notifSent, setNotifSent] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [schedExam, setSchedExam] = useState("");
  const [schedDate, setSchedDate] = useState("");
  const [schedLab, setSchedLab] = useState("");

  function sendNotif() {
    if (!notifSubject.trim() || !notifMsg.trim()) return;
    setNotifSent(true);
    setNotifSubject(""); setNotifMsg("");
    setTimeout(() => setNotifSent(false), 3000);
  }

  function exportDateSheet() {
    alert("Date sheet exported as PDF.");
  }

  return (
    <PageWrap title={activeTab === "rooms" ? "Lab Rooms" : "Scheduling & Date Sheets"} subtitle={activeTab === "rooms" ? "Current lab availability and network details" : "Manage exam timetables, lab assignments, and invigilators"}
      actions={activeTab === "schedule" ? <><Btn variant="ghost" size="sm" onClick={exportDateSheet}>Export Date Sheet</Btn><Btn variant="primary" onClick={() => setShowSchedule(true)}>+ Schedule Exam</Btn></> : undefined}>
      {showSchedule && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(17,29,51,.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowSchedule(false)}>
          <div style={{ background: C.white, borderRadius: 16, padding: 40, width: 440, boxShadow: "0 24px 64px rgba(0,0,0,.18)", animation: "popIn .28s cubic-bezier(.22,.68,0,1.3) both" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 24px", fontSize: 18, fontWeight: 800, color: C.navy }}>Schedule Exam</h2>
            <Input label="Exam / Course" placeholder="e.g. CS-501 AI Practical" value={schedExam} onChange={(e) => setSchedExam(e.target.value)} />
            <Input label="Date" type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} />
            <Select label="Lab" value={schedLab} onChange={(e) => setSchedLab(e.target.value)}>
              <option value="">Select a lab…</option>
              {labsData.filter(l => l.status === "Available").map(l => <option key={l.name}>{l.name}</option>)}
            </Select>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <Btn variant="ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setShowSchedule(false)}>Cancel</Btn>
              <Btn variant="navy" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setShowSchedule(false); }}>Confirm Schedule</Btn>
            </div>
          </div>
        </div>
      )}

      <Tabs tabs={[{ id: "schedule", label: "Date Sheets" }, { id: "rooms", label: "Lab Rooms" }]} active={activeTab} onChange={setActiveTab} />

      {/* ── DATE SHEETS ── */}
      {activeTab === "schedule" && <>
        <div className="resp-grid-4" style={{ marginBottom: 28 }}>
          <StatCard label="Scheduled Exams" value={4} icon={Icon.calendar} />
          <StatCard label="Labs Available" value={3} icon={Icon.server} />
          <StatCard label="Pending Assignment" value={2} icon={Icon.bell} />
          <StatCard label="Total Students" value={114} icon={Icon.users} />
        </div>
        <Card style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.grey100}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>Exam Schedule</span>
            <Badge>July 2026</Badge>
          </div>
          <Table
            columns={["Exam", "Course", "Date", "Time", "Lab", "Invigilator", "Students", "Status"]}
            rows={timetableData.map((s) => [
              <span style={{ fontWeight: 700, color: C.navy }}>{s.exam}</span>,
              <Badge>{s.course}</Badge>,
              s.date, s.time,
              s.lab === "TBD" ? <span style={{ color: C.navy, fontWeight: 700 }}>TBD</span> : s.lab,
              s.invigilator === "Unassigned" ? <span style={{ color: C.grey500, fontWeight: 600 }}>Unassigned</span> : s.invigilator,
              s.students,
              statusBadge(s.status),
            ])} />
        </Card>
        <Card>
          <h3 style={{ margin: "0 0 18px", fontWeight: 800, color: C.navy, fontSize: 15 }}>Broadcast Notification</h3>
          {notifSent && (
            <div style={{ marginBottom: 14, padding: "10px 14px", background: C.tealLight, borderRadius: 8, fontSize: 13, color: C.navy, fontWeight: 700 }}>
              Notification sent to {notifAudience}.
            </div>
          )}
          <div className="resp-grid-2" style={{ gap: 16 }}>
            <Select label="Audience" value={notifAudience} onChange={(e) => setNotifAudience(e.target.value)}>
              <option>All Students</option>
              <option>CS Department Only</option>
              <option>Invigilators Only</option>
            </Select>
            <Input label="Subject" placeholder="e.g. July Exam Schedule Published" value={notifSubject} onChange={(e) => setNotifSubject(e.target.value)} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.grey800, marginBottom: 6 }}>Message</label>
            <textarea value={notifMsg} onChange={(e) => setNotifMsg(e.target.value)} placeholder="Write your notification here..." style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: `1.5px solid ${C.grey200}`, fontSize: 14, color: C.grey800, background: C.grey50, minHeight: 80, resize: "vertical", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }} />
          </div>
          <Btn variant="primary" onClick={sendNotif}>Send Notification</Btn>
        </Card>
      </>}

      {/* ── LAB ROOMS ── */}
      {activeTab === "rooms" && <>
        <div className="resp-grid-3" style={{ marginBottom: 28 }}>
          <StatCard label="Total Labs" value={labsData.length} icon={Icon.server} />
          <StatCard label="Available Now" value={labsData.filter(l => l.status === "Available").length} icon={Icon.check} accent={C.green} light={C.greenLight} />
          <StatCard label="Total PC Capacity" value={labsData.reduce((s, l) => s + l.capacity, 0)} icon={Icon.monitor} />
        </div>
        <Card style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.grey100}`, fontWeight: 700, fontSize: 15, color: C.navy }}>Lab Status</div>
          <Table
            columns={["Lab", "PCs", "Capacity", "Network Range", "Current Exam", "Status"]}
            rows={labsData.map((lab) => {
              const sc = lab.status === "Available" ? [C.teal, C.tealLight] : lab.status === "In Use" ? [C.navy, C.grey200] : [C.amber, C.amberLight];
              return [
                <span style={{ fontWeight: 800, color: C.navy }}>{lab.name}</span>,
                lab.pcs, lab.capacity,
                <span style={{ fontFamily: "monospace", fontSize: 13 }}>{lab.network}</span>,
                lab.exam === "—" ? <span style={{ color: C.grey400 }}>—</span> : <Badge>{lab.exam}</Badge>,
                <Badge color={sc[0]} bg={sc[1]}>{lab.status}</Badge>,
              ];
            })} />
        </Card>
        <div className="resp-grid-2">
          <Card>
            <h3 style={{ margin: "0 0 16px", fontWeight: 800, color: C.navy, fontSize: 15 }}>Capacity Utilization</h3>
            {labsData.map((lab) => {
              const pct = Math.round((lab.capacity / lab.pcs) * 100);
              return (
                <div key={lab.name} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: C.grey800, marginBottom: 5 }}>
                    <span>{lab.name}</span><span style={{ color: C.grey500 }}>{lab.capacity}/{lab.pcs} PCs usable</span>
                  </div>
                  <div style={{ height: 7, background: C.grey100, borderRadius: 99 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: lab.status === "Maintenance" ? C.amber : C.teal, borderRadius: 99 }} />
                  </div>
                </div>
              );
            })}
          </Card>
          <Card>
            <h3 style={{ margin: "0 0 16px", fontWeight: 800, color: C.navy, fontSize: 15 }}>Network IP Ranges</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {labsData.map((lab) => (
                <div key={lab.name} style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", background: C.grey50, borderRadius: 8, border: `1px solid ${C.grey200}` }}>
                  <span style={{ fontWeight: 700, color: C.navy, fontSize: 14 }}>{lab.name}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 13, color: C.grey500 }}>{lab.network}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </>}

      <div style={{ height: 48 }} />
    </PageWrap>
  );
}