import { C } from "../../theme/colors";

export default function Input({ label, type = "text", placeholder, value, onChange, iconEl }) {
  return (
    <div style={{ marginBottom: 18 }}>
      {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.grey800, marginBottom: 6 }}>{label}</label>}
      <div style={{ position: "relative" }}>
        {iconEl && <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.grey400, display: "flex" }}>{iconEl}</span>}
        <input type={type} placeholder={placeholder} value={value} onChange={onChange}
          style={{ width: "100%", padding: iconEl ? "11px 14px 11px 40px" : "11px 14px", borderRadius: 8, border: `1.5px solid ${C.grey200}`, fontSize: 14, color: C.grey800, outline: "none", background: C.grey50, boxSizing: "border-box" }} />
      </div>
    </div>
  );
}
