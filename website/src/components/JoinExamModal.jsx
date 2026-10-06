import { useState } from "react";
import { C } from "../theme/colors";
import { Icon } from "../theme/icons";
import Btn from "./common/Btn";

const VALID_CODES = {
  "DS-2026": { title: "Data Structures Lab", course: "CS-301", live: true },
  "NET-884": { title: "Networks Lab Final", course: "CS-415", live: false },
};

export default function JoinExamModal({ onClose }) {
  const [code, setCode] = useState("");
  const [state, setState] = useState("idle");

  function handleJoin() {
    if (!code.trim()) return;
    setState("checking");
    setTimeout(() => {
      const found = VALID_CODES[code.trim().toUpperCase()];
      if (!found) { setState("error"); return; }
      setState(found.live ? "live" : "waiting");
    }, 900);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(17,29,51,.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: C.white, borderRadius: 16, padding: 40, width: 440, boxShadow: "0 24px 64px rgba(0,0,0,.18)", animation: "popIn .28s cubic-bezier(.22,.68,0,1.3) both" }} onClick={(e) => e.stopPropagation()}>

        {(state === "idle" || state === "error" || state === "checking") && <>
          <div style={{ marginBottom: 26 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 19, fontWeight: 800, color: C.navy }}>Join Exam</h2>
            <p style={{ margin: 0, fontSize: 13, color: C.grey500 }}>Enter the session code provided by your invigilator</p>
          </div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.grey800, marginBottom: 8 }}>Session Code</label>
          <input autoFocus value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setState("idle"); }}
            placeholder="e.g. DS-2026" maxLength={10}
            style={{ width: "100%", padding: "13px 16px", borderRadius: 9, border: `2px solid ${state === "error" ? C.navy : C.grey200}`, fontSize: 20, fontWeight: 800, letterSpacing: 4, textAlign: "center", color: C.navy, background: C.grey50, outline: "none", boxSizing: "border-box", textTransform: "uppercase" }}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()} />
          {state === "error" && (
            <div style={{ marginTop: 10, padding: "10px 14px", background: C.grey100, borderRadius: 7, fontSize: 13, color: C.navy, fontWeight: 600, display: "flex", gap: 8, alignItems: "center" }}>
              {Icon.x} Invalid code. Please verify with your teacher.
            </div>
          )}
          <div style={{ margin: "16px 0 24px", padding: "10px 14px", background: C.tealLight, borderRadius: 8, border: `1px solid ${C.tealMid}`, fontSize: 13, color: C.navy, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ flexShrink: 0, marginTop: 1 }}>{Icon.info}</span>
            You can only enter the exam after the invigilator has started the session.
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn variant="ghost" style={{ flex: 1, justifyContent: "center" }} onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" style={{ flex: 1, justifyContent: "center" }} onClick={handleJoin}>
              {state === "checking" ? "Verifying..." : "Join Session"}
            </Btn>
          </div>
        </>}

        {state === "waiting" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: C.tealLight, display: "flex", alignItems: "center", justifyContent: "center", color: C.navy, margin: "0 auto 20px" }}>{Icon.bell}</div>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: C.navy, margin: "0 0 10px" }}>Waiting for teacher to start</h2>
            <p style={{ color: C.grey500, fontSize: 14, lineHeight: 1.7, margin: "0 0 28px" }}>Your code is valid. The session has not been opened yet. You will be admitted as soon as the invigilator starts the exam.</p>
            <Btn variant="ghost" style={{ width: "100%", justifyContent: "center" }} onClick={onClose}>Close — I will check back later</Btn>
          </div>
        )}

        {state === "live" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: C.tealLight, display: "flex", alignItems: "center", justifyContent: "center", color: C.teal, margin: "0 auto 20px" }}>{Icon.checkCircle}</div>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: C.navy, margin: "0 0 10px" }}>Session is live</h2>
            <p style={{ color: C.grey500, fontSize: 14, lineHeight: 1.7, margin: "0 0 20px" }}>The exam is active. Once you enter, the application will lock your screen and begin monitoring.</p>
            <div style={{ padding: "13px 16px", background: C.grey100, borderRadius: 9, marginBottom: 24, fontSize: 13, color: C.navy, fontWeight: 600, textAlign: "left", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0, marginTop: 1 }}>{Icon.alertTriangle}</span>
              Do not close the application, switch windows, or insert USB drives. All activity is recorded.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="ghost" style={{ flex: 1, justifyContent: "center" }} onClick={onClose}>Back</Btn>
              <Btn variant="success" style={{ flex: 1, justifyContent: "center" }} onClick={onClose}>Enter Exam</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
