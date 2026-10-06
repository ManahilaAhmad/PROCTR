import { useState } from "react";
import { C } from "../theme/colors";
import { Icon } from "../theme/icons";
import Input from "../components/common/Input";
import { API_BASE_URL } from "../config/apiConfig";
import loginIllustration from "../assets/login-illustration-transparent.png";

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
  .login-bg   { 
    animation: fadeIn .4s ease both; 
    width: 100%;
    height: 100vh;
    height: 100svh;
    overflow: hidden;
    box-sizing: border-box;
  }
  .role-btn { transition: all .18s cubic-bezier(.22,.68,0,1.2); }
  .role-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,180,166,.18); }
  .sign-btn { transition: all .18s ease; }
  .sign-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(26,43,75,.3); }
  .sign-btn:active { transform: translateY(0); }
  .login-card .login-logo-container { display: none !important; }
  .login-bg { justify-content: space-between !important; padding: 0 clamp(32px, 8vw, 120px) !important; }
  .login-bg > .login-card { margin-left: 40px !important; margin-right: 0 !important; }
  .login-hero-copy { position: relative; z-index: 2; width: min(340px, 28vw); color: #fff; display: flex; flex-direction: column; align-items: center; text-align: center; flex: 0 1 340px; }
  .login-hero-logo { display: flex; align-items: center; gap: 13px; margin-bottom: 100px; }
  @keyframes logoFloat3d { 0%, 100% { transform: perspective(500px) rotateY(-9deg) rotateX(3deg) translateY(0); } 50% { transform: perspective(500px) rotateY(9deg) rotateX(-2deg) translateY(-4px); } }
  .login-hero-logo-mark { position: relative; width: 58px; height: 58px; display: grid; place-items: center; border: 1px solid rgba(188,255,250,.8); border-radius: 16px 16px 20px 12px; background: linear-gradient(145deg, #25e2d0 0%, #00b4a6 45%, #08747d 100%); color: #fff; box-shadow: inset 7px 7px 12px rgba(255,255,255,.18), inset -8px -10px 16px rgba(0,40,60,.28), 0 14px 0 #075b69, 0 22px 34px rgba(0,180,166,.32); transform: perspective(500px) rotateY(-9deg) rotateX(3deg); animation: logoFloat3d 5s ease-in-out infinite; }
  .login-hero-logo-mark::before { content: ""; position: absolute; inset: 5px; border-radius: 12px 12px 16px 9px; border: 1px solid rgba(255,255,255,.36); background: linear-gradient(135deg, rgba(255,255,255,.22), transparent 38%); pointer-events: none; }
  .login-hero-logo-mark::after { content: ""; position: absolute; top: 7px; left: 11px; width: 20px; height: 8px; border-radius: 50%; background: rgba(255,255,255,.34); filter: blur(3px); transform: rotate(-18deg); pointer-events: none; }
  .login-hero-logo-mark svg { position: relative; z-index: 1; width: 28px; height: 28px; filter: drop-shadow(0 2px 2px rgba(0,50,60,.4)); }
  .login-hero-logo-mark { width: 64px; height: 72px; border: 0; border-radius: 0; background: transparent; box-shadow: none; transform: perspective(600px) rotateY(-8deg) rotateX(3deg); }
  .login-hero-logo-mark::before { inset: 5px 7px 4px; border: 0; border-radius: 0; background: linear-gradient(145deg, #5cf3e4 0%, #00b4a6 42%, #075c72 100%); clip-path: polygon(50% 0, 93% 17%, 85% 67%, 50% 100%, 15% 67%, 7% 17%); box-shadow: inset 5px 5px 8px rgba(255,255,255,.22), inset -6px -9px 12px rgba(0,39,66,.3), 8px 10px 0 rgba(0,74,91,.55); }
  .login-hero-logo-mark::after { top: 18px; left: 17px; width: 28px; height: 9px; border-radius: 50%; background: rgba(255,255,255,.38); filter: blur(4px); transform: rotate(-18deg); }
  .login-hero-logo-mark svg { width: 38px; height: 38px; filter: drop-shadow(0 2px 2px rgba(0,42,55,.5)); }
  .login-hero-logo-mark { width: 56px; height: 62px; border: 0; border-radius: 0; background: transparent; box-shadow: none; transform: none; animation: none; }
  @keyframes logoOrbit { from { transform: translate(-50%, -50%) rotateX(66deg) rotateZ(0deg); } to { transform: translate(-50%, -50%) rotateX(66deg) rotateZ(360deg); } }
  .login-hero-logo-mark::before { content: ""; display: block; position: absolute; top: 50%; left: 50%; width: 92px; height: 38px; border: 1px solid rgba(103,246,231,.72); border-radius: 50%; box-shadow: 0 0 12px rgba(0,180,166,.38); transform: translate(-50%, -50%) rotateX(66deg) rotateZ(-18deg); animation: logoOrbit 8s linear infinite; }
  .login-hero-logo-mark::after { content: ""; display: block; position: absolute; top: 8px; right: 5px; width: 6px; height: 6px; border-radius: 50%; background: #b7fff6; box-shadow: 0 0 12px 4px rgba(73,238,220,.72); animation: floatDot 2.2s ease-in-out infinite; }
  .login-hero-logo-mark svg { position: relative; z-index: 1; width: 50px; height: 50px; color: #fff; filter: drop-shadow(0 0 9px rgba(0,180,166,.7)) drop-shadow(0 5px 7px rgba(0,0,0,.35)); }
  .login-hero-logo-mark::before, .login-hero-logo-mark::after { display: none; }
  .login-hero-logo-name { font-size: 24px; font-weight: 900; letter-spacing: -.5px; line-height: 1; }
  .login-hero-logo-sub { margin-top: 5px; color: #87eee5; font-size: 10px; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase; }
  .login-hero-copy h1 { max-width: 390px; margin: 0; color: #fff; font-size: clamp(42px, 5vw, 68px); line-height: .98; letter-spacing: -2.8px; }
  .login-hero-copy h1 span { color: #87eee5; }
  .login-hero-copy p { max-width: 360px; margin: 24px 0 0; color: rgba(255,255,255,.7); font-size: 14px; line-height: 1.7; }
  .login-hero-logo-sub { color: #63e7c4; }
  .login-hero-copy h1 span { color: #65e5c4; }
  .login-hero-logo-mark svg { filter: drop-shadow(0 0 10px rgba(32,215,169,.72)) drop-shadow(0 5px 7px rgba(0,0,0,.35)); }
  .login-hero-copy { color: #557987; }
  .login-hero-logo-name, .login-hero-copy h1 { color: #557987; }
  .login-hero-logo-sub, .login-hero-copy h1 span { color: #557987; }
  .login-hero-logo-mark svg { color: #557987; filter: drop-shadow(0 3px 4px rgba(55,91,105,.28)); }
  .login-hero-copy p { color: rgba(65,94,105,.82); }
  .login-hero-copy { color: #fff; }
  .login-hero-logo-name, .login-hero-copy h1 { color: #fff; }
  .login-hero-logo-sub, .login-hero-copy h1 span { color: #9bd9e7; }
  .login-hero-logo-mark svg { color: #fff; filter: drop-shadow(0 0 10px rgba(155,217,231,.62)); }
  .login-hero-copy p { color: rgba(255,255,255,.76); }
  .login-bg { background: #fff !important; isolation: isolate; }
  .login-hero-copy { color: #557987; }
  .login-illustration { display: block; flex: 0 1 min(390px, 29vw); width: min(390px, 29vw); max-height: 390px; object-fit: contain; margin: 0 18px; }
  .login-hero-logo { margin-bottom: 28px; }
  .login-hero-logo-name, .login-hero-copy h1 { color: #557987; }
  .login-hero-logo-sub, .login-hero-copy h1 span { color: #557987; }
  .login-hero-copy p { max-width: 290px; margin: 20px 0 0; color: rgba(65,94,105,.82); font-size: 14px; line-height: 1.65; }
  .login-card { border: 1px solid #e4ecef; box-shadow: 0 22px 55px rgba(52,86,101,.16) !important; }
  .login-hero-copy { position: absolute; left: clamp(28px, 4.5vw, 56px); top: 10%; width: 215px; flex: none; align-items: flex-start; text-align: left; }
  .login-hero-logo { margin-bottom: 42px; gap: 12px; }
  .login-hero-logo-mark { display: grid; place-items: center; width: 44px; height: 44px; flex: 0 0 44px; border: 0; border-radius: 9px; background: linear-gradient(145deg, #416c82, #254b61); box-shadow: 0 7px 18px rgba(26,43,75,.16); }
  .login-hero-logo-mark svg { width: 26px; height: 26px; color: #fff; filter: none; }
  .login-hero-logo-name { font-size: 21px; letter-spacing: 0; }
  .login-hero-logo-sub { color: #557987; font-size: 8px; letter-spacing: 2px; }
  .login-hero-copy h1 { font-family: Georgia, 'Times New Roman', serif; font-size: 48px; line-height: 1; letter-spacing: 0; }
  .login-hero-copy p { max-width: 220px; margin-top: 12px; color: #557987; font-size: 12px; line-height: 1.6; }
  .login-illustration { position: absolute; left: calc(50% - 297px); top: 25%; width: min(265px, 26vw); height: auto; max-height: 42vh; flex: none; margin: 0; }
  .login-hero-features { position: absolute; z-index: 2; left: clamp(28px, 4vw, 50px); bottom: clamp(130px, 25vh, 185px); display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; width: 250px; text-align: center; color: #557987; }
  .login-hero-feature-icon { width: 36px; height: 36px; margin: 0 auto 7px; display: grid; place-items: center; border-radius: 50%; background: #e5f0f4; color: #557987; }
  .login-hero-feature-title { color: #3f6678; font-size: 10px; font-weight: 700; }
  .login-hero-feature-copy { margin-top: 6px; font-size: 9px; line-height: 1.4; color: #5f7885; }
  .login-bg::before { content: ""; position: absolute; top: 0; right: 0; bottom: 0; width: 50%; z-index: 0; pointer-events: none; background: #c3d8e4; }
  .login-bg > .login-card { position: absolute; top: 50%; right: clamp(28px, 4.2vw, 60px); z-index: 2; width: min(440px, calc(50vw - 140px)) !important; max-width: 440px !important; margin: 0 !important; translate: 0 -50%; background: linear-gradient(145deg, rgba(255,255,255,.78), rgba(255,255,255,.58)) !important; border: 1px solid rgba(255,255,255,.82) !important; border-radius: 22px !important; box-shadow: 0 28px 80px rgba(41,91,117,.22), inset 0 1px 0 rgba(255,255,255,.94) !important; backdrop-filter: blur(24px) saturate(145%); -webkit-backdrop-filter: blur(24px) saturate(145%); }
  .login-card-responsive input { background: rgba(255,255,255,.5) !important; border: 1px solid rgba(255,255,255,.9) !important; border-radius: 11px !important; box-shadow: inset 0 1px 2px rgba(48,91,112,.06), 0 7px 22px rgba(63,145,177,.16); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
  .login-card .role-btn { border-radius: 10px !important; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); box-shadow: inset 0 1px 0 rgba(255,255,255,.72), 0 8px 26px rgba(51,133,165,.2); }
  .login-card .sign-btn { border-radius: 11px !important; border: 1px solid rgba(255,255,255,.42) !important; box-shadow: 0 0 36px rgba(58,177,215,.48), 0 10px 26px rgba(47,110,139,.25), inset 0 1px 0 rgba(255,255,255,.24); }
  .login-hero-feature-icon { border: 1px solid rgba(255,255,255,.94); background: rgba(207,231,240,.82); box-shadow: 0 9px 28px rgba(63,150,183,.3), inset 0 1px 0 rgba(255,255,255,.96); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
  .login-illustration { filter: drop-shadow(0 14px 28px rgba(43,168,207,.42)); }
  @media (min-width: 1260px) and (max-width: 1439px) {
    .login-hero-copy { width: 260px; }
    .login-hero-logo { margin-bottom: 600px; }
    .login-hero-logo-mark { width: 50px; height: 50px; flex-basis: 50px; }
    .login-hero-logo-mark svg { width: 30px; height: 30px; }
    .login-hero-logo-name { font-size: 24px; }
    .login-hero-logo-sub { font-size: 9px; }
    .login-hero-copy h1 { font-size: 56px; }
    .login-hero-copy p { max-width: 255px; font-size: 13px; }
    .login-illustration { left: calc(50% - 350px); top: 23%; width: min(290px, calc(50vw - 342px)); max-height: 45vh; }
    .login-hero-features { width: 320px; gap: 10px; bottom: clamp(140px, 20vh, 160px); }
    .login-hero-feature-icon { width: 44px; height: 44px; }
    .login-hero-feature-title { font-size: 11px; }
    .login-hero-feature-copy { font-size: 10px; }
    .login-bg > .login-card { width: calc(44vw - 62px) !important; max-width: 540px !important; right: clamp(24px, 3vw, 42px); }
  }
  @media (min-width: 1440px) {
    .login-hero-copy { width: 300px; }
    .login-hero-logo { gap: 14px; margin-bottom: 125px; }
    .login-hero-logo-mark { width: 60px; height: 60px; flex-basis: 60px; }
    .login-hero-logo-mark svg { width: 34px; height: 34px; }
    .login-hero-logo-name { font-size: 26px; }
    .login-hero-logo-sub { font-size: 10px; }
    .login-hero-copy h1 { font-size: 68px; }
    .login-hero-copy p { max-width: 290px; font-size: 14px; }
    .login-illustration { left: calc(50% - 530px); top: 22%; width: 520px; max-height: 47vh; }
    .login-hero-features { width: 420px; gap: 14px; bottom: clamp(140px, 20vh, 160px); }
    .login-hero-feature-icon { width: 52px; height: 52px; }
    .login-hero-feature-title { font-size: 13px; }
    .login-hero-feature-copy { font-size: 12px; }
    .login-bg > .login-card { width: min(640px, calc(50vw - 120px)) !important; max-width: 640px !important; }
  }
  @media (max-width: 760px) {
    .login-bg { justify-content: center !important; padding: 32px 0 !important; }
    .login-hero-copy, .login-illustration, .login-hero-features { display: none; }
    .login-bg > .login-card { position: relative; top: auto; right: auto; width: calc(100% - 48px) !important; max-width: 480px !important; margin: 0 24px !important; translate: none; }
  }
  @media (max-height: 680px) and (min-width: 761px) {
    .login-bg { height: auto; min-height: 100svh; overflow-y: auto; align-items: flex-start !important; padding-top: 32px !important; padding-bottom: 32px !important; }
    .login-hero-copy, .login-illustration, .login-hero-features { display: none; }
    .login-bg > .login-card { position: relative; top: auto; right: auto; margin: 0 auto !important; translate: none; }
  }

  @media (max-height: 680px), (max-width: 600px) {
    .login-bg {
      height: auto;
      min-height: 100vh;
      min-height: 100svh;
      overflow-y: auto;
      align-items: flex-start !important;
      padding: 32px 0;
    }
  }

  @media (max-height: 740px) {
    .login-card-responsive {
      padding: 44px 30px 36px !important;
      min-height: 600px;
    }
    .login-logo-container {
      margin-bottom: 20px !important;
    }
    .login-welcome-title {
      margin-bottom: 4px !important;
    }
    .role-grid-responsive {
      margin-bottom: 16px !important;
    }
  }
`;

export default function LoginPage({ setPage, setRole, setUser }) {
  const [selectedRole, setSelectedRole] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const roles = [
    { id: "admin",       label: "System Administrator",  icon: Icon.server },
    { id: "student",     label: "Student",              icon: Icon.users },
    { id: "teacher",     label: "Teacher",              icon: Icon.clipboardList },
    { id: "hod",         label: "Head of Department",   icon: Icon.check },
    { id: "coordinator", label: "Coordinator",           icon: Icon.calendar },
    { id: "director",    label: "Director Examination", icon: Icon.chart },
    { id: "dec",         label: "Dept. Exam Committee", icon: Icon.shield },
  ];

  function handleLogin() {
    if (!selectedRole) { setShake(true); setTimeout(() => setShake(false), 600); return; }
    if (!email.trim() || !pass.trim()) { setShake(true); setTimeout(() => setShake(false), 600); return; }
    
    setLoading(true);
    fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-PROCTR-Client": "web" },
      credentials: "include",
      body: JSON.stringify({ email: email.trim(), password: pass.trim(), user_type: selectedRole }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Invalid credentials or server error.");
        return data;
      })
      .then((data) => {
        setLoading(false);
        if (data.status === "success") {
          setRole(data.user.userType);
          setUser(data.user);
          const dest = {
            admin: "admin-students",
            student: "student",
            teacher: "teacher",
            hod: "hod",
            director: "dir-timetable",
            coordinator: "coordinator",
            dec: "dec",
          };
          const targetPage = dest[selectedRole] || "student";
          localStorage.setItem("proctr_user", JSON.stringify(data.user));
          localStorage.setItem("proctr_role", data.user.userType);
          localStorage.setItem("proctr_page", targetPage);
          setPage(targetPage);
        } else {
          setShake(true);
          setTimeout(() => setShake(false), 600);
          alert(data.message || "Failed to log in.");
        }
      })
      .catch((err) => {
        setLoading(false);
        setShake(true);
        setTimeout(() => setShake(false), 600);
        alert(err.message || "Network error. Make sure your backend server is running.");
      });
  }

  return (
    <>
      <style>{loginStyles}</style>
      <div className="login-bg" style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        {/* Decorative background circles */}
        <div style={{ position: "absolute", top: "30%", left: "8%", width: 8, height: 8, borderRadius: "50%", background: C.teal, opacity: 0.5, animation: "floatDot 3.2s ease-in-out infinite" }} />
        <div style={{ position: "absolute", top: "60%", right: "10%", width: 5, height: 5, borderRadius: "50%", background: C.teal, opacity: 0.4, animation: "floatDot 2.5s ease-in-out infinite 0.8s" }} />
        <div style={{ position: "absolute", top: "15%", right: "22%", width: 6, height: 6, borderRadius: "50%", background: C.teal, opacity: 0.35, animation: "floatDot 4s ease-in-out infinite 1.4s" }} />

        <div className="login-hero-copy">
          <div className="login-hero-logo">
            <div className="login-hero-logo-mark">{Icon.shield}</div>
            <div><div className="login-hero-logo-name">PROCTR</div><div className="login-hero-logo-sub">Secure Lab Exams</div></div>
          </div>
          <h1>Secure.<br /><span>Smarter.<br />Exams.</span></h1>
          <p>Set up exams, monitor live sessions, and manage submissions securely.</p>
        </div>
        <img className="login-illustration" src={loginIllustration} alt="Pixel art exam workspace" />
        <div className="login-hero-features" aria-label="Platform benefits">
          <div>
            <div className="login-hero-feature-icon">{Icon.shield}</div>
            <div className="login-hero-feature-title">Secure</div>
            <div className="login-hero-feature-copy">Protected &amp; reliable</div>
          </div>
          <div>
            <div className="login-hero-feature-icon">{Icon.users}</div>
            <div className="login-hero-feature-title">Easy Setup</div>
            <div className="login-hero-feature-copy">Create &amp; manage exams</div>
          </div>
          <div>
            <div className="login-hero-feature-icon">{Icon.chart}</div>
            <div className="login-hero-feature-title">Real-time</div>
            <div className="login-hero-feature-copy">Live monitoring &amp; reports</div>
          </div>
        </div>
        <div className="login-card login-card-responsive" style={{ width: "100%", maxWidth: 480, margin: "0 24px", background: "rgba(255,255,255,.97)", borderRadius: 0, boxShadow: "0 32px 80px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.06)" }}>
          {/* Logo */}
          <div className="login-logo-container" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 36 }}>
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
          <p style={{ color: C.grey500, fontSize: 14, margin: "0 0 28px" }}>Sign in to continue to your workspace</p>

          {/* Role selector */}
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.grey500, marginBottom: 10, letterSpacing: 0.6, textTransform: "uppercase" }}>Choose your role</label>
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
                  border: `1px solid ${selectedRole === r.id ? "rgba(255,255,255,.54)" : "rgba(255,255,255,.82)"}`,
                  background: selectedRole === r.id ? "linear-gradient(140deg, rgba(64,111,133,.94), rgba(78,149,170,.84))" : "rgba(255,255,255,.42)",
                  cursor: "pointer", fontWeight: 600, fontSize: 12,
                  color: selectedRole === r.id ? C.white : "#557987",
                  textAlign: "center", lineHeight: 1.3,
                  animationDelay: `${i * 0.06}s`,
                }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 6, color: selectedRole === r.id ? "#f1eee8" : "#557987" }}>{r.icon}</div>
                {r.label}
              </button>
            ))}
          </div>

          <Input label="Email address" type="email" placeholder="you@university.edu" iconEl={Icon.mail} value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Password" type="password" placeholder="••••••••" iconEl={Icon.lock} value={pass} onChange={(e) => setPass(e.target.value)} />

          <button type="button" onClick={() => setPage("forgot-password")} style={{ display: "block", margin: "-8px 0 16px auto", border: 0, background: "transparent", color: C.teal, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Forgot password?
          </button>

          <button className="sign-btn" disabled={loading}
            onClick={handleLogin}
            style={{ width: "100%", padding: "13px", borderRadius: 0, border: "none", background: loading ? C.grey200 : "linear-gradient(135deg, #557987 0%, #7899a6 100%)", color: loading ? C.grey400 : C.white, fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, letterSpacing: 0.2 }}>
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
