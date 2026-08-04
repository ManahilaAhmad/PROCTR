import { useState, useEffect } from 'react';
import { C } from '../theme/colors';
import { Icon } from '../theme/icons';
import PageWrap from '../components/common/PageWrap';
import Card from '../components/common/Card';
import Btn from '../components/common/Btn';
import Table from '../components/common/Table';
import StatCard from '../components/common/StatCard';
import { RiskBadge, ViolationTimeline } from '../components/common/ExamMonitorComponents';

export default function PostExamReportPage({ setPage, examId = 1 }) {
  const [summary, setSummary]   = useState([]);
  const [events, setEvents]     = useState([]);
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'flagged' | 'clean'
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentEvents, setStudentEvents]     = useState([]);

  useEffect(() => {
    fetch(`http://localhost:5000/api/proctoring/summary/${examId}`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') setSummary(data.summary);
      })
      .catch(() => {});

    fetch(`http://localhost:5000/api/proctoring/events/${examId}`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') setEvents(data.events);
      })
      .catch(() => {});
  }, [examId]);

  const handleRowClick = (student) => {
    setSelectedStudent(student);
    const filtered = events.filter(e => e.student_id === student.student_id);
    setStudentEvents(filtered);
  };

  const handleExport = () => {
    const reportData = {
      exam_id: examId,
      generated_at: new Date().toISOString(),
      summary: summary,
      all_events: events
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `PROCTR_PostExam_Report_Exam_${examId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const displayedSummary = summary.filter(s => {
    if (filterMode === 'flagged') return s.overall_risk_tier !== 'Clean';
    if (filterMode === 'clean')   return s.overall_risk_tier === 'Clean';
    return true;
  });

  const totalStudents   = summary.length;
  const flaggedStudents = summary.filter(s => s.overall_risk_tier !== 'Clean').length;
  const hardViolations  = summary.reduce((acc, s) => acc + parseInt(s.hard_violations || 0), 0);

  return (
    <PageWrap
      title="Post-Exam Evaluation & Integrity Report"
      subtitle="Complete class overview, student risk tiering, and detailed incident audits"
      actions={
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="navy" onClick={handleExport}>
            📥 Export Academic Integrity Report
          </Btn>
          <Btn variant="ghost" onClick={() => setPage('teacher')}>
            ← Back to Exams
          </Btn>
        </div>
      }
    >
      {/* ── Stat Bar ── */}
      <div className="resp-grid-4" style={{ marginBottom: 24 }}>
        <StatCard label="Total Evaluated" value={totalStudents} icon={Icon.users} delay={0} />
        <StatCard label="Flagged Cases" value={flaggedStudents} icon={Icon.bell} accent={flaggedStudents ? C.red : C.teal} light={flaggedStudents ? C.redLight : C.tealLight} delay={60} />
        <StatCard label="Hard Violations" value={hardViolations} icon={Icon.alertTriangle} accent={hardViolations ? C.red : C.teal} light={hardViolations ? C.redLight : C.tealLight} delay={120} />
        <StatCard label="Clean Submissions" value={totalStudents - flaggedStudents} icon={Icon.check} delay={180} />
      </div>

      {/* ── STUDENT DETAIL MODAL/VIEW ── */}
      {selectedStudent ? (
        <Card style={{ animation: 'fadeUp 0.3s ease both', marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: `1px solid ${C.grey100}`, paddingBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.navy }}>
                  {selectedStudent.student_name}
                </h3>
                <RiskBadge severity={selectedStudent.overall_risk_tier} />
              </div>
              <span style={{ fontSize: 13, color: C.grey500, fontWeight: 600 }}>
                Registration No: {selectedStudent.registration_no} · Hard Violations: {selectedStudent.hard_violations} · Total Events: {studentEvents.length}
              </span>
            </div>
            <Btn variant="navy" onClick={() => setSelectedStudent(null)}>
              ← Back to Class Overview
            </Btn>
          </div>

          <h4 style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginBottom: 14 }}>
            Detailed Activity & AI Reasoning Audit
          </h4>

          <ViolationTimeline events={studentEvents} />
        </Card>
      ) : (
        /* ── CLASS OVERVIEW TABLE ── */
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.grey100}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>
              Class Integrity Overview (Worst First)
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { id: 'all', label: `All (${totalStudents})` },
                { id: 'flagged', label: `🔴 Flagged (${flaggedStudents})` },
                { id: 'clean', label: `🟢 Clean (${totalStudents - flaggedStudents})` }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilterMode(tab.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: `1px solid ${filterMode === tab.id ? C.teal : C.grey200}`,
                    background: filterMode === tab.id ? C.tealLight : C.white,
                    color: filterMode === tab.id ? C.navy : C.grey500,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <Table
            columns={['Student Name', 'Registration No', 'Risk Tier', 'Hard Violations', 'Total Flags', 'Actions']}
            rows={displayedSummary.map(s => [
              <span style={{ fontWeight: 700, color: C.navy }}>{s.student_name}</span>,
              <span style={{ fontWeight: 600, color: C.grey500 }}>{s.registration_no}</span>,
              <RiskBadge severity={s.overall_risk_tier} />,
              s.hard_violations > 0 ? (
                <strong style={{ color: C.red }}>{s.hard_violations}</strong>
              ) : (
                <span style={{ color: C.grey400 }}>0</span>
              ),
              <strong style={{ color: C.navy }}>{s.total_violations}</strong>,
              <Btn variant="ghost" size="sm" onClick={() => handleRowClick(s)}>
                Inspect Detail Audit
              </Btn>
            ])}
          />
        </Card>
      )}
    </PageWrap>
  );
}
