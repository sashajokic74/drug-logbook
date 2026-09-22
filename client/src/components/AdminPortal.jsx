import { useState } from "react";
import AuditTrail from "./AuditTrail";
import DeviceSetup from "./DeviceSetup";
import LocationManagement from "./LocationManagement";
import StaffManagement from "./StaffManagement";
import { API_URL } from "../apiConfig";

function AdminPortal({ connectionOnline }) {
  const storedUser = JSON.parse(localStorage.getItem("user"));
  const [adminUser, setAdminUser] = useState(
    String(storedUser?.role || "").toLowerCase() === "admin" ? storedUser : null
  );
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("staff");
  const [message, setMessage] = useState("");

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
        setError(data.message || "Admin login failed");
        return;
      }

      if (String(data.user?.role || "").toLowerCase() !== "admin") {
        setError("Only admin users can open Admin Portal");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setAdminUser(data.user);
      setLoginForm({ username: "", password: "" });
    } catch {
      setError("Server not running");
    }
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setAdminUser(null);
    setActiveTab("staff");
  }

  function saveDevice(deviceData) {
    localStorage.setItem("device", JSON.stringify(deviceData));
    setMessage(
      `${deviceData.locationName} is now saved on this browser. Open the clinical logbook to use it.`
    );
  }

  if (!adminUser) {
    return (
      <main className="admin-portal-shell">
        <section className="admin-portal-login">
          {!connectionOnline && (
            <div className="connection-banner offline">
              Server connection lost. Admin setup is unavailable.
            </div>
          )}

          <span className="eyebrow">Admin Portal</span>
          <h1>System Administration</h1>
          <p>
            Manage staff, hospitals, clinical areas, iPad devices and audit
            separately from the clinical logbook.
          </p>

          <form className="login-form" onSubmit={login}>
            <input
              placeholder="Admin username"
              value={loginForm.username}
              onChange={(event) =>
                setLoginForm({ ...loginForm, username: event.target.value })
              }
            />

            <input
              type="password"
              placeholder="Admin password"
              value={loginForm.password}
              onChange={(event) =>
                setLoginForm({ ...loginForm, password: event.target.value })
              }
            />

            <button type="submit">Open Admin Portal</button>

            {error && <p className="form-error">{error}</p>}
          </form>

          <a className="portal-link" href="/">
            Return to Clinical Logbook
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-portal-shell">
      {!connectionOnline && (
        <div className="connection-banner offline">
          Server connection lost. Admin changes may not save.
        </div>
      )}

      <section className="admin-portal-header">
        <div>
          <span className="eyebrow">Admin Portal</span>
          <h1>System Administration</h1>
          <p>Staff, hospitals, locations, devices and audit.</p>
        </div>

        <div className="session-panel">
          <span>Logged in as</span>
          <strong>{adminUser.fullName || adminUser.username}</strong>
          <small>{adminUser.role}</small>
          <div className="session-actions">
            <a className="portal-link" href="/">
              Clinical Logbook
            </a>
            <a className="portal-link" href="/pharmacy">
              Pharmacy
            </a>
            <button type="button" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </section>

      <div className="admin-tabs" role="tablist" aria-label="Admin setup sections">
        <button
          type="button"
          className={activeTab === "staff" ? "active" : ""}
          onClick={() => setActiveTab("staff")}
        >
          Staff
        </button>
        <button
          type="button"
          className={activeTab === "locations" ? "active" : ""}
          onClick={() => setActiveTab("locations")}
        >
          Hospitals & Locations
        </button>
        <button
          type="button"
          className={activeTab === "devices" ? "active" : ""}
          onClick={() => setActiveTab("devices")}
        >
          Devices
        </button>
        <button
          type="button"
          className={activeTab === "audit" ? "active" : ""}
          onClick={() => setActiveTab("audit")}
        >
          Audit
        </button>
      </div>

      {message && <div className="connection-banner warning">{message}</div>}

      <section className="admin-portal-content">
        {activeTab === "staff" && <StaffManagement />}
        {activeTab === "locations" && <LocationManagement />}
        {activeTab === "devices" && (
          <DeviceSetup
            heading="Devices & iPad Assignment"
            intro="Select or create the saved iPad/device for a hospital and clinical area."
            canManageSetup
            onDeviceSaved={saveDevice}
          />
        )}
        {activeTab === "audit" && <AuditTrail />}
      </section>
    </main>
  );
}

export default AdminPortal;
