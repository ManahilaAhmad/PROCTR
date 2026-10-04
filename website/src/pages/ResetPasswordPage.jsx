import { useEffect, useState } from "react";
import { C } from "../theme/colors";
import { Icon } from "../theme/icons";
import Input from "../components/common/Input";
import { API_BASE_URL } from "../config/apiConfig";

export default function ResetPasswordPage({ token, setPage }) {
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/auth/reset-password/validate?token=${encodeURIComponent(token || "")}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.valid) throw new Error(data.message || "This password reset link is invalid or has expired.");
        setValid(true);
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message || "This password reset link is invalid or has expired.");
      })
      .finally(() => setChecking(false));
    return () => controller.abort();
  }, [token]);

  async function handleReset(event) {
    event.preventDefault();
    setError("");
    if (password.length < 8) return setError("Password must contain at least 8 characters.");
    if (password !== confirmPassword) return setError("The password confirmation does not match.");
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password, confirm_password: confirmPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 400) setValid(false);
        throw new Error(data.message || "The password could not be reset.");
      }
      window.history.replaceState({}, "", window.location.pathname);
      setComplete(true);
    } catch (requestError) {
      setError(requestError.message || "Unable to reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-bg" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: `linear-gradient(135deg, ${C.navyDark}, ${C.navy} 55%, #1a3a5c)`, padding: "28px 0", boxSizing: "border-box" }}>
      <div className="login-card" style={{ width: "100%", maxWidth: 460, margin: "0 24px", padding: "42px 38px", boxSizing: "border-box", background: "rgba(255,255,255,.98)", borderRadius: 24, boxShadow: "0 32px 80px rgba(0,0,0,.35)" }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: C.tealLight, color: C.teal, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 22 }}>{Icon.shield}</div>
        <h1 style={{ fontSize: 24, color: C.navy, margin: "0 0 8px" }}>{complete ? "Password updated" : "Create a new password"}</h1>
        {checking && <p style={{ color: C.grey500, fontSize: 14 }}>Checking your secure reset link...</p>}

        {!checking && complete && <><p style={{ color: C.grey500, fontSize: 14, lineHeight: 1.6 }}>Your password has been reset and previous login sessions have been signed out.</p><button type="button" className="sign-btn" onClick={() => setPage("login")} style={{ width: "100%", marginTop: 16, padding: 13, borderRadius: 10, border: 0, background: C.navy, color: C.white, fontWeight: 700, cursor: "pointer" }}>Sign in</button></>}

        {!checking && !complete && valid && (
          <form onSubmit={handleReset}>
            <p style={{ color: C.grey500, fontSize: 14, lineHeight: 1.6, margin: "0 0 24px" }}>Use at least 8 characters. This link will stop working after a successful reset.</p>
            <Input label="New password" type="password" placeholder="At least 8 characters" iconEl={Icon.lock} value={password} onChange={(event) => setPassword(event.target.value)} />
            <Input label="Confirm new password" type="password" placeholder="Repeat your password" iconEl={Icon.lock} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            {error && <p role="alert" style={{ color: C.red, fontSize: 13, margin: "-4px 0 14px" }}>{error}</p>}
            <button type="submit" className="sign-btn" disabled={loading} style={{ width: "100%", padding: 13, borderRadius: 10, border: 0, background: loading ? C.grey200 : C.navy, color: loading ? C.grey400 : C.white, fontWeight: 700, cursor: loading ? "wait" : "pointer" }}>{loading ? "Updating password..." : "Reset password"}</button>
          </form>
        )}

        {!checking && !complete && !valid && <><p role="alert" style={{ background: C.redLight, color: C.red, padding: 14, borderRadius: 10, fontSize: 14, lineHeight: 1.5 }}>{error}</p><button type="button" onClick={() => setPage("forgot-password")} style={{ width: "100%", padding: 13, borderRadius: 10, border: 0, background: C.navy, color: C.white, fontWeight: 700, cursor: "pointer" }}>Request a new link</button></>}
      </div>
    </div>
  );
}
