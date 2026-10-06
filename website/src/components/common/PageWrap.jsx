import { C } from "../../theme/colors";

export default function PageWrap({ title, subtitle, children, actions }) {
  return (
    <div style={{ flex: 1, background: C.grey50, minHeight: "100vh", overflow: "auto" }}>
      <div className="resp-page-padding">
        <div className="resp-flex-space-between" style={{ alignItems: "flex-start", marginBottom: 30 }}>
          <div style={{ animation: "slideInLeft .4s cubic-bezier(.22,.68,0,1.1) both" }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.navy, letterSpacing: -0.5 }}>{title}</h1>
            {subtitle && <p style={{ margin: "5px 0 0", color: C.grey500, fontSize: 14 }}>{subtitle}</p>}
          </div>
          {actions && <div style={{ display: "flex", gap: 10, animation: "slideInRight .4s cubic-bezier(.22,.68,0,1.1) both", flexWrap: "wrap" }}>{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}
