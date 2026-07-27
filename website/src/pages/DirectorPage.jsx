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

export default function DirectorPage({ activePage, setPage }) {
  const [tab, setTab] = useState(
    activePage === "dir-timetable" ? "timetable" :
      activePage === "dir-labs" ? "labs" :
        activePage === "dir-results" ? "results" : "overview"
  );

  useEffect(() => {
    setTab(
      activePage === "dir-timetable" ? "timetable" :
        activePage === "dir-labs" ? "labs" :
          activePage === "dir-results" ? "results" : "overview"
    );
  }, [activePage]);

  const [schedule, setSchedule] = useState([]);
  const [labs, setLabs] = useState([]);
  const [sectionFilter, setSectionFilter] = useState("All");
  const [selectedSection, setSelectedSection] = useState(null);

  const [sharedPapers, setSharedPapers] = useState([]);

  useEffect(() => {
    fetch("http://localhost:5000/api/schedule")
      .then(res => res.json())
      .then(data => { if (data.status === "success") setSchedule(data.schedule); });

    fetch("http://localhost:5000/api/labs")
      .then(res => res.json())
      .then(data => { if (data.status === "success") setLabs(data.labs); });

    fetch("http://localhost:5000/api/director/papers")
      .then(res => res.json())
      .then(data => { if (data.status === "success") setSharedPapers(data.papers); });
  }, []);

  // Derive unique sections from schedule
  const allSections = [...new Set(schedule.map(s => s.section_name))].sort();

  // Derive section summary from schedule (for results tab overview)
  const sectionSummary = allSections.map(sec => {
    const rows = schedule.filter(s => s.section_name === sec);
    return {
      section: sec,
      exams: rows.length,
      labs: [...new Set(rows.map(r => r.lab_name))].join(", "),
      capacity: rows.reduce((sum, r) => sum + (Number(r.capacity) || 0), 0),
      confirmed: rows.filter(r => r.status === "Published").length,
    };
  });

  return (
    <PageWrap title="Director Examination" subtitle="System-wide oversight of all exams, labs, timetables, and results">
      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "papers", label: `Question Papers ${sharedPapers.length > 0 ? `(${sharedPapers.length})` : ""}` },
          { id: "timetable", label: "Timetable" },
          { id: "labs", label: "Labs" },
          { id: "results", label: "Section Summary" },
        ]}
        active={tab}
        onChange={(id) => {
          setTab(id);
          if (setPage) {
            const pageMap = {
              overview: "director",
              papers: "dir-papers",
              timetable: "dir-timetable",
              labs: "dir-labs",
              results: "dir-results"
            };
            setPage(pageMap[id]);
          }
        }}
      />

      {/* ── OVERVIEW ─────────────────────────────────────────────── */}
      {tab === "overview" && <>
        <div className="resp-grid-4" style={{ marginBottom: 28 }}>
          <StatCard label="Exams Scheduled"    value={schedule.length}                                                                                                                 icon={Icon.clipboardList} />
          <StatCard label="Total Capacity"     value={schedule.length > 0 ? schedule.reduce((s, e) => s + (Number(e.capacity) || 0), 0) : labs.reduce((s, l) => s + (Number(l.capacity) || 0), 0)} icon={Icon.users} />
          <StatCard label="Published Exams"    value={schedule.filter(e => e.status === "Published").length}                                                                           icon={Icon.check} />
          <StatCard label="Labs in System"     value={labs.length}                                                                                                                     icon={Icon.server} />
        </div>

        <div className="director-overview-grid" style={{ marginBottom: 22 }}>
          <Card>
            <h3 style={{ margin: "0 0 22px", fontWeight: 800, color: C.navy, fontSize: 15 }}>Exam Capacity by Lab</h3>
            {labs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0", color: C.grey400, fontSize: 13 }}>No labs loaded.</div>
            ) : (
              <div style={{ display: "flex", gap: 5, alignItems: "flex-end", height: 120 }}>
                {labs.map((lab) => {
                  const h = Math.round((lab.capacity / Math.max(...labs.map(l => l.capacity))) * 120);
                  return (
                    <div key={lab.lab_id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                      <div style={{ width: "100%", height: Math.max(h, 8), background: `linear-gradient(to top, ${C.teal}, ${C.tealMid})`, borderRadius: "5px 5px 0 0" }} />
                      <span style={{ fontSize: 9, color: C.grey400, textAlign: "center" }}>{lab.lab_name.replace("Computer Lab", "Lab")}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
          <Card>
            <h3 style={{ margin: "0 0 18px", fontWeight: 800, color: C.navy, fontSize: 15 }}>Labs Status</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                ["Available", labs.filter(l => l.status === "Available").length, C.teal, C.tealLight],
                ["In Use", labs.filter(l => l.status === "In Use" || l.status === "InUse").length, C.navy, C.grey200],
                ["Maintenance", labs.filter(l => l.status === "Maintenance").length, C.grey500, C.grey100],
              ].map(([label, count, c, bg]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: bg, borderRadius: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{label}</span>
                  <Badge color={c} bg="transparent">{count} labs</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div style={{ height: 48 }} />
      </>}

      {/* ── QUESTION PAPERS ──────────────────────────────────────── */}
      {tab === "papers" && (
        <>
          <div className="resp-grid-3" style={{ marginBottom: 28 }}>
            <StatCard label="Shared Papers"    value={sharedPapers.length} icon={Icon.fileText} />
            <StatCard label="HOD Approved"     value={sharedPapers.filter(p => p.status === 'Approved').length} icon={Icon.check} />
            <StatCard label="Departments"      value={[...new Set(sharedPapers.map(p => p.department_code).filter(Boolean))].length} icon={Icon.building} />
          </div>

          <Card style={{ padding: 0, overflow: "hidden", marginBottom: 28 }}>
            <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.grey100}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>Exam Papers Shared with Director Examination</span>
              <Badge color={C.teal} bg={C.tealLight}>{sharedPapers.length} papers</Badge>
            </div>
            {sharedPapers.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", color: C.grey400, fontSize: 14 }}>
                No exam papers have been shared by teachers yet.
              </div>
            ) : (
              <Table
                columns={["Course & Section", "Department", "Exam Type", "Teacher", "HOD Approved On", "Shared On", "Action"]}
                rows={sharedPapers.map((p) => [
                  <div key={p.exam_id}>
                    <span style={{ fontWeight: 800, color: C.navy, display: "block" }}>{p.course_code} — {p.section_name}</span>
                    <span style={{ fontSize: 12, color: C.grey500 }}>{p.course_title}</span>
                  </div>,
                  <Badge key={p.exam_id + "dept"} color={C.navy} bg={C.grey100}>{p.department_code || "CS"}</Badge>,
                  <Badge key={p.exam_id + "type"} color={C.teal} bg={C.tealLight}>{p.exam_type}</Badge>,
                  <span key={p.exam_id + "teacher"} style={{ fontWeight: 600, color: C.navy }}>{p.teacher_name}</span>,
                  p.approved_at ? new Date(p.approved_at).toLocaleDateString() : "—",
                  p.shared_with_dec_at ? new Date(p.shared_with_dec_at).toLocaleDateString() : "—",
                  p.exam_paper_url ? (
                    <Btn key={p.exam_id + "btn"} variant="primary" size="sm" onClick={() => window.open(p.exam_paper_url, "_blank")}>
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 20, alignItems: "center" }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: C.grey800 }}>Filter by Section:</label>
          <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)}
            style={{ padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${C.grey200}`, fontSize: 13, color: C.grey800, background: C.white, outline: "none" }}>
            <option value="All">All Sections</option>
            {allSections.map((s) => <option key={s}>{s}</option>)}
          </select>
          <Btn variant="ghost" size="sm" onClick={() => alert("Timetable exported as PDF.")}>Export PDF</Btn>
          <Btn variant="ghost" size="sm" onClick={() => window.print()}>Print</Btn>
        </div>

        <Card style={{ padding: 0, overflow: "hidden", marginBottom: 28 }}>
          <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.grey100}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>Examination Timetable — Spring 2026</span>
            <Badge>All Departments</Badge>
          </div>
          {schedule.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: C.grey400, fontSize: 13 }}>No exams scheduled yet.</div>
          ) : (
            <Table
              columns={["Course", "Section", "Date", "Time", "Lab", "Invigilator", "Capacity", "Status"]}
              rows={schedule
                .filter((r) => sectionFilter === "All" || r.section_name === sectionFilter)
                .map((s) => [
                  <span style={{ fontWeight: 700, color: C.navy }}>{s.course_code} {s.exam_type}</span>,
                  <Badge>{s.section_name}</Badge>,
                  new Date(s.exam_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                  `${s.start_time?.substring(0, 5)} - ${s.end_time?.substring(0, 5)}`,
                  s.lab_name,
                  s.invigilator_name || <span style={{ color: C.grey500, fontWeight: 600 }}>Unassigned</span>,
                  s.capacity,
                  statusBadge(s.status),
                ])} />
          )}
        </Card>

        <div className="resp-grid-3" style={{ marginBottom: 0 }}>
          <StatCard label="Total Scheduled" value={schedule.filter(r => sectionFilter === "All" || r.section_name === sectionFilter).length} icon={Icon.calendar} />
          <StatCard label="Published"       value={schedule.filter(r => (sectionFilter === "All" || r.section_name === sectionFilter) && r.status === "Published").length} icon={Icon.check} />
          <StatCard label="Sections"        value={allSections.length} icon={Icon.users} />
        </div>
        <div style={{ height: 48 }} />
      </>}

      {/* ── LABS ─────────────────────────────────────────────────── */}
      {tab === "labs" && <>
        <div className="resp-grid-3" style={{ marginBottom: 28 }}>
          <StatCard label="Total Labs"      value={labs.length}                                            icon={Icon.server} />
          <StatCard label="Available Now"   value={labs.filter(l => l.status === "Available").length}     icon={Icon.check} accent={C.green} light={C.greenLight} />
          <StatCard label="Total PC Cap."   value={labs.reduce((s, l) => s + (l.capacity || 0), 0)}      icon={Icon.monitor} />
        </div>

        <Card style={{ padding: 0, overflow: "hidden", marginBottom: 28 }}>
          <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.grey100}`, fontWeight: 700, fontSize: 15, color: C.navy }}>Lab Overview</div>
          {labs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: C.grey400, fontSize: 13 }}>No labs loaded.</div>
          ) : (
            <Table
              columns={["Lab Name", "Total PCs", "Capacity", "Network Range", "Status"]}
              rows={labs.map((lab) => {
                const sc = lab.status === "Available" ? [C.teal, C.tealLight] : lab.status === "In Use" || lab.status === "InUse" ? [C.navy, C.grey200] : [C.grey500, C.grey100];
                return [
                  <span style={{ fontWeight: 800, color: C.navy }}>{lab.lab_name}</span>,
                  lab.total_pcs,
                  lab.capacity,
                  <span style={{ fontFamily: "monospace", fontSize: 13 }}>{lab.network_range}</span>,
                  <Badge color={sc[0]} bg={sc[1]}>{lab.status}</Badge>,
                ];
              })} />
          )}
        </Card>

        <div className="resp-grid-2">
          <Card>
            <h3 style={{ margin: "0 0 18px", fontWeight: 800, color: C.navy, fontSize: 15 }}>Capacity Utilization</h3>
            {labs.map((lab) => {
              const pct = lab.total_pcs ? Math.round((lab.capacity / lab.total_pcs) * 100) : 0;
              return (
                <div key={lab.lab_id} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: C.grey800, marginBottom: 5 }}>
                    <span>{lab.lab_name}</span><span style={{ color: C.grey500 }}>{lab.capacity}/{lab.total_pcs} PCs usable</span>
                  </div>
                  <div style={{ height: 7, background: C.grey100, borderRadius: 99 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: lab.status === "Maintenance" ? C.amber : C.teal, borderRadius: 99 }} />
                  </div>
                </div>
              );
            })}
          </Card>
          <Card>
            <h3 style={{ margin: "0 0 18px", fontWeight: 800, color: C.navy, fontSize: 15 }}>Network IP Ranges</h3>
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

      {/* ── SECTION SUMMARY ──────────────────────────────────────── */}
      {tab === "results" && <>
        <div className="resp-grid-4" style={{ marginBottom: 28 }}>
          <StatCard label="Sections"        value={allSections.length}                                    icon={Icon.clipboardList} />
          <StatCard label="Total Exams"     value={schedule.length}                                       icon={Icon.calendar} />
          <StatCard label="Total Capacity"  value={schedule.length > 0 ? schedule.reduce((s, e) => s + (Number(e.capacity) || 0), 0) : labs.reduce((s, l) => s + (Number(l.capacity) || 0), 0)}  icon={Icon.users} />
          <StatCard label="Published"       value={schedule.filter(e => e.status === "Published").length} icon={Icon.check} />
        </div>

        <Card style={{ padding: 0, overflow: "hidden", marginBottom: 28 }}>
          <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.grey100}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>Exam Schedule by Section</span>
            <Btn variant="ghost" size="sm">Export Report</Btn>
          </div>
          {sectionSummary.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: C.grey400, fontSize: 13 }}>No exam data available yet.</div>
          ) : (
            <Table
              columns={["Section", "Exams Scheduled", "Confirmed", "Labs Used", "Total Capacity", "Action"]}
              rows={sectionSummary.map((s) => [
                <span style={{ fontWeight: 800, color: C.navy }}>{s.section}</span>,
                s.exams,
                <Badge color={s.confirmed === s.exams ? C.teal : C.amber} bg={s.confirmed === s.exams ? C.tealLight : C.amberLight}>{s.confirmed}/{s.exams}</Badge>,
                <span style={{ fontSize: 13, color: C.grey600 }}>{s.labs || "—"}</span>,
                s.capacity,
                <Btn variant="ghost" size="sm" onClick={() => setSelectedSection(selectedSection?.section === s.section ? null : s)}>
                  {selectedSection?.section === s.section ? "Close" : "Details"}
                </Btn>,
              ])} />
          )}
        </Card>

        {selectedSection && (
          <Card style={{ marginBottom: 28, borderTop: `4px solid ${C.teal}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <div>
                <h3 style={{ margin: "0 0 3px", fontSize: 16, fontWeight: 800, color: C.navy }}>{selectedSection.section} — Section Detail</h3>
                <span style={{ fontSize: 13, color: C.grey500 }}>{selectedSection.exams} exam(s) scheduled</span>
              </div>
              <button onClick={() => setSelectedSection(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.grey400, display: "flex" }}>{Icon.x}</button>
            </div>
            <div className="resp-grid-3" style={{ gap: 14 }}>
              {[
                ["Total Exams", selectedSection.exams],
                ["Confirmed", selectedSection.confirmed],
                ["Total Capacity", selectedSection.capacity],
                ["Labs Used", selectedSection.labs || "—"],
              ].map(([l, v]) => (
                <div key={l} style={{ padding: "12px 16px", background: C.grey50, borderRadius: 9, border: `1px solid ${C.grey200}` }}>
                  <div style={{ fontSize: 12, color: C.grey500, marginBottom: 3 }}>{l}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>{v}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Section capacity bar chart */}
        <Card>
          <h3 style={{ margin: "0 0 18px", fontWeight: 800, color: C.navy, fontSize: 15 }}>Capacity by Section</h3>
          {sectionSummary.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: C.grey400, fontSize: 13 }}>No data available.</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 110, marginBottom: 10 }}>
                {sectionSummary.map((s) => {
                  const maxCap = Math.max(...sectionSummary.map(x => x.capacity), 1);
                  const h = Math.round((s.capacity / maxCap) * 110);
                  return (
                    <div key={s.section} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.navy }}>{s.capacity}</span>
                      <div style={{ width: "100%", height: Math.max(h, 6), background: `linear-gradient(to top, ${C.navy}, #1e3a5f)`, borderRadius: "5px 5px 0 0" }} />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {sectionSummary.map((s) => (
                  <div key={s.section} style={{ flex: 1, textAlign: "center", fontSize: 11, color: C.grey400, fontWeight: 600 }}>{s.section}</div>
                ))}
              </div>
            </>
          )}
        </Card>
        <div style={{ height: 48 }} />
      </>}
    </PageWrap>
  );
}