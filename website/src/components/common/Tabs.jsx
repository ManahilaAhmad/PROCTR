import { C } from "../../theme/colors";

export default function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 28, borderBottom: `2px solid ${C.grey200}`, paddingBottom: 0 }}>
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          style={{ padding: "10px 20px", border: "none", background: "none", cursor: "pointer", fontWeight: 700, fontSize: 14, color: active === t.id ? C.teal : C.grey500, borderBottom: `2px solid ${active === t.id ? C.teal : "transparent"}`, marginBottom: -2, transition: "all .15s" }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
