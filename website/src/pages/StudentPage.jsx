import { useState, useEffect } from "react";
import { C } from "../theme/colors";
import { Icon } from "../theme/icons";
import PageWrap from "../components/common/PageWrap";
import Card from "../components/common/Card";
import Btn from "../components/common/Btn";
import Input from "../components/common/Input";
import Badge from "../components/common/Badge";
import { API_BASE_URL } from "../config/apiConfig";

const studentAccent = "#557987";
const studentAccentLight = "#e5f0f4";
const studentAdminStyles = `
  @keyframes studentAdminRise {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .student-admin-page {
    position: relative;
    isolation: isolate;
    z-index: 0;
    background: transparent !important;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
    text-align: left;
  }
  .student-admin-page::before {
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
  .student-admin-page .resp-page-padding {
    width: 100%;
    max-width: 1440px;
    margin: 0 auto;
    padding: 36px 40px 48px;
    box-sizing: border-box;
  }
  .student-admin-page h1 {
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif !important;
    color: #557987 !important;
    font-size: 30px !important;
    font-weight: 800 !important;
    letter-spacing: -.5px !important;
  }
  .student-admin-page h2,
  .student-admin-page h3,
  .student-admin-page h4 {
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif !important;
    color: #557987 !important;
    line-height: 1.25;
    font-weight: 800;
    letter-spacing: -.3px;
  }
  .student-admin-page p,
  .student-admin-page label,
  .student-admin-page input,
  .student-admin-page button {
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif !important;
  }
  .student-admin-page .student-admin-card {
    background: linear-gradient(145deg, rgba(255,255,255,.78), rgba(255,255,255,.56)) !important;
    border: 1px solid rgba(255,255,255,.86) !important;
    box-shadow: 0 22px 55px rgba(41,91,117,.16), inset 0 1px 0 rgba(255,255,255,.96) !important;
    backdrop-filter: blur(20px) saturate(135%);
    -webkit-backdrop-filter: blur(20px) saturate(135%);
    animation: studentAdminRise .4s ease both;
  }
  .student-admin-page .student-admin-card,
  .student-admin-page .student-course-card {
    color: #1a2b4b;
  }
  .student-admin-page .student-admin-card input {
    background: rgba(255,255,255,.5) !important;
    border: 1px solid rgba(255,255,255,.9) !important;
    border-radius: 11px !important;
    box-shadow: inset 0 1px 2px rgba(48,91,112,.06), 0 7px 22px rgba(47,110,139,.14);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    outline: none;
  }
  .student-admin-page .student-admin-card input:focus {
    border-color: rgba(85,121,135,.62) !important;
    box-shadow: 0 0 0 3px rgba(85,121,135,.12), 0 7px 22px rgba(47,110,139,.18);
  }
  .student-admin-page .student-admin-card button {
    border-radius: 11px !important;
    font-size: 13px !important;
    font-weight: 700 !important;
    transition: transform .18s ease, box-shadow .18s ease;
  }
  .student-admin-page .student-admin-card button:hover {
    transform: translateY(-1px);
  }
  .student-admin-page .student-course-card {
    background: linear-gradient(145deg, rgba(255,255,255,.78), rgba(255,255,255,.56)) !important;
    border: 1px solid rgba(255,255,255,.86) !important;
    box-shadow: 0 16px 36px rgba(41,91,117,.12), inset 0 1px 0 rgba(255,255,255,.96) !important;
    backdrop-filter: blur(20px) saturate(135%);
    -webkit-backdrop-filter: blur(20px) saturate(135%);
  }
  @media (max-width: 768px) {
    .student-admin-page h1 { font-size: 27px !important; }
    .student-admin-page .resp-page-padding { padding: 20px 16px 32px; }
  }
`;

function getExamDateTime(date, time) {
  if (!date) return null;
  const [year, month, day] = String(date).slice(0, 10).split("-").map(Number);
  const [hours = "0", minutes = "0"] = String(time || "00:00").split(":");
  return new Date(year, month - 1, day, Number(hours), Number(minutes));
}

