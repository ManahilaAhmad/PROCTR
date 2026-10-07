import { useState, useEffect, useCallback } from "react";
import { C } from "../theme/colors";
import { Icon } from "../theme/icons";
import PageWrap from "../components/common/PageWrap";
import Card from "../components/common/Card";
import Btn from "../components/common/Btn";
import Table from "../components/common/Table";
import StatCard from "../components/common/StatCard";
import Badge from "../components/common/Badge";
import { API_BASE_URL } from "../config/apiConfig";
import { openTrustedFile } from "../utils/safeUrl";

function directorStatusBadge(status) {
  const colors = {
    Published: ["#557987", "#e5f0f4"],
    Confirmed: ["#557987", "#e5f0f4"],
    Available: ["#557987", "#e5f0f4"],
    InUse: ["#1a2b4b", "#e8eaed"],
    "In Use": ["#1a2b4b", "#e8eaed"],
    Maintenance: ["#526b77", "#e9eff2"],
  };
  const [color, background] = colors[status] || ["#6b7f89", "#f0f3f5"];
  return <Badge color={color} bg={background}>{status || "Unknown"}</Badge>;
}

const directorStyles = `
  .director-workspace {
    background: transparent !important;
    isolation: isolate;
    position: relative;
    min-width: 0;
  }
  .director-workspace::before {
    content: '';
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background:
      radial-gradient(circle at 14% 16%, rgba(255,255,255,.92), transparent 30%),
      radial-gradient(circle at 84% 12%, rgba(85,121,135,.16), transparent 25%),
      linear-gradient(90deg, #fff 0%, #fff 42%, #eef7fa 60%, #c3d8e4 100%);
  }
  .director-workspace .resp-page-padding {
    width: 100%;
    max-width: 1440px;
    margin: 0 auto;
    padding: 36px 40px 48px;
    box-sizing: border-box;
  }
  .director-workspace h1,
  .director-workspace h2,
  .director-workspace h3 {
    color: #557987 !important;
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif !important;
  }
  .director-workspace .proctr-card {
    background: linear-gradient(145deg, rgba(255,255,255,.82), rgba(255,255,255,.62)) !important;
    border: 1px solid rgba(255,255,255,.9) !important;
    box-shadow: 0 18px 44px rgba(41,91,117,.12), inset 0 1px 0 rgba(255,255,255,.96) !important;
    backdrop-filter: blur(18px) saturate(130%);
    -webkit-backdrop-filter: blur(18px) saturate(130%);
  }
  .director-workspace .stat-card .proctr-card {
    min-height: 104px;
    transition: transform .18s ease, box-shadow .18s ease;
  }
  .director-workspace .stat-card:hover .proctr-card {
    transform: translateY(-2px);
    box-shadow: 0 22px 48px rgba(41,91,117,.17), inset 0 1px 0 rgba(255,255,255,.96) !important;
  }
  .director-workspace table thead tr {
    background: rgba(85,121,135,.08) !important;
    border-bottom-color: rgba(85,121,135,.16) !important;
  }
  .director-workspace table th {
    color: #557987 !important;
    letter-spacing: .7px !important;
  }
  .director-workspace table tbody tr:hover {
    background: rgba(85,121,135,.045);
  }
  .director-workspace .proctr-btn-primary {
    background: linear-gradient(135deg, #557987 0%, #7899a6 100%) !important;
    color: #fff !important;
    box-shadow: 0 6px 14px rgba(85,121,135,.2);
  }
  .director-workspace .proctr-btn-primary:hover {
    filter: brightness(.96);
  }
  .director-workspace .director-section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding: 18px 22px;
    border-bottom: 1px solid rgba(85,121,135,.13);
  }
  .director-workspace .director-filter {
    min-height: 40px;
    padding: 8px 12px;
    border: 1px solid rgba(85,121,135,.2);
    border-radius: 10px;
    background: rgba(255,255,255,.75);
    color: #1a2b4b;
    font: inherit;
    outline: none;
  }
  .director-workspace .director-filter:focus {
    border-color: #7899a6;
    box-shadow: 0 0 0 3px rgba(85,121,135,.12);
  }
  @media (max-width: 768px) {
    .director-workspace .resp-page-padding { padding: 20px 16px 32px; }
  }
`;

