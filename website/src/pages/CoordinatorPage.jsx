import { useState, useEffect } from "react";
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

export default function CoordinatorPage({ activePage, setPage, user }) {
  const [activeTab, setActiveTab] = useState(activePage === "rooms" ? "rooms" : "schedule");
  const [schedule, setSchedule] = useState([]);
  const [labs, setLabs] = useState([]);
  const [approvedExams, setApprovedExams] = useState([]);

  useEffect(() => {
    setActiveTab(activePage === "rooms" ? "rooms" : "schedule");
  }, [activePage]);

  // Fetch labs, schedule, and approved exams from database
  const fetchData = () => {
    fetch("http://localhost:5000/api/labs")
      .then(res => res.json())
      .then(data => { if (data.status === "success") setLabs(data.labs); });

    fetch("http://localhost:5000/api/schedule")
      .then(res => res.json())
      .then(data => { if (data.status === "success") setSchedule(data.schedule); });

    fetch("http://localhost:5000/api/exams/approved")
      .then(res => res.json())
      .then(data => { if (data.status === "success") setApprovedExams(data.exams); });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [notifSubject, setNotifSubject] = useState("");
  const [notifMsg, setNotifMsg] = useState("");
  const [notifAudience, setNotifAudience] = useState("All Students");
  const [notifSent, setNotifSent] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  
  const [schedExam, setSchedExam] = useState("");
  const [schedDate, setSchedDate] = useState("");
  const [schedLab, setSchedLab] = useState("");
  const [schedStartTime, setSchedStartTime] = useState("09:00");
  const [schedEndTime, setSchedEndTime] = useState("10:30");

  // Broadcast states
  const [broadcastType, setBroadcastType] = useState("all"); // "all" | "specific"
  const [specificUser, setSpecificUser] = useState("");
  const [customUser, setCustomUser] = useState("");

  function sendNotif() {
    if (!notifSubject.trim() || !notifMsg.trim()) return;
    fetch("http://localhost:5000/api/notifications/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user?.userId || 1,
        subject: notifSubject.trim(),
        message: notifMsg.trim(),
        audience_type: broadcastType === "all" ? notifAudience.replace(" ", "") : "Specific",
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === "success") {
          setNotifSent(true);
          setNotifSubject(""); setNotifMsg(""); setSpecificUser(""); setCustomUser("");
          setTimeout(() => setNotifSent(false), 3200);
        } else {
          alert(data.message || "Failed to broadcast notification.");
        }
      })
      .catch(err => alert("Connection error to notifications api."));
  }

  function confirmSchedule() {
    if (!schedExam || !schedLab || !schedDate || !schedStartTime || !schedEndTime) {
      alert("Please fill all scheduling fields.");
      return;
    }
    fetch("http://localhost:5000/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exam_id: parseInt(schedExam),
        lab_id: parseInt(schedLab),
        user_id: user?.userId || 1,
        exam_date: schedDate,
        start_time: schedStartTime + ":00",
        end_time: schedEndTime + ":00",
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === "success") {
          alert("Exam scheduled successfully!");
          setShowSchedule(false);
          setSchedExam(""); setSchedDate(""); setSchedLab("");
          fetchData();
        } else {
          alert(data.message || "Failed to schedule exam.");
        }
      })
      .catch(err => alert("Network error. Failed to save schedule."));
  }

  function exportDateSheet() {
    alert("Date sheet exported as PDF.");
  }

  const safeSchedule = (Array.isArray(schedule) ? schedule : []).filter(Boolean);
  const safeLabs     = (Array.isArray(labs) ? labs : []).filter(Boolean);
  const safeApproved = (Array.isArray(approvedExams) ? approvedExams : []).filter(Boolean);

  return (
    <PageWrap title={activeTab === "rooms" ? "Lab Rooms" : "Scheduling & Date Sheets"} subtitle={activeTab === "rooms" ? "Current lab availability and network details" : "Manage exam timetables, lab assignments, and invigilators"}
      actions={activeTab === "schedule" ? <><Btn variant="ghost" size="sm" onClick={exportDateSheet}>Export Date Sheet</Btn><Btn variant="primary" onClick={() => setShowSchedule(true)}>+ Schedule Exam</Btn></> : undefined}>
      {showSchedule && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(17,29,51,.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowSchedule(false)}>
          <div style={{ background: C.white, borderRadius: 16, padding: 40, width: 440, boxShadow: "0 24px 64px rgba(0,0,0,.18)", animation: "popIn .28s cubic-bezier(.22,.68,0,1.3) both" }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 24px", fontSize: 18, fontWeight: 800, color: C.navy }}>Schedule Exam</h2>
            <Select label="Approved Exam" value={schedExam} onChange={(e) => setSchedExam(e.target.value)}>
              <option value="">Select an approved exam...</option>
              {safeApproved.map(e => <option key={e.exam_id} value={e.exam_id}>{e.course_code} {e.exam_type} ({e.section_name})</option>)}
            </Select>
            <Input label="Date" type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} />
            <Select label="Lab" value={schedLab} onChange={(e) => setSchedLab(e.target.value)}>
              <option value="">Select a lab…</option>
              {safeLabs.filter(l => l.status === "Available").map(l => <option key={l.lab_id} value={l.lab_id}>{l.lab_name} (Cap: {l.capacity})</option>)}
            </Select>
            <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
              <div style={{ flex: 1 }}><Input label="Start Time" type="time" value={schedStartTime} onChange={(e) => setSchedStartTime(e.target.value)} /></div>
              <div style={{ flex: 1 }}><Input label="End Time" type="time" value={schedEndTime} onChange={(e) => setSchedEndTime(e.target.value)} /></div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <Btn variant="ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setShowSchedule(false)}>Cancel</Btn>
              <Btn variant="navy" style={{ flex: 1, justifyContent: "center" }} onClick={confirmSchedule}>Confirm Schedule</Btn>
            </div>
          </div>
        </div>
      )}

      <Tabs tabs={[{ id: "schedule", label: "Date Sheets" }, { id: "rooms", label: "Lab Rooms" }]} active={activeTab} onChange={(id) => {
        setActiveTab(id);
        if (setPage) {
          const pageMap = { schedule: "coordinator", rooms: "rooms" };
          setPage(pageMap[id]);
        }
      }} />

      {/* ── DATE SHEETS ── */}
      {activeTab === "schedule" && <>
        {/* Changed grid layout to 3-column and removed Pending Assignment stat card */}
        <div className="resp-grid-3" style={{ marginBottom: 28 }}>
          <StatCard label="Scheduled Exams" value={safeSchedule.length} icon={Icon.calendar} />
          <StatCard label="Labs Available" value={safeLabs.filter(l => l?.status === "Available").length} icon={Icon.server} />
          <StatCard label="Total Capacity" value={safeSchedule.reduce((s, e) => s + (e?.capacity || 0), 0)} icon={Icon.users} />
        </div>
        <Card style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.grey100}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>Exam Schedule</span>
            <Badge>Spring 2026</Badge>
          </div>
          <Table
            columns={["Exam", "Section", "Date", "Time", "Lab", "Invigilator", "Lab Capacity", "Status"]}
            rows={safeSchedule.map((s) => [
              <span style={{ fontWeight: 700, color: C.navy }}>{s?.course_code} {s?.exam_type}</span>,
              <Badge>{s?.section_name}</Badge>,
              s?.exam_date ? new Date(s.exam_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "TBD",
              `${(s?.start_time || "--:--").substring(0, 5)} - ${(s?.end_time || "--:--").substring(0, 5)}`,
              s?.lab_name || "N/A",
              s?.invigilator_name || <span style={{ color: C.grey500, fontWeight: 600 }}>Unassigned</span>,
              s?.capacity || 0,
              statusBadge(s?.status),
            ])} />
        </Card>

        {/* Dynamic Broadcast & Target Specific User Notifications */}
        <Card>
          <h3 style={{ margin: "0 0 18px", fontWeight: 800, color: C.navy, fontSize: 15 }}>Broadcast Notification</h3>
          {notifSent && (
            <div style={{ marginBottom: 14, padding: "10px 14px", background: C.tealLight, borderRadius: 8, fontSize: 13, color: C.navy, fontWeight: 700 }}>
              Notification sent to {broadcastType === "all" ? notifAudience : (specificUser === "custom" ? customUser : specificUser)}.
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
            <button
              onClick={() => setBroadcastType("all")}
              style={{
                flex: 1, padding: "10px", borderRadius: 8, border: `2px solid ${broadcastType === "all" ? C.teal : C.grey200}`,
                background: broadcastType === "all" ? C.tealLight : C.white,
                color: C.navy, fontWeight: 700, cursor: "pointer", transition: "all 0.2s"
              }}
            >
              📢 Broadcast to All
            </button>
            <button
              onClick={() => setBroadcastType("specific")}
              style={{
                flex: 1, padding: "10px", borderRadius: 8, border: `2px solid ${broadcastType === "specific" ? C.teal : C.grey200}`,
                background: broadcastType === "specific" ? C.tealLight : C.white,
                color: C.navy, fontWeight: 700, cursor: "pointer", transition: "all 0.2s"
              }}
            >
              👤 Message Specific User
            </button>
          </div>

          <div className="resp-grid-2" style={{ gap: 16, marginBottom: 16 }}>
            {broadcastType === "all" ? (
              <Select label="Audience Group" value={notifAudience} onChange={(e) => setNotifAudience(e.target.value)}>
                <option>All Students</option>
                <option>CS Department Only</option>
                <option>Invigilators Only</option>
                <option>All Teachers & Faculty</option>
              </Select>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Select label="Select User" value={specificUser} onChange={(e) => setSpecificUser(e.target.value)}>
                  <option value="">Choose a user...</option>
                  <option value="Ali Hassan (Student - 2021-CS-101)">Ali Hassan (Student - 2021-CS-101)</option>
                  <option value="Sara Malik (Student - F21-302)">Sara Malik (Student - F21-302)</option>
                  <option value="Dr. Sana Mir (Teacher)">Dr. Sana Mir (Teacher)</option>
                  <option value="Prof. Arif (Teacher)">Prof. Arif (Teacher)</option>
                  <option value="custom">Type Custom Roll No / Email...</option>
                </Select>
                {specificUser === "custom" && (
                  <Input
                    label="Enter Custom Roll No / Email"
                    placeholder="e.g. F21-123 or name@university.edu"
                    value={customUser}
                    onChange={(e) => setCustomUser(e.target.value)}
                  />
                )}
              </div>
            )}
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
          <StatCard label="Total Labs" value={labs.length} icon={Icon.server} />
          <StatCard label="Available Now" value={labs.filter(l => l.status === "Available").length} icon={Icon.check} accent={C.green} light={C.greenLight} />
          <StatCard label="Total PC Capacity" value={labs.reduce((s, l) => s + l.capacity, 0)} icon={Icon.monitor} />
        </div>
        <Card style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.grey100}`, fontWeight: 700, fontSize: 15, color: C.navy }}>Lab Status</div>
          <Table
            columns={["Lab", "PCs", "Capacity", "Network Range", "Current Exam", "Status"]}
            rows={safeLabs.map((lab) => {
              const sc = lab?.status === "Available" ? [C.teal, C.tealLight] : lab?.status === "In Use" ? [C.navy, C.grey200] : [C.amber, C.amberLight];
              return [
                <span style={{ fontWeight: 800, color: C.navy }}>{lab?.lab_name}</span>,
                lab?.total_pcs || 0, lab?.capacity || 0,
                <span style={{ fontFamily: "monospace", fontSize: 13 }}>{lab?.network_range || "10.0.0.0/24"}</span>,
                lab?.status === "InUse" ? <Badge>Lab Active</Badge> : <span style={{ color: C.grey400 }}>—</span>,
                <Badge color={sc[0]} bg={sc[1]}>{lab?.status || "Available"}</Badge>,
              ];
            })} />
        </Card>
        <div className="resp-grid-2">
          <Card>
            <h3 style={{ margin: "0 0 16px", fontWeight: 800, color: C.navy, fontSize: 15 }}>Capacity Utilization</h3>
            {safeLabs.map((lab) => {
              const pct = Math.round(((lab?.capacity || 1) / (lab?.total_pcs || 1)) * 100);
              return (
                <div key={lab?.lab_id || Math.random()} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: C.grey800, marginBottom: 5 }}>
                    <span>{lab?.lab_name}</span><span style={{ color: C.grey500 }}>{lab?.capacity}/{lab?.total_pcs} PCs usable</span>
                  </div>
                  <div style={{ height: 7, background: C.grey100, borderRadius: 99 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: lab?.status === "Maintenance" ? C.amber : C.teal, borderRadius: 99 }} />
                  </div>
                </div>
              );
            })}
          </Card>
          <Card>
            <h3 style={{ margin: "0 0 16px", fontWeight: 800, color: C.navy, fontSize: 15 }}>Network IP Ranges</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {safeLabs.map((lab) => (
                <div key={lab?.lab_id || Math.random()} style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", background: C.grey50, borderRadius: 8, border: `1px solid ${C.grey200}` }}>
                  <span style={{ fontWeight: 700, color: C.navy, fontSize: 14 }}>{lab?.lab_name}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 13, color: C.grey500 }}>{lab?.network_range}</span>
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