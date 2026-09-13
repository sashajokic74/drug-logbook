import { useState } from "react";
import { API_URL } from "../apiConfig";
import PharmacyDashboard from "./PharmacyDashboard";

function isPharmacyRole(role) {
  const value = String(role || "").toLowerCase();
  return value === "pharmacy" || value === "pharmacist";
}

function PharmacyPortal({ connectionOnline }) {
  const [user, setUser] = useState(() => {
    const savedUser = JSON.parse(localStorage.getItem("user") || "null");
    return isPharmacyRole(savedUser?.role) ? savedUser : null;
  });
  const [loginForm, setLoginForm] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState("");

  async function login(event) {
    event.preventDefault();
    setError("");

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginForm),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Login failed");
        return;
      }

      if (!isPharmacyRole(data.user?.role)) {
        setError("Only Pharmacy users can open the Pharmacy Portal");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);
      setLoginForm({ username: "", password: "" });
    } catch {
      setError("Server not running");
    }
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }

  if (!user) {
    return (
      <main className="pharmacy-portal-shell">
        <section className="pharmacy-login-card">
          {!connectionOnline && (
            <div className="connection-banner offline">
              Server connection lost. Pharmacy requests cannot load.
            </div>
          )}

          <span className="eyebrow">Controlled drug supply</span>
          <h1>Pharmacy Portal</h1>
          <p>Review, approve or reject controlled drug requisitions from clinical areas.</p>

          <form className="login-form" onSubmit={login}>
            <h2>Pharmacy Login</h2>

            <input
              placeholder="Pharmacy username"
              value={loginForm.username}
              onChange={(event) =>
                setLoginForm({
                  ...loginForm,
                  username: event.target.value,
                })
              }
            />

            <input
              type="password"
              placeholder="Password"
              value={loginForm.password}
              onChange={(event) =>
                setLoginForm({
                  ...loginForm,
                  password: event.target.value,
                })
              }
            />

            <button type="submit">Open Pharmacy Dashboard</button>

            {error && <p className="form-error">{error}</p>}
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="pharmacy-portal-page">
      <header className="pharmacy-portal-header">
        <div>
          <span className="eyebrow">Controlled drug supply</span>
          <h1>Pharmacy Portal</h1>
          <p>Live requisitions from all connected hospital locations.</p>
        </div>

        <div className="session-panel">
          <span>Logged in as</span>
          <strong>{user.fullName || user.username}</strong>
          <small>{user.role}</small>
          <button type="button" onClick={logout}>Logout</button>
        </div>
      </header>

      <PharmacyDashboard user={user} portalMode />
    </main>
  );
}

export default PharmacyPortal;