export default function DirectorPage({ activePage }) {
  const tab = activePage === "dir-papers" ? "papers" : activePage === "dir-labs" ? "labs" : "timetable";
  const sectionKey = (row) => `${row.program_id ?? ""}|${row.batch_id ?? ""}|${row.section_id ?? row.section_name ?? ""}`;

  const [schedule, setSchedule] = useState([]);
  const [labs, setLabs] = useState([]);
  const [sectionFilter, setSectionFilter] = useState("All");
  const [sharedPapers, setSharedPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState([]);

  const fetchData = useCallback(async () => {
    const requests = [
      ["timetable", `${API_BASE_URL}/schedule`, "schedule", setSchedule],
      ["labs", `${API_BASE_URL}/labs`, "labs", setLabs],
      ["question papers", `${API_BASE_URL}/director/papers`, "papers", setSharedPapers],
    ];
    const results = await Promise.allSettled(requests.map(async ([name, url, key, setter]) => {
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok || data.status !== "success" || !Array.isArray(data[key])) {
        throw new Error(data.message || `Failed to load ${name}.`);
      }
      setter(data[key]);
      return name;
    }));
    const errors = results.flatMap((result, index) => {
      if (result.status === "fulfilled") return [];
      console.error(`Director ${requests[index][0]} request failed:`, result.reason);
      return [result.reason instanceof Error ? result.reason.message : `Failed to load ${requests[index][0]}.`];
    });
    setLoadErrors(errors);
    setLoading(false);
  }, []);

  useEffect(() => { Promise.resolve().then(fetchData); }, [fetchData]);

  const sectionOptions = [...new Map(schedule
    .filter(s => s.section_name)
    .map(s => [sectionKey(s), {
      key: sectionKey(s),
      label: [s.program_code, s.batch_name, `Section ${s.section_name}`].filter(Boolean).join(" · "),
    }])).values()].sort((a, b) => a.label.localeCompare(b.label));

  const title = tab === "papers" ? "Question Papers" : tab === "labs" ? "Labs & Networks" : "Examination Timetable";
  const subtitle = tab === "papers"
    ? "Review question papers shared by teachers after HOD approval"
    : tab === "labs" ? "View computer lab capacity, availability, and network details"
      : "View scheduled exams across all departments, programs, batches, and sections";

  return (
    <PageWrap className="director-workspace" title={title} subtitle={subtitle}>
      <style>{directorStyles}</style>
      {loadErrors.length > 0 && (
        <div role="alert" style={{ marginBottom: 18, padding: "13px 16px", borderRadius: 10, background: "#e5f0f4", color: "#385966", fontSize: 13, fontWeight: 600 }}>
          {loadErrors.join(" ")} Reload the page to try again.
        </div>
      )}

      {/* ── QUESTION PAPERS ──────────────────────────────────────── */}
      {tab === "papers" && (
        <>
          <div className="resp-grid-3" style={{ marginBottom: 24 }}>
            <StatCard label="Shared Papers" value={sharedPapers.length} icon={Icon.fileText} accent="#557987" light="#e5f0f4" />
            <StatCard label="HOD Approved" value={sharedPapers.filter(p => p.status === "Approved").length} icon={Icon.check} accent="#557987" light="#e5f0f4" />
            <StatCard label="Departments" value={[...new Set(sharedPapers.map(p => p.department_code).filter(Boolean))].length} icon={Icon.building} accent="#557987" light="#e5f0f4" />
          </div>

          <Card style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
            <div className="director-section-heading">
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.navy }}>Papers shared for examination</div>
                <div style={{ marginTop: 4, color: C.grey500, fontSize: 12 }}>Only papers shared after HOD review appear here.</div>
              </div>
              <Badge color="#557987" bg="#e5f0f4">{sharedPapers.length} {sharedPapers.length === 1 ? "paper" : "papers"}</Badge>
            </div>
            {sharedPapers.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", color: C.grey400, fontSize: 14 }}>
                {loading ? "Loading shared question papers…" : "No exam papers have been shared by teachers yet."}
              </div>
            ) : (
              <Table
                columns={["Course & Program / Section", "Department", "Exam Type", "Teacher", "HOD Approved On", "Shared On", "Action"]}
                rows={sharedPapers.map((p) => [
                  <div key={p.exam_id}>
                    <span style={{ fontWeight: 800, color: C.navy, display: "block" }}>{p.course_code} — {[p.program_code, p.batch_name, p.section_name ? `Section ${p.section_name}` : null].filter(Boolean).join(" · ")}</span>
                    <span style={{ fontSize: 12, color: C.grey500 }}>{p.course_title}{p.program_name ? ` · ${p.program_name}` : ""}</span>
                  </div>,
                  <Badge key={p.exam_id + "dept"} color={C.navy} bg={C.grey100}>{p.department_code || "—"}</Badge>,
                  <Badge key={p.exam_id + "type"} color="#557987" bg="#e5f0f4">{p.exam_type}</Badge>,
                  <span key={p.exam_id + "teacher"} style={{ fontWeight: 600, color: C.navy }}>{p.teacher_name}</span>,
                  p.approved_at ? new Date(p.approved_at).toLocaleDateString() : "—",
                  p.shared_with_dec_at ? new Date(p.shared_with_dec_at).toLocaleDateString() : "—",
                  p.exam_paper_url ? (
                    <Btn key={p.exam_id + "btn"} variant="primary" size="sm" onClick={() => openTrustedFile(p.exam_paper_url)}>
                      View Paper
                    </Btn>
                  ) : (
                    <span key={p.exam_id + "nofile"} style={{ fontSize: 12, color: C.grey400 }}>No File</span>
                  )
                ])}
              />
            )}
          </Card>
          <div style={{ height: 48 }} />
        </>
      )}

      {/* ── TIMETABLE ────────────────────────────────────────────── */}
      {tab === "timetable" && <>
        <div className="resp-grid-3" style={{ marginBottom: 24 }}>
          <StatCard label="Scheduled Exams" value={schedule.filter(r => sectionFilter === "All" || sectionKey(r) === sectionFilter).length} icon={Icon.calendar} accent="#557987" light="#e5f0f4" />
          <StatCard label="Published" value={schedule.filter(r => (sectionFilter === "All" || sectionKey(r) === sectionFilter) && r.status === "Published").length} icon={Icon.check} accent="#557987" light="#e5f0f4" />
          <StatCard label="Programs / Sections" value={sectionOptions.length} icon={Icon.users} accent="#557987" light="#e5f0f4" />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16, alignItems: "center" }}>
          <label htmlFor="director-section-filter" style={{ fontSize: 13, fontWeight: 700, color: "#557987" }}>Filter schedule</label>
          <select id="director-section-filter" className="director-filter" value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)}>
            <option value="All">All Sections</option>
            {sectionOptions.map(section => <option key={section.key} value={section.key}>{section.label}</option>)}
          </select>
          <Btn variant="ghost" size="sm" onClick={() => alert("Timetable exported as PDF.")}>Export PDF</Btn>
          <Btn variant="ghost" size="sm" onClick={() => window.print()}>Print</Btn>
        </div>

        <Card style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
          <div className="director-section-heading">
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: C.navy }}>Published examination schedule</div>
              <div style={{ marginTop: 4, color: C.grey500, fontSize: 12 }}>Organized with full program, batch, and section identifiers.</div>
            </div>
            <Badge color="#557987" bg="#e5f0f4">All Departments</Badge>
          </div>
          {schedule.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: C.grey400, fontSize: 13 }}>
              {loading ? "Loading the examination timetable…" : "No exams scheduled yet."}
            </div>
          ) : (
            <Table
              columns={["Course", "Program / Batch / Section", "Date", "Time", "Lab", "Invigilator", "Capacity", "Status"]}
              rows={schedule
                .filter((r) => sectionFilter === "All" || sectionKey(r) === sectionFilter)
                .map((s) => [
                  <span style={{ fontWeight: 700, color: C.navy }}>{s.course_code} {s.exam_type}</span>,
                  <Badge>{[s.program_code, s.batch_name, s.section_name ? `Section ${s.section_name}` : null].filter(Boolean).join(" · ") || "—"}</Badge>,
                  s.exam_date ? new Date(s.exam_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—",
                  s.start_time && s.end_time ? `${s.start_time.substring(0, 5)} - ${s.end_time.substring(0, 5)}` : "—",
                  s.lab_name || "—",
                  s.invigilator_name || <span style={{ color: C.grey500, fontWeight: 600 }}>Unassigned</span>,
                  s.capacity ?? "—",
                  directorStatusBadge(s.status),
                ])} />
          )}
        </Card>

      </>}

      {/* ── LABS ─────────────────────────────────────────────────── */}
      {tab === "labs" && <>
        <div className="resp-grid-3" style={{ marginBottom: 24 }}>
          <StatCard label="Total Labs" value={labs.length} icon={Icon.server} accent="#557987" light="#e5f0f4" />
          <StatCard label="Available Now" value={labs.filter(l => l.status === "Available").length} icon={Icon.check} accent="#557987" light="#e5f0f4" />
          <StatCard label="Usable PC Capacity" value={labs.reduce((s, l) => s + (Number(l.capacity) || 0), 0)} icon={Icon.monitor} accent="#557987" light="#e5f0f4" />
        </div>

        <Card style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
          <div className="director-section-heading">
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: C.navy }}>Lab directory</div>
              <div style={{ marginTop: 4, color: C.grey500, fontSize: 12 }}>Capacity, network range, and current availability.</div>
            </div>
            <Badge color="#557987" bg="#e5f0f4">{labs.length} {labs.length === 1 ? "lab" : "labs"}</Badge>
          </div>
          {labs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: C.grey400, fontSize: 13 }}>
              {loading ? "Loading labs…" : "No labs are available."}
            </div>
          ) : (
            <Table
              columns={["Lab Name", "Total PCs", "Capacity", "Network Range", "Status"]}
              rows={labs.map((lab) => {
                return [
                  <span style={{ fontWeight: 800, color: C.navy }}>{lab.lab_name}</span>,
                  lab.total_pcs,
                  lab.capacity,
                  <span style={{ fontFamily: "monospace", fontSize: 13 }}>{lab.network_range}</span>,
                  directorStatusBadge(lab.status),
                ];
              })} />
          )}
        </Card>

        <div className="resp-grid-2">
          <Card>
            <h3 style={{ margin: "0 0 18px", fontWeight: 800, fontSize: 15 }}>Capacity Utilization</h3>
            {labs.map((lab) => {
              const pct = lab.total_pcs ? Math.round((lab.capacity / lab.total_pcs) * 100) : 0;
              return (
                <div key={lab.lab_id} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: C.grey800, marginBottom: 5 }}>
                    <span>{lab.lab_name}</span><span style={{ color: C.grey500 }}>{lab.capacity}/{lab.total_pcs} PCs usable</span>
                  </div>
                  <div style={{ height: 8, background: C.grey100, borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #557987, #8eafb9)", borderRadius: 99, transition: "width .3s ease" }} />
                  </div>
                </div>
              );
            })}
          </Card>
          <Card>
            <h3 style={{ margin: "0 0 18px", fontWeight: 800, fontSize: 15 }}>Network IP Ranges</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {labs.map((lab) => (
                <div key={lab.lab_id} style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", background: C.grey50, borderRadius: 8, border: `1px solid ${C.grey200}` }}>
                  <span style={{ fontWeight: 700, color: C.navy, fontSize: 14 }}>{lab.lab_name}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 13, color: C.grey600 }}>{lab.network_range || "—"}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div style={{ height: 48 }} />
      </>}

    </PageWrap>
  );
}
