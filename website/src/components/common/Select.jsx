import { C } from "../../theme/colors";

export default function Select({ label, children, value, onChange }) {
  return (
    <div style={{ marginBottom: 18 }}>
      {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.grey800, marginBottom: 6 }}>{label}</label>}
      <select value={value} onChange={onChange} style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: `1.5px solid ${C.grey200}`, fontSize: 14, color: C.grey800, background: C.grey50, outline: "none", boxSizing: "border-box" }}>
        {children}
      </select>
    </div>
  );
}
