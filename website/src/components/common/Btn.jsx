import { C } from "../../theme/colors";

export default function Btn({ children, variant = "primary", onClick, style = {}, size = "md" }) {
  const pad = size === "sm" ? "7px 16px" : size === "lg" ? "13px 28px" : "9px 20px";
  const base = { border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: size === "sm" ? 13 : 14, padding: pad, transition: "opacity .15s", display: "inline-flex", alignItems: "center", gap: 6, ...style };
  const variants = {
    primary: { background: C.teal, color: C.white },
    navy: { background: C.navy, color: C.white },
    outline: { background: "transparent", color: C.navy, border: `2px solid ${C.navy}` },
    ghost: { background: "transparent", color: C.grey500, border: `1.5px solid ${C.grey200}` },
    danger: { background: C.red, color: C.white },
    success: { background: C.green, color: C.white },
  };
  return <button style={{ ...base, ...variants[variant] }} onClick={onClick}>{children}</button>;
}
