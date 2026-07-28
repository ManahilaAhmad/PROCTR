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

// Small inline icon buttons for row actions (edit / delete)
function EditIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function TrashIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function RowActionBtn({ onClick, title, hoverColor, children }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 30, height: 30, borderRadius: 7, border: "none", cursor: "pointer",
        background: hover ? `${hoverColor}1A` : "transparent",
        color: hover ? hoverColor : C.grey500,
        transition: "all .15s",
      }}
    >
      {children}
    </button>
  );
}

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
    fetch("http://localhost:5000/api/coordinator/labs")
      .then(res => res.json())
      .then(data => { if (data.status === "success") setLabs(data.labs); });

    fetch("http://localhost:5000/api/coordinator/schedule")
      .then(res => res.json())
      .then(data => { if (data.status === "success") setSchedule(data.schedule); });

   fetch("http://localhost:5000/api/coordinator/exams/approved")
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
  const [notifSentTo, setNotifSentTo] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  const [schedExam, setSchedExam] = useState("");
  const [schedDate, setSchedDate] = useState("");
  const [schedLab, setSchedLab] = useState("");
  const [schedStartTime, setSchedStartTime] = useState("09:00");
  const [schedEndTime, setSchedEndTime] = useState("10:30");

  // Tracks whether the modal is creating a new schedule entry or editing an existing one
  const [editingScheduleId, setEditingScheduleId] = useState(null);

  // Broadcast states
  const [broadcastType, setBroadcastType] = useState("all"); // "all" | "specific"
  const [specificSearch, setSpecificSearch] = useState("");
  const [specificResults, setSpecificResults] = useState([]);
  const [specificSearching, setSpecificSearching] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState(null); // { user_id, first_name, last_name, user_type, registration_no }

  // Live search against real users as the coordinator types
  useEffect(() => {
    if (broadcastType !== "specific" || specificSearch.trim().length < 2) {
      setSpecificResults([]);
      return;
    }
    setSpecificSearching(true);
    const t = setTimeout(() => {
      fetch(`http://localhost:5000/api/coordinator/notifications/recipients?search=${encodeURIComponent(specificSearch.trim())}`)
        .then(res => res.json())
        .then(data => { if (data.status === "success") setSpecificResults(data.users); })
        .catch(() => setSpecificResults([]))
        .finally(() => setSpecificSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [specificSearch, broadcastType]);

  function targetLabel(u) {
    if (!u) return "";
    const name = `${u.first_name} ${u.last_name}`;
    const tag = u.user_type === "student" && u.registration_no ? u.registration_no : u.user_type;
    return `${name} (${tag})`;
  }

  function sendNotif() {
    if (!notifSubject.trim() || !notifMsg.trim()) {
      alert("Please fill in both the subject and message fields.");
      return;
    }
    if (broadcastType === "specific" && !selectedTarget) {
      alert("Please select a user to message.");
      return;
    }
    setIsSending(true);
    const recipientLabel = broadcastType === "all" ? notifAudience : targetLabel(selectedTarget);
    fetch("http://localhost:5000/api/coordinator/notifications/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user?.userId || 1,
        subject: notifSubject.trim(),
        message: notifMsg.trim(),
        audience_type: broadcastType === "all" ? notifAudience : "Specific",
        target_user_id: broadcastType === "specific" ? selectedTarget.user_id : null,
      }),
    })
      .then(res => res.json())
      .then(data => {
        setIsSending(false);
        if (data.status === "success") {
          setNotifSentTo(recipientLabel);
          setNotifSent(true);
          setNotifSubject(""); setNotifMsg("");
          setSpecificSearch(""); setSpecificResults([]); setSelectedTarget(null);
          setTimeout(() => setNotifSent(false), 5000);
        } else {
          alert(data.message || "Failed to broadcast notification.");
        }
      })
      .catch(err => { setIsSending(false); alert("Connection error to notifications api."); });
  }

  function openScheduleModal() {
    setEditingScheduleId(null);
    setSchedExam(""); setSchedDate(""); setSchedLab("");
    setSchedStartTime("09:00"); setSchedEndTime("10:30");
    setShowSchedule(true);
  }

  function openEditSchedule(s) {
    setEditingScheduleId(s?.schedule_id ?? s?.id);
    setSchedExam(s?.exam_id != null ? String(s.exam_id) : "");
    setSchedDate(s?.exam_date ? String(s.exam_date).substring(0, 10) : "");
    setSchedLab(s?.lab_id != null ? String(s.lab_id) : "");
    setSchedStartTime((s?.start_time || "09:00:00").substring(0, 5));
    setSchedEndTime((s?.end_time || "10:30:00").substring(0, 5));
    setShowSchedule(true);
  }

  function closeScheduleModal() {
    setShowSchedule(false);
    setEditingScheduleId(null);
  }

  const [isSubmitting, setIsSubmitting] = useState(false);

  function confirmSchedule() {
    if (isSubmitting) return;
    if (!schedExam || !schedLab || !schedDate || !schedStartTime || !schedEndTime) {
      alert("Please fill all scheduling fields.");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      exam_id: parseInt(schedExam),
      lab_id: parseInt(schedLab),
      user_id: user?.userId || 1,
      exam_date: schedDate,
      start_time: schedStartTime + ":00",
      end_time: schedEndTime + ":00",
    };

    const isEdit = editingScheduleId != null;
    const url = isEdit
      ? `http://localhost:5000/api/coordinator/schedule/${editingScheduleId}`
      : "http://localhost:5000/api/coordinator/schedule";

    fetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(res => res.json())
      .then(data => {
        setIsSubmitting(false);
        if (data.status === "success") {
          alert(isEdit ? "Exam schedule updated!" : "Exam scheduled successfully!");
          closeScheduleModal();
          fetchData();
        } else {
          alert(data.message || "Failed to save schedule.");
        }
      })
      .catch(err => {
        setIsSubmitting(false);
        alert("Network error. Failed to save schedule.");
      });
  }

  function deleteSchedule(s) {
    const label = `${s?.course_code || ""} ${s?.exam_type || ""}`.trim() || "this exam";
    if (!window.confirm(`Remove the scheduled slot for ${label}?`)) return;

    const id = s?.schedule_id ?? s?.id;
    fetch(`http://localhost:5000/api/coordinator/schedule/${id}`, { method: "DELETE" })
      .then(res => res.json())
      .then(data => {
        if (data.status === "success") {
          fetchData();
        } else {
          alert(data.message || "Failed to delete schedule.");
        }
      })
      .catch(err => alert("Network error. Failed to delete schedule."));
  }

  function exportDateSheet() {
    alert("Date sheet exported as PDF.");
  }

  const safeSchedule = (Array.isArray(schedule) ? schedule : []).filter(Boolean);
  const safeLabs     = (Array.isArray(labs) ? labs : []).filter(Boolean);
  const safeApproved = (Array.isArray(approvedExams) ? approvedExams : []).filter(Boolean);

  return (
    <PageWrap title={activeTab === "rooms" ? "Lab Rooms" : "Scheduling & Date Sheets"} subtitle={activeTab === "rooms" ? "Current lab availability and network details" : "Manage exam timetables, lab assignments, and invigilators"}
      actions={activeTab === "schedule" ? <><Btn variant="ghost" size="sm" onClick={exportDateSheet}>Export Date Sheet</Btn><Btn variant="primary" onClick={openScheduleModal}>+ Schedule Exam</Btn></> : undefined}>
      {showSchedule && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(17,29,51,.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={closeScheduleModal}>
          <div style={{ background: C.white, borderRadius: 16, padding: 40, width: 440, boxShadow: "0 24px 64px rgba(0,0,0,.18)", animation: "popIn .28s cubic-bezier(.22,.68,0,1.3) both" }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 24px", fontSize: 18, fontWeight: 800, color: C.navy }}>{editingScheduleId != null ? "Edit Scheduled Exam" : "Schedule Exam"}</h2>
            <Select label="Approved Exam" value={schedExam} onChange={(e) => {
              const selectedId = e.target.value;
              setSchedExam(selectedId);
              if (selectedId) {
                const found = safeApproved.find(ex => String(ex.exam_id) === String(selectedId));
                if (found?.proposed_date) {
                  setSchedDate(new Date(found.proposed_date).toISOString().split('T')[0]);
                }
              }
            }}>
              <option value="">
                {safeApproved.filter(e => !safeSchedule.some(s => String(s.exam_id) === String(e.exam_id)) || String(e.exam_id) === String(schedExam)).length === 0
                  ? "No unscheduled approved exams available"
                  : "Select an approved exam..."}
              </option>
              {safeApproved
                .filter(e => !safeSchedule.some(s => String(s.exam_id) === String(e.exam_id)) || String(e.exam_id) === String(schedExam))
                .map(e => {
                  const propDateStr = e.proposed_date
                    ? ` — Proposed: ${new Date(e.proposed_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                    : "";
                  return (
                    <option key={e.exam_id} value={e.exam_id}>
                      {e.course_code} {e.exam_type} ({e.section_name}){propDateStr}
                    </option>
                  );
                })}
            </Select>
            <Input label="Date" type="date" min={new Date().toISOString().split('T')[0]} value={schedDate} onChange={(e) => setSchedDate(e.target.value)} />
            <Select label="Lab" value={schedLab} onChange={(e) => setSchedLab(e.target.value)}>
              <option value="">Select a lab…</option>
              {safeLabs.filter(l => l.status === "Available" || String(l.lab_id) === String(schedLab)).map(l => <option key={l.lab_id} value={l.lab_id}>{l.lab_name} (Cap: {l.capacity})</option>)}
            </Select>
            <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
              <div style={{ flex: 1 }}><Input label="Start Time" type="time" value={schedStartTime} onChange={(e) => setSchedStartTime(e.target.value)} /></div>
              <div style={{ flex: 1 }}><Input label="End Time" type="time" value={schedEndTime} onChange={(e) => setSchedEndTime(e.target.value)} /></div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <Btn variant="ghost" style={{ flex: 1, justifyContent: "center" }} onClick={closeScheduleModal} disabled={isSubmitting}>Cancel</Btn>
              <Btn variant="navy" style={{ flex: 1, justifyContent: "center", opacity: isSubmitting ? 0.6 : 1 }} onClick={confirmSchedule} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : (editingScheduleId != null ? "Save Changes" : "Confirm Schedule")}
              </Btn>
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
            columns={["Course", "Section", "Exam", "Date", "Time", "Lab", "Invigilator", "Actions"]}
            rows={safeSchedule.map((s) => [
              <span style={{ fontWeight: 700, color: C.navy }}>
                {s?.course_code}
                {s?.course_title ? <span style={{ fontWeight: 500, color: C.grey500 }}> - {s.course_title}</span> : null}
              </span>,
              <Badge>{s?.section_name}</Badge>,
              s?.exam_type || "—",
              s?.exam_date ? new Date(s.exam_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "TBD",
              `${(s?.start_time || "--:--").substring(0, 5)}–${(s?.end_time || "--:--").substring(0, 5)}`,
              s?.lab_name || "N/A",
              s?.invigilator_name || <span style={{ color: C.grey500, fontWeight: 600 }}>Unassigned</span>,
              <div style={{ display: "flex", gap: 4 }}>
                <RowActionBtn title="Edit" hoverColor={C.teal} onClick={() => openEditSchedule(s)}>
                  <EditIcon />
                </RowActionBtn>
                <RowActionBtn title="Delete" hoverColor="#e5484d" onClick={() => deleteSchedule(s)}>
                  <TrashIcon />
                </RowActionBtn>
              </div>,
            ])} />
        </Card>

        {/* Dynamic Broadcast & Target Specific User Notifications */}
        <Card>
          <h3 style={{ margin: "0 0 18px", fontWeight: 800, color: C.navy, fontSize: 15 }}>Broadcast Notification</h3>
          {notifSent && (
            <div style={{
              marginBottom: 16,
              padding: "14px 18px",
              background: "linear-gradient(135deg, #0d9488, #14b8a6)",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              gap: 12,
              boxShadow: "0 4px 16px rgba(20,184,166,0.3)",
              animation: "slideDown 0.3s ease",
            }}>
              <span style={{ fontSize: 20 }}>✅</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 2 }}>Notification Sent Successfully!</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>Your message has been delivered to <strong>{notifSentTo}</strong>.</div>
              </div>
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
              <div style={{ display: "flex", flexDirection: "column", gap: 8, position: "relative" }}>
                {selectedTarget ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", background: C.tealLight, borderRadius: 8, border: `1.5px solid ${C.teal}` }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{targetLabel(selectedTarget)}</span>
                    <button
                      onClick={() => { setSelectedTarget(null); setSpecificSearch(""); }}
                      style={{ border: "none", background: "none", cursor: "pointer", color: C.grey500, fontSize: 16, lineHeight: 1, padding: 4 }}
                      title="Clear selection"
                    >×</button>
                  </div>
                ) : (
                  <>
                    <Input
                      label="Search User"
                      placeholder="Type a name, email, or roll no…"
                      value={specificSearch}
                      onChange={(e) => setSpecificSearch(e.target.value)}
                    />
                    {specificSearch.trim().length >= 2 && (
                      <div style={{ border: `1px solid ${C.grey200}`, borderRadius: 8, maxHeight: 180, overflowY: "auto", background: C.white }}>
                        {specificSearching ? (
                          <div style={{ padding: "10px 14px", fontSize: 13, color: C.grey500 }}>Searching…</div>
                        ) : specificResults.length === 0 ? (
                          <div style={{ padding: "10px 14px", fontSize: 13, color: C.grey500 }}>No matching users found.</div>
                        ) : (
                          specificResults.map((u) => (
                            <div
                              key={u.user_id}
                              onClick={() => { setSelectedTarget(u); setSpecificSearch(""); setSpecificResults([]); }}
                              style={{ padding: "9px 14px", fontSize: 13, cursor: "pointer", borderBottom: `1px solid ${C.grey100}` }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = C.grey50)}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <span style={{ fontWeight: 700, color: C.navy }}>{u.first_name} {u.last_name}</span>
                              <span style={{ color: C.grey500 }}> — {u.user_type === "student" && u.registration_no ? u.registration_no : u.user_type}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            <Input label="Subject" placeholder="e.g. July Exam Schedule Published" value={notifSubject} onChange={(e) => setNotifSubject(e.target.value)} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.grey800, marginBottom: 6 }}>Message</label>
            <textarea value={notifMsg} onChange={(e) => setNotifMsg(e.target.value)} placeholder="Write your notification here..." style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: `1.5px solid ${C.grey200}`, fontSize: 14, color: C.grey800, background: C.grey50, minHeight: 80, resize: "vertical", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }} />
          </div>
          <Btn
            variant="primary"
            onClick={sendNotif}
            disabled={isSending}
            style={{ opacity: isSending ? 0.7 : 1, cursor: isSending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}
          >
            {isSending ? (
              <><span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> Sending…</>
            ) : "📤 Send Notification"}
          </Btn>
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
