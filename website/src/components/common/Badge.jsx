import { C } from "../../theme/colors";

export default function Badge({ children, color, bg }) {
  const isDefaultColor = color === undefined && bg === undefined;
  return (
    <span className={isDefaultColor ? "proctr-badge-default" : undefined} style={{ background: bg ?? C.tealLight, color: color ?? C.teal, fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, letterSpacing: 0.4, textTransform: "uppercase" }}>
      {children}
    </span>
  );
}
