import { C } from "../../theme/colors";

export default function Table({ columns, rows }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: C.grey50, borderBottom: `2px solid ${C.grey200}` }}>
            {columns.map((c) => (
              <th key={c} style={{ padding: "11px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.grey500, letterSpacing: 0.5, textTransform: "uppercase" }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${C.grey100}`, animation: `rowIn .28s ease ${i * 40}ms both` }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: "13px 16px", fontSize: 14, color: C.grey800 }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
