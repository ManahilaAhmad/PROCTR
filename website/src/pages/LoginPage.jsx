import { useState } from "react";
import { C } from "../theme/colors";
import { Icon } from "../theme/icons";
import Input from "../components/common/Input";

const loginStyles = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(28px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes pulse-ring {
    0%   { transform: scale(1);   opacity: .6; }
    70%  { transform: scale(1.5); opacity: 0;  }
    100% { transform: scale(1.5); opacity: 0;  }
  }
  @keyframes floatDot {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-18px); }
  }
  .login-card { animation: fadeUp .55s cubic-bezier(.22,.68,0,1.2) both; }
  .login-bg   { animation: fadeIn .4s ease both; }
  .role-btn { transition: all .18s cubic-bezier(.22,.68,0,1.2); }
  .role-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,180,166,.18); }
  .sign-btn { transition: all .18s ease; }
  .sign-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(26,43,75,.3); }
  .sign-btn:active { transform: translateY(0); }
`;

export default function LoginPage({ setPage, setRole }) {
  const [selectedRole, setSelectedRole] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const roles = [
    { id: "student", label: "Student", icon: Icon.users },
    { id: "teacher", label: "Teacher", icon: Icon.clipboardList },
    { id: "hod", label: "Head of Department", icon: Icon.check },
    { id: "invigilator", label: "Invigilator", icon: Icon.monitor },
    { id: "coordinator", label: "Coordinator", icon: Icon.calendar },
    { id: "director", label: "Director Examination", icon: Icon.chart },
    { id: "dec", label: "Dept. Exam Committee", icon: Icon.shield },
  ];

  function handleLogin() {
    if (!selectedRole) { setShake(true); setTimeout(() => setShake(false), 600); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setRole(selectedRole);
      const dest = { student: "student", teacher: "teacher", hod: "hod", director: "director", coordinator: "coordinator", invigilator: "invigilator", dec: "dec" };
      setPage(dest[selectedRole]);
    }, 900);
  }

  return (
    <>
      <style>{loginStyles}</style>
      <div className="login-bg" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${C.navyDark} 0%, ${C.navy} 50%, #1a3a5c 100%)`, position: "relative", overflow: "hidden" }}>
        {/* Decorative background circles */}
        <div style={{ position: "absolute", top: -120, right: -120, width: 480, height: 480, borderRadius: "50%", background: `radial-gradient(circle, ${C.teal}22 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -80, left: -80, width: 360, height: 360, borderRadius: "50%", background: `radial-gradient(circle, ${C.teal}18 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "30%", left: "8%", width: 8, height: 8, borderRadius: "50%", background: C.teal, opacity: 0.5, animation: "floatDot 3.2s ease-in-out infinite" }} />
        <div style={{ position: "absolute", top: "60%", right: "10%", width: 5, height: 5, borderRadius: "50%", background: C.teal, opacity: 0.4, animation: "floatDot 2.5s ease-in-out infinite 0.8s" }} />
        <div style={{ position: "absolute", top: "15%", right: "22%", width: 6, height: 6, borderRadius: "50%", background: C.teal, opacity: 0.35, animation: "floatDot 4s ease-in-out infinite 1.4s" }} />

        <div className="login-card login-card-responsive" style={{ width: "100%", maxWidth: 480, margin: "0 24px", background: "rgba(255,255,255,.97)", borderRadius: 24, boxShadow: "0 32px 80px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.06)" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 36 }}>
            <div style={{ position: "relative", width: 42, height: 42 }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: 11, background: C.teal, animation: "pulse-ring 2s ease-out infinite" }} />
              <div style={{ position: "relative", width: 42, height: 42, borderRadius: 11, background: C.navy, display: "flex", alignItems: "center", justifyContent: "center", color: C.white }}>
                {Icon.shield}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.navy, letterSpacing: -0.5, lineHeight: 1 }}>PROCTR</div>
              <div style={{ fontSize: 11, color: C.teal, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginTop: 2 }}>Secure Lab Exams</div>
            </div>
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 800, color: C.navy, margin: "0 0 4px", letterSpacing: -0.3 }}>Welcome back</h2>
          <p style={{ color: C.grey500, fontSize: 14, margin: "0 0 28px" }}>Sign in with your university credentials</p>

          {/* Role selector */}
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.grey500, marginBottom: 10, letterSpacing: 0.6, textTransform: "uppercase" }}>Select your role</label>
          <div className="role-grid-responsive" style={{
            marginBottom: 26,
            animation: shake ? "none" : undefined,
            ...(shake ? { animation: "shakeX .4s ease" } : {}),
          }}>
            {roles.map((r, i) => (
              <button key={r.id} className="role-btn"
                onClick={() => setSelectedRole(r.id)}
                style={{
                  padding: "11px 8px", borderRadius: 10,
                  border: `2px solid ${selectedRole === r.id ? C.teal : C.grey200}`,
                  background: selectedRole === r.id ? C.navy : C.white,
                  cursor: "pointer", fontWeight: 600, fontSize: 12,
                  color: selectedRole === r.id ? C.white : C.grey500,
                  textAlign: "center", lineHeight: 1.3,
                  animationDelay: `${i * 0.06}s`,
                }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 6, color: selectedRole === r.id ? C.teal : C.grey400 }}>{r.icon}</div>
                {r.label}
              </button>
            ))}
          </div>

          <Input label="Email address" type="email" placeholder="you@university.edu" iconEl={Icon.mail} value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Password" type="password" placeholder="••••••••" iconEl={Icon.lock} value={pass} onChange={(e) => setPass(e.target.value)} />

          <button className="sign-btn" disabled={loading}
            onClick={handleLogin}
            style={{ width: "100%", padding: "13px", borderRadius: 10, border: "none", background: loading ? C.grey200 : `linear-gradient(135deg, ${C.navy} 0%, #1a3a5c 100%)`, color: loading ? C.grey400 : C.white, fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, letterSpacing: 0.2 }}>
            {loading
              ? <><span style={{ width: 16, height: 16, border: `2px solid ${C.grey300}`, borderTopColor: C.teal, borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} /> Signing in…</>
              : "Sign in to PROCTR"
            }
          </button>

          <p style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: C.grey400 }}>
            Need access? Contact your department administrator
          </p>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes shakeX { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }`}</style>
    </>
  );
}
