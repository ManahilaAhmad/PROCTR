import { useState, useEffect } from "react";
import { C } from "../theme/colors";
import { Icon } from "../theme/icons";
import PageWrap from "../components/common/PageWrap";
import Card from "../components/common/Card";
import Btn from "../components/common/Btn";
import Input from "../components/common/Input";
import Select from "../components/common/Select";
import Table from "../components/common/Table";
import StatCard from "../components/common/StatCard";
import Badge from "../components/common/Badge";
import { API_BASE_URL } from "../config/apiConfig";

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

export default function CoordinatorPage({ activePage, user }) {
  const [schedule, setSchedule] = useState([]);
  const [labs, setLabs] = useState([]);
  const [approvedExams, setApprovedExams] = useState([]);
  const [schedulableOfferings, setSchedulableOfferings] = useState([]);

  // Fetch labs, schedule, and approved exams from database
  const fetchData = () => {
    fetch(`${API_BASE_URL}/coordinator/labs`)
      .then(res => res.json())
      .then(data => { if (data.status === "success") setLabs(data.labs); });

    fetch(`${API_BASE_URL}/coordinator/schedule`)
      .then(res => res.json())
      .then(data => { if (data.status === "success") setSchedule(data.schedule); });

   fetch(`${API_BASE_URL}/coordinator/exams/approved`)
      .then(res => res.json())
      .then(data => { if (data.status === "success") setApprovedExams(data.exams); });

   fetch(`${API_BASE_URL}/coordinator/schedule-options`)
     .then(res => res.json())
     .then(data => { if (data.status === "success") setSchedulableOfferings(data.offerings); });
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
  const [schedOffering, setSchedOffering] = useState("");
  const [schedExamType, setSchedExamType] = useState("LabMid");
  const [schedDate, setSchedDate] = useState("");
  const [schedLab, setSchedLab] = useState("");
  const [schedStartTime, setSchedStartTime] = useState("09:00");
  const [schedEndTime, setSchedEndTime] = useState("10:30");

  // Tracks whether the modal is creating a new schedule entry or editing an existing one
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [editingIndependentSchedule, setEditingIndependentSchedule] = useState(false);

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
      fetch(`${API_BASE_URL}/coordinator/notifications/recipients?search=${encodeURIComponent(specificSearch.trim())}`)
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
    fetch(`${API_BASE_URL}/coordinator/notifications/broadcast`, {
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
    setEditingIndependentSchedule(false);
    setSchedExam(""); setSchedOffering(""); setSchedExamType("LabMid"); setSchedDate(""); setSchedLab("");
    setSchedStartTime("09:00"); setSchedEndTime("10:30");
    setShowSchedule(true);
  }

  function openEditSchedule(s) {
    setEditingScheduleId(s?.schedule_id ?? s?.id);
    setEditingIndependentSchedule(Boolean(s?.is_independent_schedule));
    setSchedOffering(s?.course_offering_id != null ? String(s.course_offering_id) : "");
    setSchedExamType(s?.exam_type || "LabMid");
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
    setEditingIndependentSchedule(false);
  }

  const [isSubmitting, setIsSubmitting] = useState(false);

  function confirmSchedule() {
    if (isSubmitting) return;
    const isIndependent = editingScheduleId == null || editingIndependentSchedule;
    if ((isIndependent ? !schedOffering : !schedExam) || !schedLab || !schedDate || !schedStartTime || !schedEndTime) {
      alert("Please fill all scheduling fields.");
      return;
    }

    setIsSubmitting(true);

    const payload = isIndependent
      ? {
          course_offering_id: Number(schedOffering),
          exam_type: schedExamType,
          lab_id: Number(schedLab),
          exam_date: schedDate,
          start_time: schedStartTime + ":00",
          end_time: schedEndTime + ":00",
        }
      : {
          exam_id: Number(schedExam),
          lab_id: Number(schedLab),
          user_id: user?.userId || 1,
          exam_date: schedDate,
          start_time: schedStartTime + ":00",
          end_time: schedEndTime + ":00",
        };

    const isEdit = editingScheduleId != null;
    const url = isIndependent
      ? (isEdit ? `${API_BASE_URL}/coordinator/timetable/${editingScheduleId}` : `${API_BASE_URL}/coordinator/timetable`)
      : (isEdit ? `${API_BASE_URL}/coordinator/schedule/${editingScheduleId}` : `${API_BASE_URL}/coordinator/schedule`);

    fetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(res => res.json())
      .then(data => {
        setIsSubmitting(false);
        if (data.status === "success") {
          alert(isEdit ? "Exam schedule updated!" : "Exam timetable published. Students and the course teacher have been notified.");
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
    const url = s?.is_independent_schedule
      ? `${API_BASE_URL}/coordinator/timetable/${s?.timetable_id ?? id}`
      : `${API_BASE_URL}/coordinator/schedule/${id}`;
    fetch(url, { method: "DELETE" })
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
    if (safeSchedule.length === 0) {
      alert("There are no scheduled exams to export.");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("The date sheet could not open because the browser blocked the new window. Allow pop-ups for this site and try again.");
      return;
    }

    const escapeHtml = (value) => String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
    const sortedSchedule = [...safeSchedule].sort((a, b) => {
      const programOrder = String(a?.program_code || a?.program_name || "").localeCompare(String(b?.program_code || b?.program_name || ""));
      if (programOrder) return programOrder;
      const sectionOrder = `${a?.batch_name || ""} ${a?.section_name || ""}`.localeCompare(`${b?.batch_name || ""} ${b?.section_name || ""}`);
      if (sectionOrder) return sectionOrder;
      const dateOrder = String(a?.exam_date || "").localeCompare(String(b?.exam_date || ""));
      return dateOrder || String(a?.start_time || "").localeCompare(String(b?.start_time || ""));
    });
    const programs = new Map();
    sortedSchedule.forEach((exam) => {
      const scheduleRef = exam?.schedule_id ?? "unknown";
      const programName = exam?.program_name || (exam?.program_id ? `Program ID ${exam.program_id}` : `Program details unavailable · schedule #${scheduleRef}`);
      const programCode = exam?.program_code || "";
      const programKey = String(exam?.program_id ?? `missing-${scheduleRef}`);
      if (!programs.has(programKey)) {
        programs.set(programKey, { name: programName, code: programCode, sections: new Map() });
      }
      const sectionName = exam?.section_name || (exam?.section_id ? `Section ID ${exam.section_id}` : `Section details unavailable · schedule #${scheduleRef}`);
      const batchName = exam?.batch_name || (exam?.batch_id ? `Batch ID ${exam.batch_id}` : `Batch details unavailable · schedule #${scheduleRef}`);
      const sectionKey = `${exam?.batch_id ?? `missing-${scheduleRef}`}|${exam?.section_id ?? scheduleRef}`;
      const program = programs.get(programKey);
      if (!program.sections.has(sectionKey)) {
        program.sections.set(sectionKey, { name: sectionName, batch: batchName, batchId: exam?.batch_id, sectionId: exam?.section_id, exams: [] });
      }
      program.sections.get(sectionKey).exams.push(exam);
    });
    const renderTable = (exams) => `
      <table>
        <thead><tr><th>Course</th><th>Exam</th><th>Date</th><th>Time</th><th>Lab</th><th>Invigilator</th><th>Capacity</th></tr></thead>
        <tbody>${exams.map((exam) => `
          <tr>
            <td>${escapeHtml([exam?.course_code, exam?.course_title].filter(Boolean).join(" - ") || "—")}</td>
            <td>${escapeHtml(exam?.exam_type || "—")}</td>
            <td>${escapeHtml(exam?.exam_date ? new Date(exam.exam_date).toLocaleDateString() : "TBD")}</td>
            <td>${escapeHtml(`${(exam?.start_time || "--:--").substring(0, 5)}–${(exam?.end_time || "--:--").substring(0, 5)}`)}</td>
            <td>${escapeHtml(exam?.lab_name || "N/A")}</td>
            <td>${escapeHtml(exam?.invigilator_name || "Unassigned")}</td>
            <td>${escapeHtml(exam?.capacity ?? "—")}</td>
          </tr>`).join("")}
        </tbody>
      </table>`;
    const groupedSheets = Array.from(programs.values()).map((program) => `
      <section class="program-group">
        <h2>${escapeHtml([program.code, program.name].filter(Boolean).join(" — "))}</h2>
        ${Array.from(program.sections.values()).map((section) => `
          <section class="section-group">
            <h3>${escapeHtml([section.batch, `Section ${section.name}`].filter(Boolean).join(" · "))}</h3>
            ${renderTable(section.exams)}
          </section>`).join("")}
      </section>`).join("");

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Exam Date Sheet</title>
          <style>
            body { font: 14px Arial, sans-serif; color: #1a2b4b; margin: 32px; }
            header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
            h1 { margin: 0 0 6px; font-size: 24px; }
            h2 { margin: 0 0 14px; padding-bottom: 8px; color: #385966; border-bottom: 2px solid #d7e0e6; font-size: 20px; }
            h3 { margin: 0 0 10px; color: #557987; font-size: 16px; }
            p { margin: 0; color: #557987; }
            .generated { color: #64748b; font-size: 12px; text-align: right; }
            button { border: 0; border-radius: 7px; padding: 10px 16px; background: #557987; color: white; font-size: 13px; font-weight: 700; cursor: pointer; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #d7e0e6; padding: 9px 10px; text-align: left; }
            th { background: #eaf1f4; color: #385966; font-size: 11px; text-transform: uppercase; }
            tr { break-inside: avoid; }
            .program-group { margin: 28px 0; break-inside: avoid; }
            .section-group { margin: 18px 0 24px; }
            @media print {
              body { margin: 12mm; }
              .print-action { display: none; }
            }
          </style>
        </head>
        <body>
          <header>
            <div><h1>Exam Date Sheet</h1><p>Scheduled exams, rooms, and invigilator assignments</p></div>
            <div><div class="generated">Generated ${escapeHtml(new Date().toLocaleString())}</div><button class="print-action" onclick="window.print()">Print / Save as PDF</button></div>
          </header>
          ${groupedSheets}
          <script>window.addEventListener("load", () => setTimeout(() => window.print(), 250));</script>
        </body>
      </html>`);
    printWindow.document.close();
  }

  const safeSchedule = (Array.isArray(schedule) ? schedule : []).filter(Boolean);
  const safeLabs     = (Array.isArray(labs) ? labs : []).filter(Boolean);
  const safeApproved = (Array.isArray(approvedExams) ? approvedExams : []).filter(Boolean);
  const safeOfferings = (Array.isArray(schedulableOfferings) ? schedulableOfferings : []).filter(Boolean);
  const groupedSchedule = (() => {
    const programs = new Map();
    const sortedSchedule = [...safeSchedule].sort((a, b) => {
      const programOrder = String(a?.program_code || a?.program_name || "").localeCompare(String(b?.program_code || b?.program_name || ""));
      if (programOrder) return programOrder;
      const sectionOrder = `${a?.batch_name || ""} ${a?.section_name || ""}`.localeCompare(`${b?.batch_name || ""} ${b?.section_name || ""}`);
      if (sectionOrder) return sectionOrder;
      const dateOrder = String(a?.exam_date || "").localeCompare(String(b?.exam_date || ""));
      return dateOrder || String(a?.start_time || "").localeCompare(String(b?.start_time || ""));
    });

    sortedSchedule.forEach((exam) => {
      const scheduleRef = exam?.schedule_id ?? "unknown";
      const programName = exam?.program_name || "";
      const programCode = exam?.program_code || "";
      const programId = exam?.program_id ?? `missing-${scheduleRef}`;
      const programKey = String(programId);
      if (!programs.has(programKey)) {
        programs.set(programKey, { key: programKey, name: programName, code: programCode, id: exam?.program_id, sections: new Map() });
      }

      const sectionName = exam?.section_name || "";
      const batchName = exam?.batch_name || "";
      const sectionKey = `${exam?.batch_id ?? `missing-${scheduleRef}`}|${exam?.section_id ?? scheduleRef}`;
      const program = programs.get(programKey);
      if (!program.sections.has(sectionKey)) {
        program.sections.set(sectionKey, { key: sectionKey, name: sectionName, batch: batchName, batchId: exam?.batch_id, sectionId: exam?.section_id, exams: [] });
      }
      program.sections.get(sectionKey).exams.push(exam);
    });

    return Array.from(programs.values()).map(program => ({
      ...program,
      sections: Array.from(program.sections.values()),
    }));
  })();
  const scheduleDetailsMissing = safeSchedule.some(exam =>
    !exam?.program_id || !exam?.program_name || !exam?.batch_id || !exam?.batch_name || !exam?.section_id
  );

  return (
    <PageWrap
      className={activePage === "coordinator-broadcast" ? "coordinator-broadcast-page" : ""}
      title={activePage === "coordinator-broadcast" ? "Broadcast Notification" : "Scheduling & Date Sheets"}
      subtitle={activePage === "coordinator-broadcast" ? "Send updates to a group or a specific user" : "Manage exam timetables, lab assignments, and invigilators"}
      actions={activePage === "coordinator-broadcast" ? undefined : <><Btn variant="ghost" size="sm" onClick={exportDateSheet}>Export Date Sheet</Btn><Btn variant="primary" onClick={openScheduleModal}>+ Schedule Exam</Btn></>}>
      {activePage !== "coordinator-broadcast" && showSchedule && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(17,29,51,.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={closeScheduleModal}>
          <div style={{ background: C.white, borderRadius: 16, padding: 40, width: 440, boxShadow: "0 24px 64px rgba(0,0,0,.18)", animation: "popIn .28s cubic-bezier(.22,.68,0,1.3) both" }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 24px", fontSize: 18, fontWeight: 800, color: C.navy }}>{editingScheduleId != null ? "Edit Scheduled Exam" : "Schedule Exam"}</h2>
            {editingScheduleId != null && !editingIndependentSchedule ? <Select label="Approved Exam" value={schedExam} onChange={(e) => {
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
            </Select> : <>
              <Select label="Program / Batch / Section / Course" value={schedOffering} onChange={(e) => setSchedOffering(e.target.value)} disabled={editingIndependentSchedule}>
                <option value="">{safeOfferings.length ? "Select a course offering..." : "No course offerings available"}</option>
                {safeOfferings.map(offering => (
                  <option key={offering.course_offering_id} value={offering.course_offering_id}>
                    {offering.program_code} · {offering.batch_name} · Section {offering.section_name} · {offering.course_code} — {offering.course_title}
                  </option>
                ))}
              </Select>
              <Select label="Exam Type" value={schedExamType} onChange={(e) => setSchedExamType(e.target.value)} disabled={editingIndependentSchedule}>
                <option value="LabMid">Lab Mid</option>
                <option value="LabFinal">Lab Final</option>
                <option value="LabPractical">Lab Practical</option>
              </Select>
            </>}
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
                {isSubmitting ? "Saving..." : (editingScheduleId != null ? "Save Changes" : "Publish Timetable")}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {activePage !== "coordinator-broadcast" && <>
      <div className="resp-grid-2" style={{ marginBottom: 28 }}>
        <StatCard label="Scheduled Exams" value={safeSchedule.length} icon={Icon.calendar} />
        <StatCard label="Total Capacity" value={safeSchedule.reduce((s, e) => s + (e?.capacity || 0), 0)} icon={Icon.users} />
      </div>
        <Card style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.grey100}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>Exam Schedule</span>
            <Badge>Spring 2026</Badge>
          </div>
          {scheduleDetailsMissing && <div role="alert" style={{ margin: "16px 20px 0", padding: "12px 14px", borderRadius: 9, background: C.amberLight, color: C.navy, fontSize: 13 }}>
            Some schedule entries are missing program or batch details from the API. Restart the backend and refresh this page to load the full identifiers; incomplete entries below are kept separate rather than being grouped together.
          </div>}
          {groupedSchedule.length === 0
            ? <div style={{ padding: 28, textAlign: "center", color: C.grey500 }}>No exams have been scheduled yet.</div>
            : groupedSchedule.map(program => (
              <section key={program.key} style={{ padding: "20px 20px 4px" }}>
                <h3 style={{ margin: "0 0 14px", paddingBottom: 10, borderBottom: "1px solid rgba(85,121,135,.2)", color: "#557987", fontSize: 16, fontWeight: 800, textAlign: "left" }}>
                  {[program.code, program.name || `Program details unavailable · schedule #${program.key.replace("missing-", "")}`].filter(Boolean).join(" — ")}
                </h3>
                {program.sections.map(section => (
                  <div key={`${program.key}-${section.key}`} style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <Badge color="#557987" bg="#e5f0f4">{section.batch || `Batch details unavailable · ID ${section.batchId ?? section.key.split("|").pop()}`}</Badge>
                      <strong style={{ color: C.navy, fontSize: 13 }}>{section.name ? `Section ${section.name}` : `Section details unavailable · ID ${section.sectionId ?? section.key.split("|").pop()}`}</strong>
                    </div>
                    <Table
                      columns={["Course", "Exam", "Date", "Time", "Lab", "Invigilator", "Actions"]}
                      rows={section.exams.map((s) => [
                        <span style={{ fontWeight: 700, color: C.navy }}>
                          {s?.course_code}
                          {s?.course_title ? <span style={{ fontWeight: 500, color: C.grey500 }}> - {s.course_title}</span> : null}
                        </span>,
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
                  </div>
                ))}
              </section>
            ))}
        </Card>

      </>}

      {activePage === "coordinator-broadcast" && <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <Card style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: "rgba(85,121,135,.12)", color: "#557987", display: "flex", alignItems: "center", justifyContent: "center" }}>{Icon.bell}</div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, color: "#557987" }}>Create a notification</h2>
              <p style={{ margin: "4px 0 0", color: C.grey500, fontSize: 13 }}>Choose your recipients, add a subject and message, then send.</p>
            </div>
          </div>
          {notifSent && (
            <div style={{
              marginBottom: 16,
              padding: "14px 18px",
              background: "linear-gradient(135deg, #557987, #7899a6)",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              gap: 12,
              boxShadow: "0 8px 20px rgba(47,110,139,.18)",
              animation: "slideDown 0.3s ease",
            }}>
              <span style={{ fontSize: 20 }}>{Icon.checkCircle}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 2 }}>Notification Sent Successfully!</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>Your message has been delivered to <strong>{notifSentTo}</strong>.</div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
            <button
              onClick={() => setBroadcastType("all")}
              aria-pressed={broadcastType === "all"}
              style={{
                flex: 1, padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${broadcastType === "all" ? "#557987" : C.grey200}`,
                background: broadcastType === "all" ? "rgba(85,121,135,.1)" : "rgba(255,255,255,.5)",
                color: broadcastType === "all" ? "#557987" : C.grey600, fontWeight: 700, cursor: "pointer", transition: "all 0.2s"
              }}
            >
              Broadcast to a group
            </button>
            <button
              onClick={() => setBroadcastType("specific")}
              aria-pressed={broadcastType === "specific"}
              style={{
                flex: 1, padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${broadcastType === "specific" ? "#557987" : C.grey200}`,
                background: broadcastType === "specific" ? "rgba(85,121,135,.1)" : "rgba(255,255,255,.5)",
                color: broadcastType === "specific" ? "#557987" : C.grey600, fontWeight: 700, cursor: "pointer", transition: "all 0.2s"
              }}
            >
              Message a specific user
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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", background: "rgba(85,121,135,.1)", borderRadius: 10, border: "1.5px solid rgba(85,121,135,.4)" }}>
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
            <Input label="Subject" placeholder="e.g. Exam schedule published" value={notifSubject} onChange={(e) => setNotifSubject(e.target.value)} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label htmlFor="coordinator-notification-message" style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#557987", marginBottom: 6 }}>Message</label>
            <textarea id="coordinator-notification-message" value={notifMsg} onChange={(e) => setNotifMsg(e.target.value)} placeholder="Write the notification message…" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid rgba(255,255,255,.9)", fontSize: 14, color: C.grey800, background: "rgba(255,255,255,.5)", minHeight: 140, resize: "vertical", boxSizing: "border-box", outline: "none", fontFamily: "inherit", boxShadow: "0 7px 22px rgba(47,110,139,.08)" }} />
          </div>
          <Btn
            variant="primary"
            onClick={sendNotif}
            disabled={isSending}
            style={{ opacity: isSending ? 0.7 : 1, cursor: isSending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}
          >
            {isSending ? (
              <><span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> Sending…</>
            ) : <>{Icon.send} Send Notification</>}
          </Btn>
        </Card>
      </div>}

      <div style={{ height: 48 }} />
    </PageWrap>
  );
}