export default function StudentPage({ activePage, user }) {
  // Profile states
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [toast, setToast] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notificationFilter, setNotificationFilter] = useState("all");
  const [schedule, setSchedule] = useState([]);

  useEffect(() => {
    if (user?.userId) {
      fetch(`${API_BASE_URL}/notifications/${user.userId}`)
        .then(res => res.json())
        .then(data => { if (data.status === "success") setNotifications(data.notifications); });
    }

    if (user?.userId) {
      Promise.all([
        fetch(`${API_BASE_URL}/student/${user.userId}/schedule`).then(res => res.json()).catch(() => null),
        fetch(`${API_BASE_URL}/student/${user.userId}/planned-schedule`).then(res => res.json()).catch(() => null),
      ]).then(([scheduledData, plannedData]) => {
          const scheduled = scheduledData?.status === "success" ? scheduledData.schedule : [];
          const planned = plannedData?.status === "success" ? plannedData.schedule : [];
        const combined = [...scheduled];
        planned.forEach(plan => {
          const existingIndex = combined.findIndex(item =>
            !item.schedule_id &&
            String(item.course_offering_id) === String(plan.course_offering_id) &&
            item.exam_type === plan.exam_type
          );
          if (existingIndex >= 0) {
            combined[existingIndex] = { ...combined[existingIndex], ...plan, exam_id: combined[existingIndex].exam_id };
          } else {
            combined.push(plan);
          }
        });
        setSchedule(combined);
        if (scheduledData?.status !== "success" || plannedData?.status !== "success") {
          console.error("One or more student exam schedule requests failed.");
        }
        })
    }
  }, [user]);

  // Student details — only authentic data from DB
  const studentInfo = {
    name: user?.name || "Student",
    rollNo: user?.registrationNo || user?.rollNo || "—",
    email: user?.email || "—",
    degree: user?.departmentName || user?.programName || "—",
    semester: user?.currentSemester ? `Semester ${user.currentSemester}` : "—",
    batch: user?.batchName || "—",
  };

  const [avatarImg, setAvatarImg] = useState(null); // File object url or null

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }

  function handlePasswordUpdate() {
    if (!currentPass || !newPass || !confirmPass) {
      showToast("Please fill all password fields.", "warn");
      return;
    }
    if (newPass !== confirmPass) {
      showToast("New passwords do not match.", "warn");
      return;
    }
    if (newPass.length < 6) {
      showToast("Password must be at least 6 characters.", "warn");
      return;
    }
    const userId = user?.userId || user?.user_id;
    if (!userId) {
      showToast("Session error. Please log in again.", "warn");
      return;
    }
    fetch(`${API_BASE_URL}/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, current_password: currentPass, new_password: newPass }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === "success") {
          showToast("Password updated successfully!");
          setCurrentPass(""); setNewPass(""); setConfirmPass("");
        } else {
          showToast(data.message || "Failed to update password.", "warn");
        }
      })
      .catch(() => showToast("Network error. Could not update password.", "warn"));
  }

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("Image size must be less than 5MB.", "warn");
      return;
    }
    const userId = user?.userId || user?.user_id;
    if (!userId) {
      showToast("Session error. Please log in again.", "warn");
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);
    formData.append("user_id", userId);

    fetch(`${API_BASE_URL}/auth/profile-picture`, {
      method: "POST",
      body: formData,
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === "success") {
          setAvatarImg(data.profilePictureUrl);
          if (user) {
            const updatedUser = { ...user, profilePictureUrl: data.profilePictureUrl };
            localStorage.setItem("proctr_user", JSON.stringify(updatedUser));
          }
          showToast("Profile picture saved!");
        } else {
          showToast(data.message || "Failed to upload image.", "warn");
        }
      })
      .catch(() => showToast("Network error. Upload failed.", "warn"));
  }

  const currentAvatar = avatarImg || user?.profilePictureUrl || user?.profile_picture_url;
  const enrolledCourses = [...new Map(schedule.map(item => [
    item.course_offering_id,
    item,
  ])).values()];
  const exams = [...schedule.reduce((byExam, item) => {
    if (!item.exam_id && !item.is_independent_schedule) return byExam;
    const key = item.is_independent_schedule
      ? `planned-${item.timetable_id}`
      : `${item.exam_id}-${item.schedule_id || "unscheduled"}`;
    if (!byExam.has(key)) byExam.set(key, { ...item, invigilators: [] });
    const exam = byExam.get(key);
    if (item.invigilator_name && !exam.invigilators.includes(item.invigilator_name)) {
      exam.invigilators.push(item.invigilator_name);
    }
    return byExam;
  }, new Map()).values()];
  const now = new Date();
  const upcomingExams = exams
    .filter(exam => exam.exam_date && getExamDateTime(exam.exam_date, exam.start_time) >= now)
    .sort((a, b) => getExamDateTime(a.exam_date, a.start_time) - getExamDateTime(b.exam_date, b.start_time));
  const awaitingScheduleExams = exams.filter(exam => !exam.exam_date);
  const pastExams = exams
    .filter(exam => exam.exam_date && getExamDateTime(exam.exam_date, exam.start_time) < now)
    .sort((a, b) => getExamDateTime(b.exam_date, b.start_time) - getExamDateTime(a.exam_date, a.start_time));
  function renderExamSection(items, emptyMessage, isScheduled = true) {
    if (!items.length) {
      return <Card className="student-admin-card" style={{ color: C.grey500, fontSize: 13 }}>{emptyMessage}</Card>;
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map(exam => {
          const examDateTime = getExamDateTime(exam.exam_date, exam.start_time);
          return (
            <Card key={exam.is_independent_schedule ? `planned-${exam.timetable_id}` : `${exam.exam_id}-${exam.schedule_id || "unscheduled"}`} className="student-admin-card" style={{ border: `1px solid ${C.grey200}` }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                <strong style={{ color: C.navy }}>{exam.course_code} — {exam.course_title}</strong>
                <Badge color={studentAccent} bg={studentAccentLight}>{exam.section_name}</Badge>
                <Badge color={C.navy} bg={C.grey50}>{exam.exam_type}</Badge>
                {isScheduled
                  ? <Badge color={studentAccent} bg={studentAccentLight}>{exam.schedule_status || "Scheduled"}</Badge>
                  : <Badge color={C.amber} bg="#fffbeb">{exam.exam_status || "Awaiting schedule"}</Badge>}
                {exam.is_independent_schedule && (
                  <Badge color={C.amber} bg="#fffbeb">
                    {exam.exam_status === "PendingHOD" ? "Paper under HOD review" :
                      exam.exam_status === "Approved" ? "Paper approved · schedule link pending" :
                      exam.exam_status === "Rejected" ? "Paper rejected · timetable remains published" :
                      exam.exam_status === "Draft" ? "Paper is a draft" :
                      "Paper not submitted yet"}
                  </Badge>
                )}
              </div>
              {isScheduled ? (
                <>
                  <div style={{ display: "flex", gap: 18, rowGap: 6, fontSize: 13, color: C.grey600, flexWrap: "wrap" }}>
                    <span>📅 {examDateTime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
                    <span>🕐 {exam.start_time?.substring(0, 5)} – {exam.end_time?.substring(0, 5)}</span>
                    <span>🏛 Lab: <strong style={{ color: C.navy }}>{exam.lab_name || "Not assigned"}</strong></span>
                    {exam.duration && <span>⏱ {exam.duration} min</span>}
                    {exam.total_marks && <span>📊 Total marks: <strong style={{ color: C.navy }}>{exam.total_marks}</strong></span>}
                  </div>
                  <div style={{ fontSize: 12, color: C.grey500, marginTop: 7 }}>
                    Teacher: <strong style={{ color: C.navy }}>{exam.teacher_name}</strong>
                    {" · "}Invigilator{exam.invigilators.length === 1 ? "" : "s"}: <strong style={{ color: C.navy }}>{exam.invigilators.join(", ") || "Not yet assigned"}</strong>
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: C.grey500 }}>
                  <span>Teacher: <strong style={{ color: C.navy }}>{exam.teacher_name}</strong></span>
                  {exam.proposed_date && <span>Proposed date: <strong style={{ color: C.navy }}>{getExamDateTime(exam.proposed_date, "00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</strong></span>}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    );
  }
  const visibleNotifications = notifications.filter(notification => {
    if (notificationFilter === "direct") {
      return notification.source === "broadcast" && notification.audience_type === "Specific";
    }
    if (notificationFilter === "students") return notification.audience_type === "AllStudents";
    if (notificationFilter === "department") return notification.audience_type === "Department";
    if (notificationFilter === "automated") return notification.source === "personal";
    return true;
  });

  // ── Render Dashboard Page ──
  if (activePage === "student") {
    return (
      <>
      <style>{studentAdminStyles}</style>
      <PageWrap className="student-admin-page" style={{ background: "transparent" }} title="Student Dashboard" subtitle="Manage your profile, update credentials, and check announcements">
        {toast && (
          <div style={{ position: "fixed", top: 24, right: 24, zIndex: 300, background: toast.type === "warn" ? C.amber : studentAccent, color: C.white, padding: "13px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,.2)", display: "flex", alignItems: "center", gap: 10 }}>
            {toast.type === "warn" ? Icon.alertTriangle : Icon.check} {toast.msg}
          </div>
        )}

        <div className="resp-grid-2" style={{ gap: 24, marginBottom: 28 }}>
          {/* Profile Card */}
          <Card className="student-admin-card" style={{ display: "flex", flexDirection: "column", gap: 22, position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                {/* Avatar with click-to-upload option */}
                <div style={{ position: "relative", width: 76, height: 76, borderRadius: "50%", overflow: "hidden", cursor: "pointer", border: `2px solid ${studentAccent}` }} onClick={() => document.getElementById("avatar-upload-input").click()}>
                  {currentAvatar ? (
                    <img src={currentAvatar} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: studentAccentLight, display: "flex", alignItems: "center", justifyContent: "center", color: studentAccent, fontSize: 24, fontWeight: 800 }}>
                      {studentInfo.name.split(" ").map(w => w[0]).join("")}
                    </div>
                  )}
                  {/* Photo Overlay */}
                  <div style={{ position: "absolute", inset: 0, background: "rgba(11,25,46,0.5)", display: "flex", alignItems: "center", justifyContent: "center", color: C.white, opacity: 0, transition: "opacity 0.2s" }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                    <span style={{ fontSize: 11, fontWeight: 700 }}>Upload</span>
                  </div>
                </div>
                <input id="avatar-upload-input" type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
                
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: C.navy }}>{studentInfo.name}</h3>
                  <Badge color={studentAccent} bg={studentAccentLight}>{studentInfo.rollNo}</Badge>
                </div>
              </div>
            </div>

            {/* Profile fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, borderTop: `1px solid ${C.grey100}`, paddingTop: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 0" }}>
                <span style={{ color: C.grey500 }}>Roll / Registration No.</span>
                <span style={{ color: C.navy, fontWeight: 700 }}>{studentInfo.rollNo}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 0" }}>
                <span style={{ color: C.grey500 }}>Email Address</span>
                <span style={{ color: C.navy, fontWeight: 700 }}>{studentInfo.email}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 0" }}>
                <span style={{ color: C.grey500 }}>Degree Program</span>
                <span style={{ color: C.navy, fontWeight: 700 }}>{studentInfo.degree}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 0" }}>
                <span style={{ color: C.grey500 }}>Current Semester</span>
                <span style={{ color: C.navy, fontWeight: 700 }}>{studentInfo.semester}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 0" }}>
                <span style={{ color: C.grey500 }}>Batch</span>
                <span style={{ color: C.navy, fontWeight: 700 }}>{studentInfo.batch}</span>
              </div>
            </div>
          </Card>

          {/* Password Update Card */}
          <Card className="student-admin-card">
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800, color: C.navy }}>Change Security Password</h3>
            <Input label="Current Password" type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} />
            <Input label="New Password" type="password" value={newPass} onChange={e => setNewPass(e.target.value)} />
            <Input label="Confirm New Password" type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} />
            <Btn variant="navy" style={{ width: "100%", justifyContent: "center", marginTop: 8, background: "linear-gradient(135deg, #557987 0%, #7899a6 100%)", boxShadow: "0 10px 24px rgba(47,110,139,.18)" }} onClick={handlePasswordUpdate}>Update Password</Btn>
          </Card>
        </div>

        {/* Faculty Announcements */}
        <Card className="student-admin-card">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <div style={{ color: studentAccent, display: "flex" }}>{Icon.bell}</div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.navy }}>Faculty Announcements & Broadcasts</h3>
          </div>

          <div role="group" aria-label="Filter notifications" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {[
              ["all", "All notifications"],
              ["direct", "Direct to me"],
              ["students", "All-student broadcasts"],
              ["department", "Department broadcasts"],
              ["automated", "Automated updates"],
            ].map(([filter, label]) => {
              const selected = notificationFilter === filter;
              return (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setNotificationFilter(filter)}
                  style={{
                    border: `1px solid ${selected ? studentAccent : C.grey200}`,
                    borderRadius: 20,
                    padding: "7px 13px",
                    background: selected ? "linear-gradient(135deg, #557987 0%, #7899a6 100%)" : C.white,
                    color: selected ? C.white : C.grey500,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {visibleNotifications.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0", color: C.grey400, fontSize: 13 }}>
                {notifications.length === 0 ? "No announcements yet." : "No notifications match this filter."}
              </div>
            ) : visibleNotifications.map(n => {
              const isBroadcast = n.source === "broadcast";
              const senderLabel = isBroadcast
                ? `${n.sender_name || "Faculty"} · ${n.scope_label || "Broadcast"}`
                : `SYSTEM · AUTOMATED · ${n.notification_type || "UPDATE"}`;
              return (
                <div key={n.id} style={{ padding: "16px 20px", borderRadius: 10, background: !n.is_read ? "rgba(85,121,135,.06)" : C.grey50, border: `1px solid ${!n.is_read ? "rgba(85,121,135,.22)" : C.grey200}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: isBroadcast ? studentAccent : C.navy, textTransform: "uppercase", letterSpacing: 0.5 }}>{senderLabel}</span>
                      <h4 style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 800, color: C.navy }}>{n.title}</h4>
                    </div>
                    <span style={{ fontSize: 12, color: C.grey400 }}>{new Date(n.created_at).toLocaleDateString()}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: C.grey600, lineHeight: 1.6 }}>{n.message}</p>
                </div>
              );
            })}
          </div>
        </Card>
      </PageWrap>
      </>
    );
  }

  // ── Render Results Page ──
  return (
    <>
    <style>{studentAdminStyles}</style>
    <PageWrap className="student-admin-page" style={{ background: "transparent" }} title="My Courses & Exams" subtitle="Your enrolled courses, upcoming exams, and published exam schedules">
      {schedule.length === 0 ? (
        <Card className="student-admin-card" style={{ textAlign: "center", padding: "56px 24px" }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: C.grey100, display: "flex", alignItems: "center", justifyContent: "center", color: C.grey400, margin: "0 auto 16px" }}>{Icon.clipboard}</div>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800, color: C.navy }}>No Enrolled Courses Found</h3>
          <p style={{ margin: "0 auto", color: C.grey500, fontSize: 14, maxWidth: 340 }}>Your enrolled courses will appear here. Contact your department if this seems incorrect.</p>
        </Card>
      ) : (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: C.navy, margin: "0 0 14px" }}>All Enrolled Courses</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {enrolledCourses.map(course => (
              <Card key={course.course_offering_id} className="student-course-card" style={{ padding: 0, overflow: "hidden", border: `1px solid ${C.grey200}`, transition: "transform .18s ease, box-shadow .18s ease" }}>
                <div style={{ padding: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: studentAccent, fontSize: 11, fontWeight: 800, letterSpacing: .7, textTransform: "uppercase", marginBottom: 6 }}>
                        {course.course_code}
                      </div>
                      <h3 style={{ color: C.navy, fontSize: 15, lineHeight: 1.4, margin: 0 }}>{course.course_title}</h3>
                    </div>
                    <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, background: studentAccentLight, color: studentAccent, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {Icon.clipboard}
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, borderTop: `1px solid ${C.grey100}`, marginTop: 16, paddingTop: 13 }}>
                    <span style={{ fontSize: 12, color: C.grey500 }}>Instructor</span>
                    <strong style={{ fontSize: 12, color: C.navy, textAlign: "right" }}>{course.teacher_name}</strong>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <Badge color={studentAccent} bg={studentAccentLight}>{course.section_name}</Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: C.navy, margin: "0 0 14px" }}>Upcoming Exams</h2>
        {renderExamSection(upcomingExams, "No upcoming scheduled exams.")}
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: C.navy, margin: "0 0 14px" }}>Exams Awaiting Schedule</h2>
        {renderExamSection(awaitingScheduleExams, "No exams are currently awaiting a schedule.", false)}
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: C.navy, margin: "0 0 14px" }}>Past Exams</h2>
        {renderExamSection(pastExams, "No past exams.")}
      </section>
      <div style={{ height: 48 }} />
    </PageWrap>
    </>
  );
}
