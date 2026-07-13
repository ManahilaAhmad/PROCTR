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
import { allSections, timetableData, labsData, sectionResultsData } from "../data/mockData";

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

  const [sectionFilter, setSectionFilter] = useState("All");
  const [selectedSection, setSelectedSection] = useState(null);

  return (
    <PageWrap title="Director Examination" subtitle="System-wide oversight of all exams, labs, timetables, and results">
      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "timetable", label: "Timetable" },
          { id: "labs", label: "Labs" },
          { id: "results", label: "Section Results" },
        ]}
        active={tab}
        onChange={(id) => {
          setTab(id);
          if (setPage) {
            const pageMap = {
              overview: "director",
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
          <StatCard label="Total Exams Scheduled" value={5} icon={Icon.clipboardList} />
          <StatCard label="Students Assessed" value={141} icon={Icon.users} />
          <StatCard label="Average Pass Rate" value="90%" icon={Icon.check} />
          <StatCard label="Labs Active" value={4} icon={Icon.server} />
        </div>

        <div className="director-overview-grid" style={{ marginBottom: 22 }}>
          <Card>
            <h3 style={{ margin: "0 0 22px", fontWeight: 800, color: C.navy, fontSize: 15 }}>Score Distribution — All Sections</h3>
            <div style={{ display: "flex", gap: 5, alignItems: "flex-end", height: 120 }}>
              {[18, 42, 68, 95, 110, 100, 78, 52, 28, 12].map((h, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  <div style={{ width: "100%", height: h, background: `linear-gradient(to top, ${C.teal}, ${C.tealMid})`, borderRadius: "5px 5px 0 0" }} />
                  <span style={{ fontSize: 10, color: C.grey400 }}>{(i + 1) * 10}%</span>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h3 style={{ margin: "0 0 18px", fontWeight: 800, color: C.navy, fontSize: 15 }}>Labs Status</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[["Available", 3, C.teal, C.tealLight], ["In Use", 1, C.navy, C.grey200], ["Maintenance", 1, C.grey500, C.grey100]].map(([label, count, c, bg]) => (
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
            <span style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>Examination Timetable — July 2026</span>
            <Badge>All Departments</Badge>
          </div>
          <Table
            columns={["Exam Title", "Course", "Section", "Date", "Time", "Lab", "Invigilator", "Students", "Status"]}
            rows={timetableData
              .filter((r) => sectionFilter === "All" || r.section === sectionFilter)
              .map((s) => [
                <span style={{ fontWeight: 700, color: C.navy }}>{s.exam}</span>,
                <Badge>{s.course}</Badge>,
                <span style={{ fontWeight: 600, color: C.grey800 }}>{s.section}</span>,
                s.date, s.time,
                s.lab === "TBD" ? <span style={{ color: C.navy, fontWeight: 700 }}>TBD</span> : s.lab,
                s.invigilator === "Unassigned" ? <span style={{ color: C.grey500, fontWeight: 600 }}>Unassigned</span> : s.invigilator,
                s.students,
                statusBadge(s.status),
              ])} />
        </Card>

        <div className="resp-grid-3" style={{ marginBottom: 0 }}>
          <StatCard label="Total Scheduled" value={5} icon={Icon.calendar} />
          <StatCard label="Confirmed" value={3} icon={Icon.check} />
          <StatCard label="Pending / Draft" value={2} icon={Icon.bell} />
        </div>
        <div style={{ height: 48 }} />
      </>}

      {/* ── LABS ─────────────────────────────────────────────────── */}
      {tab === "labs" && <>
        <div className="resp-grid-3" style={{ marginBottom: 28 }}>
          <StatCard label="Total Labs" value={5} icon={Icon.server} />
          <StatCard label="Available Now" value={3} icon={Icon.check} />
          <StatCard label="Total PC Capacity" value={194} icon={Icon.monitor} />
        </div>

        <Card style={{ padding: 0, overflow: "hidden", marginBottom: 28 }}>
          <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.grey100}`, fontWeight: 700, fontSize: 15, color: C.navy }}>Lab Overview</div>
          <Table
            columns={["Lab Name", "PCs", "Capacity", "Network Range", "Current Exam", "Status"]}
            rows={labsData.map((lab) => {
              const statusColor = lab.status === "Available" ? [C.teal, C.tealLight] : lab.status === "In Use" ? [C.navy, C.grey200] : [C.grey500, C.grey100];
              return [
                <span style={{ fontWeight: 800, color: C.navy }}>{lab.name}</span>,
                lab.pcs,
                lab.capacity,
                <span style={{ fontFamily: "monospace", fontSize: 13 }}>{lab.network}</span>,
                lab.exam === "—" ? <span style={{ color: C.grey400 }}>—</span> : <Badge>{lab.exam}</Badge>,
                <Badge color={statusColor[0]} bg={statusColor[1]}>{lab.status}</Badge>,
              ];
            })} />
        </Card>

        <div className="resp-grid-2">
          <Card>
            <h3 style={{ margin: "0 0 18px", fontWeight: 800, color: C.navy, fontSize: 15 }}>Capacity Utilization</h3>
            {labsData.map((lab) => {
              const pct = Math.round((lab.capacity / lab.pcs) * 100);
              return (
                <div key={lab.name} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: C.grey800, marginBottom: 5 }}>
                    <span>{lab.name}</span><span style={{ color: C.grey500 }}>{lab.capacity}/{lab.pcs} PCs usable</span>
                  </div>
                  <div style={{ height: 7, background: C.grey100, borderRadius: 99 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: C.teal, borderRadius: 99 }} />
                  </div>
                </div>
              );
            })}
          </Card>
          <Card>
            <h3 style={{ margin: "0 0 18px", fontWeight: 800, color: C.navy, fontSize: 15 }}>Network IP Ranges</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {labsData.map((lab) => (
                <div key={lab.name} style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", background: C.grey50, borderRadius: 8, border: `1px solid ${C.grey200}` }}>
                  <span style={{ fontWeight: 700, color: C.navy, fontSize: 14 }}>{lab.name}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 13, color: C.grey600 }}>{lab.network}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div style={{ height: 48 }} />
      </>}

      {/* ── SECTION RESULTS ──────────────────────────────────────── */}
      {tab === "results" && <>
        <div className="resp-grid-4" style={{ marginBottom: 28 }}>
          <StatCard label="Sections Assessed" value={5} icon={Icon.clipboardList} />
          <StatCard label="Total Students" value={138} icon={Icon.users} />
          <StatCard label="Overall Avg. Score" value="77%" icon={Icon.chart} />
          <StatCard label="Overall Pass Rate" value="90%" icon={Icon.check} />
        </div>

        <Card style={{ padding: 0, overflow: "hidden", marginBottom: 28 }}>
          <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.grey100}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>Results by Section</span>
            <Btn variant="ghost" size="sm">Export Report</Btn>
          </div>
          <Table
            columns={["Section", "Exam", "Appeared", "Avg. Score", "Highest", "Lowest", "Pass Rate", "Actions"]}
            rows={sectionResultsData.map((s) => [
              <span style={{ fontWeight: 800, color: C.navy }}>{s.section}</span>,
              <span style={{ fontSize: 13, color: C.grey600 }}>{s.exam}</span>,
              `${s.appeared}/${s.students}`,
              <span style={{ fontWeight: 700, color: C.navy }}>{s.avg}%</span>,
              <span style={{ fontWeight: 700, color: C.teal }}>{s.highest}%</span>,
              <span style={{ fontWeight: 700, color: C.grey500 }}>{s.lowest}%</span>,
              <Badge color={C.navy} bg={C.tealLight}>{s.passRate}%</Badge>,
              <Btn variant="ghost" size="sm" onClick={() => setSelectedSection(selectedSection?.section === s.section ? null : s)}>
                {selectedSection?.section === s.section ? "Close" : "Details"}
              </Btn>,
            ])} />
        </Card>

        {selectedSection && (
          <Card style={{ marginBottom: 28, borderTop: `4px solid ${C.teal}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <div>
                <h3 style={{ margin: "0 0 3px", fontSize: 16, fontWeight: 800, color: C.navy }}>{selectedSection.section} — Grade Distribution</h3>
                <span style={{ fontSize: 13, color: C.grey500 }}>{selectedSection.exam}</span>
              </div>
              <button onClick={() => setSelectedSection(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.grey400, display: "flex" }}>{Icon.x}</button>
            </div>
            <div className="resp-grid-4" style={{ marginBottom: 22 }}>
              {[
                { label: "Grade A", count: selectedSection.gradeA },
                { label: "Grade B", count: selectedSection.gradeB },
                { label: "Grade C", count: selectedSection.gradeC },
                { label: "Fail", count: selectedSection.gradeF },
              ].map((g, i) => (
                <div key={g.label} style={{ background: i === 0 ? C.navy : i === 1 ? "#1e3a5f" : i === 2 ? C.tealLight : C.grey100, borderRadius: 10, padding: "16px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: i <= 1 ? C.white : i === 2 ? C.navy : C.grey500 }}>{g.count}</div>
                  <div style={{ fontSize: 12, color: i <= 1 ? "rgba(255,255,255,.6)" : C.grey500, marginTop: 3, fontWeight: 600 }}>{g.label}</div>
                </div>
              ))}
            </div>
            <div className="resp-grid-3" style={{ gap: 14 }}>
              {[["Average Score", `${selectedSection.avg}%`], ["Highest Score", `${selectedSection.highest}%`], ["Lowest Score", `${selectedSection.lowest}%`], ["Pass Rate", `${selectedSection.passRate}%`], ["Students Appeared", `${selectedSection.appeared}/${selectedSection.students}`], ["Absent", `${selectedSection.students - selectedSection.appeared}`]].map(([l, v]) => (
                <div key={l} style={{ padding: "12px 16px", background: C.grey50, borderRadius: 9, border: `1px solid ${C.grey200}` }}>
                  <div style={{ fontSize: 12, color: C.grey500, marginBottom: 3 }}>{l}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>{v}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card>
          <h3 style={{ margin: "0 0 18px", fontWeight: 800, color: C.navy, fontSize: 15 }}>Average Score Comparison</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 110, marginBottom: 10 }}>
            {sectionResultsData.map((s) => {
              const h = Math.round((s.avg / 100) * 110);
              return (
                <div key={s.section} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.navy }}>{s.avg}%</span>
                  <div style={{ width: "100%", height: h, background: `linear-gradient(to top, ${C.navy}, #1e3a5f)`, borderRadius: "5px 5px 0 0" }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {sectionResultsData.map((s) => (
              <div key={s.section} style={{ flex: 1, textAlign: "center", fontSize: 11, color: C.grey400, fontWeight: 600 }}>{s.section}</div>
            ))}
          </div>
        </Card>
        <div style={{ height: 48 }} />
      </>}
    </PageWrap>
  );
}