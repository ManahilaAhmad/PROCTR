import { C } from "../../theme/colors";

export default function Card({ children, style = {} }) {
  return (
    <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.grey200}`, padding: 24, ...style }}>
      {children}
    </div>
  );
}
