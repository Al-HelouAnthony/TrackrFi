import React, { useState, useEffect } from "react";
import Login from "./components/auth/Login.jsx";
import Register from "./components/auth/Register.jsx";
import HomeSkeleton from "./components/HomeSkeleton.jsx";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export default function App() {
  const [view, setView] = useState("loading"); // 'loading', 'login', 'register', 'home'
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  // Auto-login if JWT exists in localStorage
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("demo") === "true") {
      setView("loading");
      fetch(`${API_URL}/auth/demo`, { method: "POST" })
        .then((res) => res.json())
        .then((data) => {
          if (data.token) {
            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));
            setToken(data.token);
            setUser(data.user);
            setView("home");
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            setView("login");
          }
        })
        .catch(() => setView("login"));
      return;
    }

    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      setView("home");

      // Verify token is still valid on backend
      fetch(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${savedToken}`,
        },
      })
        .then((res) => {
          if (!res.ok) {
            handleLogout();
          } else {
            return res.json();
          }
        })
        .then((data) => {
          if (data && data.user) {
            setUser(data.user);
            localStorage.setItem("user", JSON.stringify(data.user));
          }
        })
        .catch((err) => {
          console.error("Auth verification error:", err);
        });
    } else {
      setView("login");
    }
  }, []);

  const handleLoginSuccess = (userToken, userData) => {
    setToken(userToken);
    setUser(userData);
    setView("home");
  };

  const handleRegisterSuccess = (userToken, userData) => {
    setToken(userToken);
    setUser(userData);
    setView("home");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    setView("login");
  };

  if (view === "loading") {
    return (
      <div
        className="frame"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "780px",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div className="spinner"></div>
          <p
            style={{
              color: "var(--muted)",
              fontSize: "14px",
              fontFamily: "var(--mono)",
            }}
          >
            Verifying session...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {view === "login" && (
        <div className="frame">
          <Login
            onLoginSuccess={handleLoginSuccess}
            onToggleRegister={() => setView("register")}
          />
        </div>
      )}

      {view === "register" && (
        <div className="frame">
          <Register
            onRegisterSuccess={handleRegisterSuccess}
            onToggleLogin={() => setView("login")}
          />
        </div>
      )}

      {view === "home" && (
        <HomeSkeleton token={token} user={user} onLogout={handleLogout} />
      )}
    </div>
  );
}
