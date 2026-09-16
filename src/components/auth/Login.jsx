import React, { useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export default function Login({ onLoginSuccess, onToggleRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // Use Axios for the login request
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      });

      const data = response.data;

      // Save token and user details to localStorage
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      onLoginSuccess(data.token, data.user);
    } catch (err) {
      // Axios stores the server error message in err.response.data
      setError(
        err.response?.data?.error || "Login failed. Please check credentials.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="screen active"
      style={{ paddingTop: "60px", paddingBottom: "40px" }}
    >
      {error && (
        <div
          style={{
            position: "fixed",
            top: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            width: "calc(100% - 48px)",
            maxWidth: "400px",
            padding: "16px 20px",
            backgroundColor: "var(--surface)",
            border: "1px solid var(--line)",
            borderLeft: "4px solid var(--coral)",
            borderRadius: "12px",
            color: "var(--ink)",
            fontSize: "14px",
            fontWeight: "600",
            lineHeight: "1.5",
            boxShadow: "0 12px 32px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(239, 68, 68, 0.12)",
            animation: "slideDownFade 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
            textAlign: "left",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--coral)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          {error}
        </div>
      )}
      <div
        style={{ padding: "0 24px", textAlign: "center", marginBottom: "24px" }}
      >
        <div>
          <img
            style={{
              height: "80px",
              width: "auto",
              objectFit: "contain",
              filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.08))",
            }}
            src="/Trackrfi_logo.png"
            alt="TrackrFi Logo"
          />
        </div>
        <h1
          style={{
            fontFamily: "var(--serif)",
            fontSize: "32px",
            margin: "0 0 6px",
            fontWeight: "600",
          }}
        >
          Welcome back
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "14px", margin: 0 }}>
          Sign in to secure your budget tracker
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ marginTop: "12px" }}>
        <div className="field">
          <label htmlFor="login-email">Email Address</label>
          <input
            id="login-email"
            type="email"
            placeholder="e.g. maya@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        <div style={{ padding: "12px 20px" }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ opacity: loading ? 0.7 : 1, transition: "opacity 0.2s" }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </div>
      </form>

      <div style={{ textAlign: "center", marginTop: "24px", fontSize: "16px" }}>
        <span style={{ color: "var(--muted)" }}>Don't have an account? </span>
        <button
          type="button"
          onClick={onToggleRegister}
          style={{
            background: "none",
            border: "none",
            color: "var(--mint)",
            fontWeight: "600",
            cursor: "pointer",
            padding: 0,
            fontFamily: "inherit",
            fontSize: "16px",
          }}
        >
          Create account
        </button>
      </div>
    </div>
  );
}
