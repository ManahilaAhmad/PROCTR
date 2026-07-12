import { C } from "../../theme/colors";

export default function Badge({ children, color = C.teal, bg = C.tealLight }) {
  return (
    <span style={{ background: bg, color, fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, letterSpacing: 0.4, textTransform: "uppercase" }}>
      {children}
    </span>
  );
}
