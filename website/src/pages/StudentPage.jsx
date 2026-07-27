import { useState } from "react";
import { C } from "../theme/colors";
import { Icon } from "../theme/icons";
import PageWrap from "../components/common/PageWrap";
import Card from "../components/common/Card";
import Btn from "../components/common/Btn";
import Input from "../components/common/Input";
import Badge from "../components/common/Badge";
import StatCard from "../components/common/StatCard";

import { useEffect } from "react";

export default function StudentPage({ activePage, user }) {
  const [selectedExam, setSelectedExam] = useState(null);

  // Profile states
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [toast, setToast] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [schedule, setSchedule] = useState([]);

  useEffect(() => {
    fetch("http://localhost:5000/api/notifications")
      .then(res => res.json())
      .then(data => { if (data.status === "success") setNotifications(data.notifications); });

    if (user?.userId) {
      fetch(`http://localhost:5000/api/student/${user.userId}/schedule`)
        .then(res => res.json())
        .then(data => { if (data.status === "success") setSchedule(data.schedule); });
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

  const pastExams = [];

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
    fetch("http://localhost:5000/api/auth/change-password", {
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

    fetch("http://localhost:5000/api/auth/profile-picture", {
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

  function gradeColor(g) {
    if (g === "A+" || g === "A") return [C.navy, C.tealLight];
    if (g === "B") return [C.teal, C.tealLight];
    return [C.grey500, C.grey100];
  }

  const avg = Math.round(pastExams.reduce((s, e) => s + e.score, 0) / pastExams.length);

  // ── Render Dashboard Page ──
  if (activePage === "student") {
    return (
      <PageWrap title="Student Dashboard" subtitle="Manage your profile, update credentials, and check announcements">
        {toast && (
          <div style={{ position: "fixed", top: 24, right: 24, zIndex: 300, background: toast.type === "warn" ? C.amber : C.navy, color: C.white, padding: "13px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,.2)", display: "flex", alignItems: "center", gap: 10 }}>
            {toast.type === "warn" ? Icon.alertTriangle : Icon.check} {toast.msg}
          </div>
        )}

        <div className="resp-grid-2" style={{ gap: 24, marginBottom: 28 }}>
          {/* Profile Card */}
          <Card style={{ display: "flex", flexDirection: "column", gap: 22, position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                {/* Avatar with click-to-upload option */}
                <div style={{ position: "relative", width: 76, height: 76, borderRadius: "50%", overflow: "hidden", cursor: "pointer", border: `2px solid ${C.teal}` }} onClick={() => document.getElementById("avatar-upload-input").click()}>
                  {currentAvatar ? (
                    <img src={currentAvatar} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: C.tealLight, display: "flex", alignItems: "center", justifyContent: "center", color: C.teal, fontSize: 24, fontWeight: 800 }}>
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
                  <Badge>{studentInfo.rollNo}</Badge>
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
          <Card>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800, color: C.navy }}>Change Security Password</h3>
            <Input label="Current Password" type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} />
            <Input label="New Password" type="password" value={newPass} onChange={e => setNewPass(e.target.value)} />
            <Input label="Confirm New Password" type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} />
            <Btn variant="navy" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={handlePasswordUpdate}>Update Password</Btn>
          </Card>
        </div>

        {/* Enrolled Courses quick-view on dashboard */}
        {schedule.length > 0 && (
          <Card style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ color: C.teal, display: "flex" }}>{Icon.calendar}</div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.navy }}>My Lab Courses</h3>
              <Badge color={C.teal} bg={C.tealLight}>{schedule.filter(e => e.exam_date).length} scheduled</Badge>
              {schedule.filter(e => !e.exam_date).length > 0 && (
                <Badge color={C.grey500} bg={C.grey100}>{schedule.filter(e => !e.exam_date).length} not scheduled</Badge>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {schedule.slice(0, 4).map((e, i) => {
                const hasSchedule = !!e.exam_date;
                return (
                  <div key={e.course_offering_id + (e.exam_id || i)} style={{ padding: "12px 16px", borderRadius: 10, background: hasSchedule ? C.tealLight : C.grey50, border: `1px solid ${hasSchedule ? C.tealMid : C.grey200}`, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: C.navy }}>{e.course_code} — {e.course_title}</div>
                      <div style={{ fontSize: 12, color: C.grey500, marginTop: 2 }}>
                        {hasSchedule
                          ? <>📅 {new Date(e.exam_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })} at {e.start_time?.substring(0,5)} · Lab: <strong style={{ color: C.navy }}>{e.lab_name}</strong></>
                          : e.exam_id ? `Exam created (${e.exam_type}) — awaiting schedule` : "No exam created yet"
                        }
                      </div>
                    </div>
                    {hasSchedule
                      ? <Badge color={C.teal} bg="white">Scheduled</Badge>
                      : <Badge color={C.grey500} bg={C.grey100}>Not Scheduled</Badge>
                    }
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Faculty Announcements */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <div style={{ color: C.navy, display: "flex" }}>{Icon.bell}</div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.navy }}>Faculty Announcements & Broadcasts</h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {notifications.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0", color: C.grey400, fontSize: 13 }}>No announcements yet.</div>
            ) : notifications.map(n => {
              const isCritical = n.audience_type === "Critical" || n.audience_type === "Invigilators";
              return (
                <div key={n.announcement_id} style={{ padding: "16px 20px", borderRadius: 10, background: isCritical ? "rgba(225,29,72,.05)" : C.grey50, border: `1px solid ${isCritical ? "#f43f5e33" : C.grey200}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: isCritical ? C.red : C.teal, textTransform: "uppercase", letterSpacing: 0.5 }}>{n.sender_name || "Faculty"}</span>
                      <h4 style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 800, color: C.navy }}>{n.subject}</h4>
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
    );
  }

  // ── Render Results Page ──
  return (
    <PageWrap title="My Exam Schedule" subtitle="Upcoming lab exams assigned to your section">
      <div className="resp-grid-4" style={{ marginBottom: 28 }}>
        <StatCard label="Enrolled Courses"  value={schedule.length}                                                                    icon={Icon.clipboardList} delay={0} />
        <StatCard label="Scheduled"         value={schedule.filter(e => !!e.exam_date).length}                                        icon={Icon.calendar}     delay={80} />
        <StatCard label="Not Scheduled"     value={schedule.filter(e => !e.exam_date).length}                                         icon={Icon.clipboard}    delay={160} />
        <StatCard label="Upcoming"          value={schedule.filter(e => e.exam_date && new Date(e.exam_date) >= new Date()).length}    icon={Icon.trendingUp}   delay={240} />
      </div>

      <h2 style={{ fontSize: 17, fontWeight: 800, color: C.navy, margin: "0 0 18px", letterSpacing: -0.2 }}>My Enrolled Lab Courses</h2>

      {schedule.length === 0 ? (
        <Card style={{ textAlign: "center", padding: "56px 24px" }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: C.grey100, display: "flex", alignItems: "center", justifyContent: "center", color: C.grey400, margin: "0 auto 16px" }}>{Icon.clipboard}</div>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800, color: C.navy }}>No Enrolled Courses Found</h3>
          <p style={{ margin: "0 auto", color: C.grey500, fontSize: 14, maxWidth: 340 }}>Your enrolled courses will appear here. Contact your department if this seems incorrect.</p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {schedule.map((e, i) => {
            const hasSchedule = !!e.exam_date;
            const isPast = hasSchedule && new Date(e.exam_date) < new Date();
            const hasExam = !!e.exam_id;

            // Determine card accent color
            const borderColor = !hasSchedule ? C.grey200 : isPast ? C.grey300 : C.tealMid;
            const iconBg = !hasSchedule ? C.grey100 : isPast ? C.grey100 : C.tealLight;
            const iconColor = !hasSchedule ? C.grey400 : isPast ? C.grey400 : C.teal;

            return (
              <Card key={`${e.course_offering_id}-${e.exam_id || i}`} style={{ border: `1.5px solid ${borderColor}`, animation: `slideInLeft .38s cubic-bezier(.22,.68,0,1.1) ${i * 60}ms both` }}>
                <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>

                  {/* Icon */}
                  <div style={{ width: 50, height: 50, borderRadius: 13, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", color: iconColor, flexShrink: 0 }}>{Icon.clipboard}</div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Course header */}
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.navy }}>{e.course_code}</h3>
                      <span style={{ fontSize: 13, color: C.grey600, fontWeight: 600 }}>{e.course_title}</span>
                      <Badge>{e.section_name}</Badge>
                    </div>

                    {/* Teacher */}
                    <div style={{ fontSize: 12, color: C.grey400, marginBottom: 8 }}>
                      Teacher: <strong style={{ color: C.navy }}>{e.teacher_name}</strong>
                    </div>

                    {/* Exam & Schedule Info */}
                    {!hasExam ? (
                      <div style={{ fontSize: 13, color: C.grey400, fontStyle: "italic" }}>No exam created for this course yet.</div>
                    ) : !hasSchedule ? (
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <Badge color={C.amber} bg="#fffbeb">{e.exam_type}</Badge>
                        <span style={{ fontSize: 12, color: C.grey500 }}>Exam created</span>
                        {e.proposed_date && (
                          <span style={{ fontSize: 12, color: C.grey500 }}>· Proposed Date: <strong style={{ color: C.navy }}>{new Date(e.proposed_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</strong></span>
                        )}
                        <Badge color={C.grey500} bg={C.grey100}>Awaiting Schedule</Badge>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          <Badge color={isPast ? C.grey500 : C.teal} bg={isPast ? C.grey100 : C.tealLight}>
                            {isPast ? "Completed" : "Upcoming"}
                          </Badge>
                          <Badge color={C.navy} bg={C.grey50}>{e.exam_type}</Badge>
                        </div>
                        <div style={{ display: "flex", gap: 18, rowGap: 4, fontSize: 13, color: C.grey500, flexWrap: "wrap", marginTop: 4 }}>
                          <span>📅 {new Date(e.exam_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
                          <span>🕐 {e.start_time?.substring(0,5)} – {e.end_time?.substring(0,5)}</span>
                          <span>🏛 Lab: <strong style={{ color: C.navy }}>{e.lab_name}</strong></span>
                          {e.duration && <span>⏱ {e.duration} min</span>}
                          {e.total_marks && <span>📊 Total Marks: <strong style={{ color: C.navy }}>{e.total_marks}</strong></span>}
                        </div>
                        <div style={{ fontSize: 12, color: C.grey400, marginTop: 2 }}>
                          Invigilator: <strong style={{ color: C.navy }}>{e.invigilator_name || "Not yet assigned"}</strong>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* View Paper Button */}
                  {e.exam_paper_url && (
                    <Btn variant="ghost" size="sm" onClick={() => window.open(`http://localhost:5000${e.exam_paper_url}`, "_blank")}>View Paper</Btn>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <div style={{ height: 48 }} />
    </PageWrap>
  );
}
