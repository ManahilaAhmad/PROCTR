import { useState } from "react";
import { C } from "../theme/colors";
import { Icon } from "../theme/icons";
import Input from "../components/common/Input";
import { API_BASE_URL } from "../config/apiConfig";

export default function ForgotPasswordPage({ setPage }) {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (!identifier.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "The request could not be completed.");
      setMessage(data.message || "If an active account matches, a reset link has been sent.");
    } catch (requestError) {
      setError(requestError.message || "Unable to reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-bg" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: `linear-gradient(135deg, ${C.navyDark}, ${C.navy} 55%, #1a3a5c)`, padding: "28px 0", boxSizing: "border-box" }}>
      <div className="login-card" style={{ width: "100%", maxWidth: 460, margin: "0 24px", padding: "42px 38px", boxSizing: "border-box", background: "rgba(255,255,255,.98)", borderRadius: 24, boxShadow: "0 32px 80px rgba(0,0,0,.35)" }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: C.tealLight, color: C.teal, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 22 }}>{Icon.lock}</div>
        <h1 style={{ fontSize: 24, color: C.navy, margin: "0 0 8px" }}>Forgot your password?</h1>
        <p style={{ color: C.grey500, fontSize: 14, lineHeight: 1.6, margin: "0 0 26px" }}>Enter your university email address or student registration number. We will email the account owner a secure reset link.</p>

        {message ? (
          <div role="status" style={{ background: C.greenLight, color: C.grey800, padding: 16, borderRadius: 10, fontSize: 14, lineHeight: 1.55, marginBottom: 22 }}>{message} Please also check your spam folder.</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <Input label="Email or registration number" type="text" placeholder="you@gmail.com or 231593" iconEl={Icon.mail} value={identifier} onChange={(event) => setIdentifier(event.target.value)} />
            {error && <p role="alert" style={{ color: C.red, fontSize: 13, margin: "-4px 0 14px" }}>{error}</p>}
            <button className="sign-btn" type="submit" disabled={loading || !identifier.trim()} style={{ width: "100%", padding: 13, borderRadius: 10, border: 0, background: loading || !identifier.trim() ? C.grey200 : C.navy, color: loading || !identifier.trim() ? C.grey400 : C.white, fontWeight: 700, cursor: loading ? "wait" : "pointer" }}>
              {loading ? "Sending secure link..." : "Send reset link"}
            </button>
          </form>
        )}

        <button type="button" onClick={() => setPage("login")} style={{ display: "block", width: "100%", marginTop: 20, border: 0, background: "transparent", color: C.teal, fontWeight: 700, cursor: "pointer" }}>Back to sign in</button>
      </div>
    </div>
  );
}
