import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { C } from '../theme/colors';
import { Icon } from '../theme/icons';
import PageWrap from '../components/common/PageWrap';
import Card from '../components/common/Card';
import Btn from '../components/common/Btn';
import StatCard from '../components/common/StatCard';
import { StudentRiskCard, ViolationTimeline, ExamTimer, RiskBadge } from '../components/common/ExamMonitorComponents';

export default function LiveDashboardPage({ setPage, examId = 1 }) {
  const [summary, setSummary] = useState([]);
  const [events, setEvents]   = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentEvents, setStudentEvents]     = useState([]);
  const [isConnected, setIsConnected]         = useState(false);
  const [filterMode, setFilterMode]           = useState('all'); // 'all' | 'flagged' | 'clean'

  // Fetch initial summary and events
  const fetchData = () => {
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
  };

  useEffect(() => {
    fetchData();

    // Connect to Socket.IO backend
    const socket = io('http://localhost:5000');

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join_exam', examId);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('proctoring_event', (newEvent) => {
      setEvents(prev => [newEvent, ...prev]);
      fetchData(); // refresh summary
    });

    return () => {
      socket.emit('leave_exam', examId);
      socket.disconnect();
    };
  }, [examId]);

  // Handle clicking into a student detail view
  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    const filtered = events.filter(e => e.student_id === student.student_id);
    setStudentEvents(filtered);
  };

  // Aggregated stats
  const totalStudents   = summary.length;
  const flaggedStudents = summary.filter(s => s.overall_risk_tier !== 'Clean');
  const hardViolations  = summary.reduce((acc, s) => acc + parseInt(s.hard_violations || 0), 0);
  const cleanStudents   = summary.filter(s => s.overall_risk_tier === 'Clean');

  const displayedStudents = summary.filter(s => {
    if (filterMode === 'flagged') return s.overall_risk_tier !== 'Clean';
    if (filterMode === 'clean')   return s.overall_risk_tier === 'Clean';
    return true;
  });

  return (
    <PageWrap
      title="Live Exam Monitoring"
      subtitle="Real-time proctoring feed & intelligence overview for active exam"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Connection status indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: isConnected ? C.green : C.red }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isConnected ? C.green : C.red,
              display: 'inline-block',
              animation: isConnected ? 'pulse2 1.5s infinite' : 'none'
            }} />
            {isConnected ? 'LIVE FEED ACTIVE' : 'DISCONNECTED'}
          </div>

          <ExamTimer durationMinutes={120} />

          <Btn variant="ghost" onClick={() => setPage('teacher')}>
            ← Back to Exams
          </Btn>
        </div>
      }
    >
      {/* ── Stat Cards Bar ── */}
      <div className="resp-grid-4" style={{ marginBottom: 24 }}>
        <StatCard label="Enrolled Students" value={totalStudents} icon={Icon.users} delay={0} />
        <StatCard label="Flagged Students" value={flaggedStudents.length} icon={Icon.bell} accent={flaggedStudents.length ? C.red : C.teal} light={flaggedStudents.length ? C.redLight : C.tealLight} delay={60} />
        <StatCard label="Hard Violations" value={hardViolations} icon={Icon.alertTriangle} accent={hardViolations ? C.red : C.teal} light={hardViolations ? C.redLight : C.tealLight} delay={120} />
        <StatCard label="Clean Students" value={cleanStudents.length} icon={Icon.check} delay={180} />
      </div>

      {/* ── DETAIL VIEW FOR A SELECTED STUDENT ── */}
      {selectedStudent ? (
        <Card style={{ animation: 'fadeUp 0.3s ease both' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: `1px solid ${C.grey100}`, pb: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.navy }}>
                  {selectedStudent.student_name}
                </h3>
                <RiskBadge severity={selectedStudent.overall_risk_tier} />
              </div>
              <span style={{ fontSize: 13, color: C.grey500, fontWeight: 600 }}>
                Registration No: {selectedStudent.registration_no} · Total Events: {studentEvents.length}
              </span>
            </div>
            <Btn variant="navy" onClick={() => setSelectedStudent(null)}>
              ← Back to Grid Overview
            </Btn>
          </div>

          <h4 style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginBottom: 14 }}>
            Activity & Incident Timeline
          </h4>

          <ViolationTimeline events={studentEvents} />
        </Card>
      ) : (
        /* ── OVERVIEW GRID VIEW ── */
        <>
          {/* Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { id: 'all', label: `All Students (${totalStudents})` },
                { id: 'flagged', label: `🔴 Flagged Only (${flaggedStudents.length})` },
                { id: 'clean', label: `🟢 Clean (${cleanStudents.length})` }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilterMode(tab.id)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: `1.5px solid ${filterMode === tab.id ? C.teal : C.grey200}`,
                    background: filterMode === tab.id ? C.tealLight : C.white,
                    color: filterMode === tab.id ? C.navy : C.grey500,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 12, color: C.grey500, fontWeight: 600 }}>
              Sorted by Risk Tier (Worst First)
            </span>
          </div>

          {/* Student Grid */}
          {displayedStudents.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: '48px 0', color: C.grey400, fontSize: 14 }}>
              ✓ No students matching selected filter.
            </Card>
          ) : (
            <div className="resp-grid-3" style={{ marginBottom: 28 }}>
              {displayedStudents.map(student => (
                <StudentRiskCard
                  key={student.student_id}
                  student={student}
                  onClick={() => handleSelectStudent(student)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </PageWrap>
  );
}
