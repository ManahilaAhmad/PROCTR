import { useState, useEffect } from 'react';
import { C } from '../../theme/colors';
import { Icon } from '../../theme/icons';
import Badge from './Badge';
import Card from './Card';

/* ===========================================================
   RISK BADGE
=========================================================== */
export function RiskBadge({ severity, level }) {
  const target = severity || level || 'Low';
  const config = {
    Hard:   { color: C.red,    bg: C.redLight,   label: '🔴 Hard Violation' },
    High:   { color: C.red,    bg: C.redLight,   label: '🔴 High Risk' },
    Medium: { color: C.amber,  bg: C.amberLight, label: '🟡 Medium Risk' },
    Low:    { color: C.teal,   bg: C.tealLight,  label: '🟢 Low Risk' },
    Clean:  { color: C.green,  bg: C.greenLight, label: '🟢 Clean' }
  };
  const item = config[target] || config.Low;
  return <Badge color={item.color} bg={item.bg}>{item.label}</Badge>;
}

/* ===========================================================
   EXAM TIMER
=========================================================== */
export function ExamTimer({ durationMinutes = 120, startTime }) {
  const [timeLeft, setTimeLeft] = useState(durationMinutes * 60);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const isUrgent = mins < 15;

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 16px',
      borderRadius: 10,
      background: isUrgent ? C.redLight : C.navy,
      color: isUrgent ? C.red : C.white,
      fontWeight: 800,
      fontSize: 14,
      fontFamily: 'monospace',
      border: isUrgent ? `1.5px solid ${C.red}` : 'none'
    }}>
      <span style={{ display: 'flex', color: isUrgent ? C.red : C.teal }}>{Icon.clock || Icon.calendar}</span>
      <span>{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}</span>
    </div>
  );
}

/* ===========================================================
   EVENT CARD (Single proctoring event snippet)
=========================================================== */
export function EventCard({ event }) {
  const isHard = event.severity === 'Hard';
  const isHigh = event.severity === 'High';

  return (
    <div style={{
      padding: '12px 16px',
      borderRadius: 10,
      background: isHard ? C.redLight : isHigh ? C.amberLight : C.grey50,
      border: `1.5px solid ${isHard ? C.red : isHigh ? C.amber : C.grey200}`,
      marginBottom: 10,
      animation: 'fadeIn 0.3s ease both'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RiskBadge severity={event.severity} />
          <span style={{ fontSize: 11, fontWeight: 700, color: C.grey400, textTransform: 'uppercase' }}>
            {event.event_type}
          </span>
        </div>
        <span style={{ fontSize: 12, color: C.grey500, fontWeight: 600 }}>
          {new Date(event.created_at || Date.now()).toLocaleTimeString()}
        </span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, lineHeight: 1.4 }}>
        {event.description}
      </div>
      {event.metadata && (
        <div style={{ fontSize: 11, color: C.grey500, marginTop: 6, fontFamily: 'monospace', background: 'rgba(0,0,0,0.03)', padding: '4px 8px', borderRadius: 4 }}>
          {typeof event.metadata === 'string' ? event.metadata : JSON.stringify(event.metadata)}
        </div>
      )}
    </div>
  );
}

/* ===========================================================
   STUDENT RISK CARD (For Overview Grid)
=========================================================== */
export function StudentRiskCard({ student, onClick }) {
  const isHard = student.overall_risk_tier === 'Hard';
  const isHigh = student.overall_risk_tier === 'High';
  const isMed  = student.overall_risk_tier === 'Medium';

  const borderColor = isHard ? C.red : isHigh ? C.red : isMed ? C.amber : C.grey200;
  const bgColor     = isHard ? C.redLight : isHigh ? C.redLight : isMed ? C.amberLight : C.white;

  return (
    <Card
      onClick={onClick}
      style={{
        padding: 20,
        border: `2px solid ${borderColor}`,
        background: bgColor,
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
      className="feature-card"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <h4 style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 800, color: C.navy }}>
            {student.student_name}
          </h4>
          <span style={{ fontSize: 12, color: C.grey500, fontWeight: 600 }}>
            {student.registration_no}
          </span>
        </div>
        <RiskBadge severity={student.overall_risk_tier} />
      </div>

      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: C.grey500, marginTop: 14, borderTop: `1px solid ${C.grey200}`, paddingTop: 10 }}>
        <div>Total Flags: <strong style={{ color: C.navy }}>{student.total_violations || 0}</strong></div>
        {student.hard_violations > 0 && (
          <div>Hard: <strong style={{ color: C.red }}>{student.hard_violations}</strong></div>
        )}
      </div>
    </Card>
  );
}

/* ===========================================================
   VIOLATION TIMELINE
=========================================================== */
export function ViolationTimeline({ events }) {
  if (!events || events.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', color: C.grey400, fontSize: 13 }}>
        ✓ No proctoring events recorded for this student.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {events.map((ev, i) => (
        <EventCard key={ev.event_id || i} event={ev} />
      ))}
    </div>
  );
}
