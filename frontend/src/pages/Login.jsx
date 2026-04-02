import { useState } from "react";
import { apiPost } from "../utils/apiClient";
import { getMsalApp, isMicrosoftLoginConfigured } from "../auth/msal";
import { useEffect, useRef } from "react";
import "../../styles/Login.css";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetUsername, setResetUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const googleBtnRef = useRef(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!googleClientId) return;
    const g = window.google;
    if (!g?.accounts?.id || !googleBtnRef.current) return;
    g.accounts.id.initialize({
      client_id: googleClientId,
      callback: async (resp) => {
        try {
          const res = await apiPost("/api/auth/google", { idToken: resp.credential }, { timeout: 10000 });
          onLogin?.(res.data);
        } catch (err) {
          setError(err.response?.data?.error || "Google login failed");
        }
      }
    });
    googleBtnRef.current.innerHTML = "";
    g.accounts.id.renderButton(googleBtnRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      width: 330,
      text: "signin_with"
    });
  }, [googleClientId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiPost("/api/auth/login", { email, password }, { timeout: 6000 });
      onLogin?.(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    try {
      setError("");
      const app = getMsalApp();
      const response = await app.loginPopup({ scopes: ["openid", "profile", "email"] });
      const idToken = response.idToken;
      const res = await apiPost("/api/auth/microsoft", { idToken }, { timeout: 10000 });
      onLogin?.(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Microsoft login failed");
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetMsg("");
    try {
      await apiPost(
        "/api/auth/reset-password",
        { email: resetUsername, currentPassword, newPassword },
        { timeout: 6000 }
      );
      setResetMsg("Password reset successful. You can log in now.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setResetMsg(err.response?.data?.error || "Failed to reset password");
    }
  };

  return (
    <div className="login-page">
      <h1 className="login-main-title">Campaign Performance Dashboard</h1>
      <div className="login-shell">
        <div className="login-card">
        <h2>Dashboard Login</h2>
        <form onSubmit={handleSubmit}>
          <label>Email</label>
          <input className="login-input" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label>Password</label>
          <input className="login-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error ? <div className="login-error">{error}</div> : null}
          <button type="submit" disabled={loading} className="login-btn primary">
            {loading ? "Signing in..." : "Login"}
          </button>
          {googleClientId ? <div ref={googleBtnRef} className="login-google-wrap" /> : null}
          {isMicrosoftLoginConfigured() ? (
            <button
              type="button"
              onClick={handleMicrosoftLogin}
              className="login-btn secondary"
            >
              Sign in with Microsoft
            </button>
          ) : null}
        </form>

        <button type="button" onClick={() => setResetOpen((v) => !v)} className="login-link-btn">
          {resetOpen ? "Hide Reset Password" : "Reset Password"}
        </button>

        {resetOpen ? (
          <form onSubmit={handleResetPassword} className="login-reset">
            <label>Email</label>
            <input className="login-input" value={resetUsername} onChange={(e) => setResetUsername(e.target.value)} />
            <label>Current Password</label>
            <input className="login-input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            <label>New Password</label>
            <input className="login-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <button type="submit" className="login-btn primary">Update Password</button>
            {resetMsg ? <div className={`login-reset-msg ${resetMsg.includes("successful") ? "ok" : "err"}`}>{resetMsg}</div> : null}
          </form>
        ) : null}
      </div>
      </div>
    </div>
  );
}


