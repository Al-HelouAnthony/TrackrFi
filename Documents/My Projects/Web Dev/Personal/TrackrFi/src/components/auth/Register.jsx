import React, { useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export default function Register({ onRegisterSuccess, onToggleLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [monthlyBudget, setMonthlyBudget] = useState(null);
  const [step, setStep] = useState(1);
  const [currency, setCurrency] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      !name ||
      !email ||
      !password ||
      !confirmPassword ||
      !monthlyBudget ||
      !currency
    ) {
      setError("Please fill in all fields.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/auth/register`, {
        name,
        email,
        password,
        monthlyBudget,
        currency,
      });

      const data = response.data;

      // Save token and user details to localStorage
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      onRegisterSuccess(data.token, data.user);
    } catch (err) {
      // Axios stores the server error message in err.response.data
      setError(err.response?.data?.error || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const currencySymbols = {
    CAD: "CA$",
    USD: "$",
  };

  function getSymbol(code) {
    if (!code) return "";
    return currencySymbols[code?.toUpperCase()] || code;
  }

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

      {step === 1 && (
        <div
          style={{
            padding: "0 24px",
            textAlign: "center",
            marginBottom: "16px",
          }}
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
            Create account
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "14px", margin: 0 }}>
            Start managing your personal ledger securely
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ marginTop: "12px" }}>
        {step === 1 && (
          <>
            <div className="field">
              <label htmlFor="register-name">Full Name</label>
              <input
                id="register-name"
                type="text"
                placeholder="e.g. Maya Perez"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="field">
              <label htmlFor="register-email">Email Address</label>
              <input
                id="register-email"
                type="email"
                placeholder="e.g. maya@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="field">
              <label htmlFor="register-password">Password (min 6 chars)</label>
              <input
                id="register-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="field">
              <label htmlFor="register-confirm">Confirm Password</label>
              <input
                id="register-confirm"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <div style={{ padding: "12px 20px" }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={loading}
                style={{
                  opacity: loading ? 0.7 : 1,
                  transition: "opacity 0.2s",
                }}
                onClick={() => setStep(2)}
              >
                Next
              </button>
            </div>
          </>
        )}
        {/* ======================= */}
        {/* PAGE 2 (PREMIUM DESIGN) */}
        {/* ======================= */}
        {step === 2 && (
          <div
            style={{
              animation: "fadeIn 0.3s ease-out",
              paddingTop: "40px",
              paddingBottom: "20px",
            }}
          >
            {/* 1. The Premium Header Area (Slightly larger now that we have space) */}
            <div
              style={{
                padding: "0 20px",
                textAlign: "center",
                marginBottom: "40px",
              }}
            >
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  background: "var(--surface)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                  fontSize: "36px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
                  border: "1px solid var(--line)",
                }}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <circle cx="12" cy="12" r="6"></circle>
                  <circle cx="12" cy="12" r="2"></circle>
                </svg>
              </div>
              <h2
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: "28px",
                  margin: "0 0 12px",
                  color: "var(--ink)",
                  fontWeight: "600",
                }}
              >
                Set your target
              </h2>
              <p
                style={{
                  color: "var(--muted)",
                  fontSize: "15px",
                  margin: 0,
                  lineHeight: "1.6",
                  padding: "0 10px",
                }}
              >
                People who set a monthly spending limit save up to 30% more.
                What's your goal for this month?
              </p>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                marginBottom: "32px",
                gap: "8px",
              }}
            >
              <label
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "var(--ink)",
                }}
              >
                Default Currency
              </label>
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  width: "100%",
                  maxWidth: "280px",
                  margin: "0 auto",
                }}
              >
                {[
                  { code: "CAD", name: "Canadian Dollar" },
                  { code: "USD", name: "US Dollar" },
                ].map((cur) => (
                  <button
                    key={cur.code}
                    type="button"
                    onClick={() => setCurrency(cur.code)}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "10px 12px",
                      borderRadius: "16px",
                      border:
                        currency === cur.code
                          ? "1px solid var(--mint)"
                          : "1px solid var(--line)",
                      backgroundColor:
                        currency === cur.code
                          ? "var(--mint-soft)"
                          : "transparent",
                      color:
                        currency === cur.code
                          ? "var(--mint-dark)"
                          : "var(--ink)",
                      cursor: "pointer",
                      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "16px",
                        fontWeight: "700",
                        marginBottom: "2px",
                      }}
                    >
                      {cur.code}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        color:
                          currency === cur.code
                            ? "var(--mint-dark)"
                            : "var(--muted)",
                        opacity: currency === cur.code ? 0.8 : 1,
                      }}
                    >
                      {cur.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. The Upgraded Input Field */}
            <div
              className="field"
              style={{ padding: "0 20px", marginBottom: "20px" }}
            >
              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    left: "20px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--muted)",
                    fontSize: "24px",
                    fontWeight: "600",
                  }}
                >
                  {getSymbol(currency)}
                </span>

                <input
                  id="register-budget"
                  min="0"
                  step="0.01"
                  type="number"
                  placeholder="3,000.00"
                  value={monthlyBudget}
                  onChange={(e) =>
                    setMonthlyBudget(
                      e.target.value ? Math.abs(e.target.value) : "",
                    )
                  }
                  disabled={loading}
                  style={{
                    paddingLeft: currency === "CAD" ? "68px" : "38px",
                    fontSize: "24px",
                    fontWeight: "600",
                    height: "72px",
                    borderRadius: "20px",
                    backgroundColor: "var(--paper-dim)",
                    textAlign: "left",
                    transition:
                      "padding-left 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                />
              </div>

              {/* 🚀 NEW: Quick-Pick Budget Chips to fill the space! */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "12px",
                  marginTop: "20px",
                }}
              >
                {[1500, 3000, 5000].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setMonthlyBudget(amount)}
                    style={{
                      padding: "10px 20px",
                      borderRadius: "24px",
                      border:
                        monthlyBudget == amount
                          ? "1px solid var(--mint)"
                          : "1px solid var(--line)",
                      backgroundColor:
                        monthlyBudget == amount
                          ? "var(--mint-soft)"
                          : "transparent",
                      color:
                        monthlyBudget == amount
                          ? "var(--mint-dark)"
                          : "var(--muted)",
                      fontSize: "15px",
                      fontWeight: "600",
                      cursor: "pointer",
                      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  >
                    {getSymbol(currency)}
                    {amount.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. The Buttons */}
            <div
              style={{
                padding: "32px 20px 12px",
                display: "flex",
                gap: "16px",
              }}
            >
              <button
                type="button"
                className="btn"
                style={{
                  flex: 1,
                  backgroundColor: "var(--surface)",
                  color: "var(--ink)",
                  border: "1px solid var(--line)",
                  fontWeight: "600",
                  height: "56px",
                }}
                onClick={() => setStep(1)}
                disabled={loading}
              >
                Back
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  flex: 2,
                  opacity: loading ? 0.7 : 1,
                  transition: "opacity 0.2s",
                  fontWeight: "600",
                  height: "56px",
                }}
                disabled={loading}
              >
                {loading ? "Creating..." : "Register"}
              </button>
            </div>
          </div>
        )}
      </form>

      <div style={{ textAlign: "center", marginTop: "24px", fontSize: "16px" }}>
        <span style={{ color: "var(--muted)" }}>Already have an account? </span>
        <button
          type="button"
          onClick={onToggleLogin}
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
          Sign in
        </button>
      </div>
    </div>
  );
}
