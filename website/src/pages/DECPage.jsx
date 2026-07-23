import { useState, useEffect } from "react";
import { C } from "../theme/colors";
import { Icon } from "../theme/icons";
import PageWrap from "../components/common/PageWrap";
import Tabs from "../components/common/Tabs";
import Card from "../components/common/Card";
import Btn from "../components/common/Btn";
import Table from "../components/common/Table";
import StatCard from "../components/common/StatCard";
import Badge from "../components/common/Badge";
import statusBadge from "../components/common/statusBadge";
import Select from "../components/common/Select";

// ── Main Component ───────────────────────────────────────────────────
export default function DECPage({ activePage, setPage, user }) {
  const tabMap = {
    dec: "overview",
    "dec-exams": "exams",
    "dec-invigilators": "invigilators",
    "dec-swaps": "swaps",
  };
  const [activeTab, setActiveTab] = useState(tabMap[activePage] || "overview");

  useEffect(() => {
    setActiveTab(tabMap[activePage] || "overview");
  }, [activePage]);

  const [assignments, setAssignments] = useState([]);
  const [swapRequests, setSwapRequests] = useState([]);
  const [teachersPool, setTeachersPool] = useState([]);

  const fetchData = () => {
    fetch("http://localhost:5000/api/schedule")
      .then(res => res.json())
      .then(data => { if (data.status === "success" && Array.isArray(data.schedule)) setAssignments(data.schedule); })
      .catch(() => {});

    fetch("http://localhost:5000/api/swap-requests/dec")
      .then(res => res.json())
      .then(data => { if (data.status === "success" && Array.isArray(data.requests)) setSwapRequests(data.requests); })
      .catch(() => {});

    fetch("http://localhost:5000/api/teachers")
      .then(res => res.json())
      .then(data => { if (data.status === "success" && Array.isArray(data.teachers)) setTeachersPool(data.teachers); })
      .catch(() => {});
  };

  useEffect(() => {
    fetchData();
  }, []);

  // assign modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const [selectedInvigilator, setSelectedInvigilator] = useState("");

  // swap detail modal
  const [showSwapDetail, setShowSwapDetail] = useState(false);
  const [swapTarget, setSwapTarget] = useState(null);

  // toast
  const [toast, setToast] = useState(null);

  function showToast(msg, color = C.teal) {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Assign invigilator ──────────────────────────────────────────
  function openAssignModal(exam) {
    setAssignTarget(exam);
    // Find matching teacher ID if already assigned
    const matched = teachersPool.find(t => t.name === exam.invigilator_name);
    setSelectedInvigilator(matched ? matched.id : "");
    setShowAssignModal(true);
  }

  function confirmAssign() {
    if (!selectedInvigilator) return;
    fetch("http://localhost:5000/api/invigilator/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schedule_id: assignTarget?.schedule_id,
        teacher_id: parseInt(selectedInvigilator),
        user_id: user?.userId || 1,
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === "success") {
          setShowAssignModal(false);
          const matched = teachersPool.find(t => t.id === parseInt(selectedInvigilator));
          showToast(`Invigilator assigned: ${matched ? matched.name : "Teacher"}`);
          fetchData();
        } else {
          alert(data.message || "Failed to assign invigilator.");
        }
      })
      .catch(err => alert("Connection error to assignment api."));
  }

  // Helper badge
  function swapStatusBadge(status) {
    if (status === "Approved")
      return <Badge color={C.green} bg={C.greenLight}>Approved</Badge>;
    if (status === "Rejected")
      return <Badge color={C.red} bg={C.redLight}>Rejected</Badge>;
    return <Badge color={C.amber} bg={C.amberLight}>Pending</Badge>;
  }

  // ── Approve / Reject swap ───────────────────────────────────────
  function openSwapDetail(req) {
    setSwapTarget(req);
    setShowSwapDetail(true);
  }

  function handleSwapDecision(decision) {
    fetch("http://localhost:5000/api/swap-requests/dec/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: swapTarget?.request_id,
        user_id: user?.userId || 1,
        status: decision, // Approved / Rejected
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === "success") {
          if (decision === "Approved") {
            showToast(`Swap approved — ${swapTarget?.replacement_name || "replacement"} assigned`, C.green);
          } else {
            showToast("Swap request rejected", C.red);
          }
          setShowSwapDetail(false);
          fetchData();
        } else {
          alert(data.message || "Failed to submit decision.");
        }
      })
      .catch(err => alert("Connection error to swap review api."));
  }

  // ── Derived stats ───────────────────────────────────────────────
  const safeAssignments  = (Array.isArray(assignments) ? assignments : []).filter(Boolean);
  const safeSwapRequests = (Array.isArray(swapRequests) ? swapRequests : []).filter(Boolean);
  const safeTeachersPool = (Array.isArray(teachersPool) ? teachersPool : []).filter(Boolean);

  const totalExams   = safeAssignments.length;
  const assigned     = safeAssignments.filter((a) => a?.invigilator_name && a?.invigilator_name !== "Unassigned").length;
  const unassigned   = totalExams - assigned;
  const pendingSwaps = safeSwapRequests.filter((r) => r?.dec_status === "Pending").length;
  const coveragePct  = totalExams ? Math.round((assigned / totalExams) * 100) : 0;

  const tabs = [
    { id: "overview",     label: "Overview" },
    { id: "exams",        label: "Scheduled Exams" },
    { id: "invigilators", label: "Assigned Invigilators" },
    {
      id: "swaps",
      label: `Swap Requests${pendingSwaps ? ` (${pendingSwaps})` : ""}`,
    },
  ];

  return (
    <PageWrap
      title="Departmental Exam Committee"
      subtitle="Manage lab exam invigilation, assignments, and swap approvals"
    >
      {/* ── Toast ── */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            zIndex: 9999,
            background: toast.color,
            color: C.white,
            padding: "12px 22px",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 14,
            boxShadow: "0 8px 28px rgba(0,0,0,.18)",
            animation: "fadeUp .3s cubic-bezier(.22,.68,0,1.2) both",
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* ── Assign Invigilator Modal ── */}
      {showAssignModal && assignTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17,29,51,.55)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setShowAssignModal(false)}
        >
          <div
            style={{
              background: C.white,
              borderRadius: 16,
              padding: 40,
              width: 440,
              boxShadow: "0 24px 64px rgba(0,0,0,.18)",
              animation: "popIn .28s cubic-bezier(.22,.68,0,1.3) both",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                margin: "0 0 6px",
                fontSize: 18,
                fontWeight: 800,
                color: C.navy,
              }}
            >
              Assign Invigilator
            </h2>
            <p style={{ margin: "0 0 22px", fontSize: 13, color: C.grey500 }}>
              {assignTarget?.course_code} {assignTarget?.exam_type} — {assignTarget?.exam_date ? new Date(assignTarget.exam_date).toLocaleDateString() : "TBD"} ·{" "}
              {assignTarget?.lab_name || "Unassigned Lab"}
            </p>
            <Select
              label="Select Invigilator"
              value={selectedInvigilator}
              onChange={(e) => setSelectedInvigilator(e.target.value)}
            >
              <option value="">Choose an invigilator…</option>
              {safeTeachersPool.map((inv) => (
                <option key={inv?.id || Math.random()} value={inv?.id}>
                  {inv?.name || "Teacher"} ({inv?.designation || "Faculty"})
                </option>
              ))}
            </Select>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <Btn
                variant="ghost"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => setShowAssignModal(false)}
              >
                Cancel
              </Btn>
              <Btn
                variant="navy"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={confirmAssign}
              >
                Confirm Assignment
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── Swap Detail Modal ── */}
      {showSwapDetail && swapTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17,29,51,.55)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setShowSwapDetail(false)}
        >
          <div
            style={{
              background: C.white,
              borderRadius: 16,
              padding: 40,
              width: 480,
              boxShadow: "0 24px 64px rgba(0,0,0,.18)",
              animation: "popIn .28s cubic-bezier(.22,.68,0,1.3) both",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: C.amberLight,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: C.amber,
                }}
              >
                {Icon.bell}
              </div>
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 17,
                    fontWeight: 800,
                    color: C.navy,
                  }}
                >
                  Swap Request
                </h2>
                <p style={{ margin: 0, fontSize: 12, color: C.grey500 }}>
                  {swapTarget?.course_code} · {swapTarget?.exam_type}
                </p>
              </div>
            </div>

            <div
              style={{
                background: C.grey50,
                borderRadius: 10,
                padding: "14px 18px",
                marginBottom: 20,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {[
                ["Date & Time", `${swapTarget?.exam_date ? new Date(swapTarget.exam_date).toLocaleDateString() : "TBD"} at ${(swapTarget?.start_time || "--:--").substring(0, 5)}`],
                ["Lab", swapTarget?.lab_name || "N/A"],
                ["Current Invigilator", swapTarget?.requester_name || "N/A"],
                ["Requested Replacement", swapTarget?.replacement_name || "N/A"],
                ["Reason", swapTarget?.reason || "None"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}
                >
                  <span style={{ color: C.grey500, fontWeight: 600 }}>
                    {label}
                  </span>
                  <span
                    style={{
                      color: C.navy,
                      fontWeight: 700,
                      textAlign: "right",
                      maxWidth: 240,
                    }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {swapTarget?.dec_status !== "Pending" ? (
              <div style={{ textAlign: "center", padding: "10px 0" }}>
                {swapStatusBadge(swapTarget?.dec_status)}
                <p style={{ margin: "12px 0 0", fontSize: 13, color: C.grey500 }}>
                  This request has already been{" "}
                  {(swapTarget?.dec_status || "").toLowerCase()}.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 10 }}>
                <Btn
                  variant="ghost"
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    borderColor: C.red,
                    color: C.red,
                  }}
                  onClick={() => handleSwapDecision("Rejected")}
                >
                  ✕ Reject
                </Btn>
                <Btn
                  variant="primary"
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    background: C.green,
                  }}
                  onClick={() => handleSwapDecision("Approved")}
                >
                  ✓ Approve Swap
                </Btn>
              </div>
            )}
          </div>
        </div>
      )}

      <Tabs tabs={tabs} active={activeTab} onChange={(id) => {
        setActiveTab(id);
        if (setPage) {
          const pageMap = {
            overview: "dec",
            exams: "dec-exams",
            invigilators: "dec-invigilators",
            swaps: "dec-swaps"
          };
          setPage(pageMap[id]);
        }
      }} />

      {/* ══════════════════════════════════════════════
          OVERVIEW TAB
      ══════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <>
          <div className="resp-grid-4" style={{ marginBottom: 28 }}>
            <StatCard
              label="Total Lab Exams"
              value={totalExams}
              icon={Icon.calendar}
            />
            <StatCard
              label="Invigilators Assigned"
              value={assigned}
              icon={Icon.userCheck}
              accent={C.green}
              light={C.greenLight}
            />
            <StatCard
              label="Coverage Gap"
              value={unassigned}
              icon={Icon.alertTriangle}
              accent={unassigned > 0 ? C.red : C.green}
              light={unassigned > 0 ? C.redLight : C.greenLight}
            />
            <StatCard
              label="Pending Swaps"
              value={pendingSwaps}
              icon={Icon.bell}
              accent={pendingSwaps > 0 ? C.amber : C.green}
              light={pendingSwaps > 0 ? C.amberLight : C.greenLight}
            />
          </div>

          {/* Coverage bar */}
          <Card style={{ marginBottom: 24 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <h3 style={{ margin: 0, fontWeight: 800, color: C.navy, fontSize: 15 }}>
                Invigilation Coverage
              </h3>
              <span
                style={{
                  fontWeight: 800,
                  fontSize: 22,
                  color:
                    coveragePct === 100
                      ? C.green
                      : coveragePct >= 60
                      ? C.amber
                      : C.red,
                }}
              >
                {coveragePct}%
              </span>
            </div>
            <div
              style={{
                height: 10,
                background: C.grey100,
                borderRadius: 99,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${coveragePct}%`,
                  background:
                    coveragePct === 100
                      ? C.green
                      : coveragePct >= 60
                      ? C.amber
                      : C.red,
                  borderRadius: 99,
                  transition: "width .6s cubic-bezier(.22,.68,0,1.2)",
                }}
              />
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 13, color: C.grey500 }}>
              {assigned} of {totalExams} exams have an assigned invigilator
              {unassigned > 0 && (
                <span style={{ color: C.red, fontWeight: 700 }}>
                  {" "}
                  — {unassigned} exam{unassigned > 1 ? "s" : ""} still need
                  {unassigned === 1 ? "s" : ""} assignment
                </span>
              )}
            </p>
          </Card>

          {pendingSwaps > 0 && (
            <Card
              style={{
                marginBottom: 24,
                border: `1.5px solid ${C.amberLight}`,
                background: "#fffef7",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <span style={{ color: C.amber }}>{Icon.bell}</span>
                <h3
                  style={{ margin: 0, fontWeight: 800, color: C.navy, fontSize: 15 }}
                >
                  Pending Swap Requests
                </h3>
                <Badge color={C.amber} bg={C.amberLight}>
                  {pendingSwaps} pending
                </Badge>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {safeSwapRequests
                  .filter((r) => r?.dec_status === "Pending")
                  .map((req) => (
                    <div
                      key={req?.request_id || Math.random()}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 16px",
                        background: C.amberLight,
                        borderRadius: 9,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: C.navy,
                          }}
                        >
                          {req?.course_code} {req?.exam_type}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: C.grey500,
                            marginTop: 2,
                          }}
                        >
                          {req?.requester_name || "Teacher"} → {req?.replacement_name || "Teacher"} ·{" "}
                          {req?.exam_date ? new Date(req.exam_date).toLocaleDateString() : "TBD"}
                        </div>
                      </div>
                      <Btn
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setActiveTab("swaps");
                          openSwapDetail(req);
                        }}
                      >
                        Review
                      </Btn>
                    </div>
                  ))}
              </div>
            </Card>
          )}

          {/* Invigilator pool from DB */}
          <Card>
            <h3
              style={{ margin: "0 0 16px", fontWeight: 800, color: C.navy, fontSize: 15 }}
            >
              Invigilator Pool
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {safeTeachersPool.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: C.grey400, fontSize: 13 }}>No teachers loaded.</div>
              ) : safeTeachersPool.map((inv) => (
                <div
                  key={inv?.id || Math.random()}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "11px 14px",
                    background: C.grey50,
                    borderRadius: 8,
                    border: `1px solid ${C.grey200}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: C.teal,
                        color: C.white,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: 12,
                        flexShrink: 0,
                      }}
                    >
                      {(inv?.name || "Teacher")
                        .split(" ")
                        .map((w) => w[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <div>
                      <div
                        style={{ fontWeight: 700, fontSize: 14, color: C.navy }}
                      >
                        {inv?.name}
                      </div>
                      <div style={{ fontSize: 11, color: C.grey500 }}>
                        {inv?.designation}
                      </div>
                    </div>
                  </div>
                  <Badge color={C.teal} bg={C.tealLight}>Available</Badge>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* ══════════════════════════════════════════════
          SCHEDULED EXAMS TAB
      ══════════════════════════════════════════════ */}
      {activeTab === "exams" && (
        <>
          <div className="resp-grid-3" style={{ marginBottom: 28 }}>
            <StatCard
              label="Total Exams"
              value={totalExams}
              icon={Icon.calendar}
            />
            <StatCard
              label="Confirmed"
              value={assignments.filter((a) => a.status === "Confirmed").length}
              icon={Icon.check}
              accent={C.green}
              light={C.greenLight}
            />
            <StatCard
              label="Pending / Draft"
              value={assignments.filter((a) => a.status !== "Confirmed").length}
              icon={Icon.bell}
              accent={C.amber}
              light={C.amberLight}
            />
          </div>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div
              style={{
                padding: "18px 22px",
                borderBottom: `1px solid ${C.grey100}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>
                Lab Exam Schedule
              </span>
              <Badge>Spring 2026</Badge>
            </div>
            <Table
              columns={["Exam", "Section", "Date", "Time", "Lab", "Lab Capacity", "Status"]}
              rows={safeAssignments.map((s) => [
                <span style={{ fontWeight: 700, color: C.navy }}>{s?.course_code} {s?.exam_type}</span>,
                <Badge>{s?.section_name}</Badge>,
                s?.exam_date ? new Date(s.exam_date).toLocaleDateString() : "TBD",
                `${(s?.start_time || "--:--").substring(0, 5)} - ${(s?.end_time || "--:--").substring(0, 5)}`,
                s?.lab_name || "N/A",
                s?.capacity || 0,
                statusBadge(s?.status),
              ])}
            />
          </Card>
        </>
      )}

      {/* ══════════════════════════════════════════════
          ASSIGNED INVIGILATORS TAB
      ══════════════════════════════════════════════ */}
      {activeTab === "invigilators" && (
        <>
          <div className="resp-grid-3" style={{ marginBottom: 28 }}>
            <StatCard
              label="Total Exams"
              value={totalExams}
              icon={Icon.calendar}
            />
            <StatCard
              label="Assigned"
              value={assigned}
              icon={Icon.userCheck}
              accent={C.green}
              light={C.greenLight}
            />
            <StatCard
              label="Unassigned"
              value={unassigned}
              icon={Icon.alertTriangle}
              accent={unassigned > 0 ? C.red : C.green}
              light={unassigned > 0 ? C.redLight : C.greenLight}
            />
          </div>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div
              style={{
                padding: "18px 22px",
                borderBottom: `1px solid ${C.grey100}`,
                fontWeight: 700,
                fontSize: 15,
                color: C.navy,
              }}
            >
              Invigilation Assignments
            </div>
            <Table
              columns={["Exam", "Section", "Date", "Time", "Lab", "Invigilator", "Assignment Status", "Action"]}
              rows={safeAssignments.map((a) => [
                <span style={{ fontWeight: 700, color: C.navy }}>{a?.course_code} {a?.exam_type}</span>,
                <Badge>{a?.section_name}</Badge>,
                a?.exam_date ? new Date(a.exam_date).toLocaleDateString() : "TBD",
                `${(a?.start_time || "--:--").substring(0, 5)} - ${(a?.end_time || "--:--").substring(0, 5)}`,
                a?.lab_name || "N/A",
                a?.invigilator_name && a?.invigilator_name !== "Unassigned" ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: C.teal,
                        color: C.white,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: 10,
                        flexShrink: 0,
                      }}
                    >
                      {(a?.invigilator_name || "")
                        .split(" ")
                        .map((w) => w[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <span style={{ fontWeight: 600, color: C.navy, fontSize: 13 }}>
                      {a?.invigilator_name}
                    </span>
                  </span>
                ) : (
                  <span style={{ color: C.red, fontWeight: 700 }}>⚠ Unassigned</span>
                ),
                <span
                  style={{ fontSize: 12, color: C.grey500, fontStyle: "italic" }}
                >
                  {a?.assignment_status || "None"}
                </span>,
                <Btn variant="ghost" size="sm" onClick={() => openAssignModal(a)}>
                  {a?.invigilator_name && a?.invigilator_name !== "Unassigned" ? "Reassign" : "Assign"}
                </Btn>,
              ])}
            />
          </Card>
        </>
      )}

      {/* ══════════════════════════════════════════════
          SWAP REQUESTS TAB
      ══════════════════════════════════════════════ */}
      {activeTab === "swaps" && (
        <>
          <div className="resp-grid-3" style={{ marginBottom: 28 }}>
            <StatCard
              label="Total Requests"
              value={swapRequests.length}
              icon={Icon.bell}
            />
            <StatCard
              label="Pending"
              value={pendingSwaps}
              icon={Icon.alertTriangle}
              accent={pendingSwaps > 0 ? C.amber : C.green}
              light={pendingSwaps > 0 ? C.amberLight : C.greenLight}
            />
            <StatCard
              label="Resolved"
              value={swapRequests.filter((r) => r.dec_status !== "Pending").length}
              icon={Icon.checkCircle}
              accent={C.green}
              light={C.greenLight}
            />
          </div>

          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div
              style={{
                padding: "18px 22px",
                borderBottom: `1px solid ${C.grey100}`,
                fontWeight: 700,
                fontSize: 15,
                color: C.navy,
              }}
            >
               Invigilation Swap Requests
            </div>
            <Table
              columns={["Exam", "Section", "Date", "From", "To", "Reason", "Status", "Action"]}
              rows={safeSwapRequests.map((req) => [
                <span style={{ fontWeight: 700, color: C.navy }}>{req?.exam_type}</span>,
                <Badge>{req?.course_code}</Badge>,
                req?.exam_date ? new Date(req.exam_date).toLocaleDateString() : "TBD",
                <span style={{ fontWeight: 600, color: C.grey800, fontSize: 13 }}>
                  {req?.requester_name || "Teacher"}
                </span>,
                <span style={{ fontWeight: 700, color: C.teal, fontSize: 13 }}>
                  {req?.replacement_name || "Teacher"}
                </span>,
                <span
                  style={{
                    fontSize: 12,
                    color: C.grey500,
                    maxWidth: 130,
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={req?.reason}
                >
                  {req?.reason || "N/A"}
                </span>,
                swapStatusBadge(req?.dec_status),
                <Btn
                  variant="ghost"
                  size="sm"
                  onClick={() => openSwapDetail(req)}
                >
                  {req?.dec_status === "Pending" ? "Review" : "View"}
                </Btn>,
              ])}
            />
          </Card>
        </>
      )}

      <div style={{ height: 48 }} />
    </PageWrap>
  );
}
