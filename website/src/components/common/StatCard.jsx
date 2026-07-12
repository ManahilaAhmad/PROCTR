import { C } from "../../theme/colors";
import Card from "./Card";

export default function StatCard({ label, value, icon, accent = C.teal, light = C.tealLight, delay = 0 }) {
  return (
    <div className="stat-card" style={{ animationDelay: `${delay}ms` }}>
      <Card style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: light, display: "flex", alignItems: "center", justifyContent: "center", color: accent, flexShrink: 0 }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.navy, lineHeight: 1.1 }}>{value}</div>
          <div style={{ fontSize: 13, color: C.grey500, marginTop: 3 }}>{label}</div>
        </div>
      </Card>
    </div>
  );
}
