import { useEffect, useState } from "react";
import AdminPortal from "./components/AdminPortal";
import ControlledDrugLogbook from "./components/ControlledDrugLogbook";
import StockChecks from "./components/StockChecks";
import Corrections from "./components/Corrections";
import PharmacyDashboard from "./components/PharmacyDashboard";
import PharmacyPortal from "./components/PharmacyPortal";
import "./index.css";

import { API_URL } from "./apiConfig";
const INACTIVITY_LIMIT_MS = 15 * 60 * 1000;

function readStoredJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function normaliseDevice(deviceData) {
  if (!deviceData) return null;

  return {
    id: deviceData.id,
    deviceName: deviceData.deviceName,
    deviceCode: deviceData.deviceCode,
    hospitalId: String(deviceData.hospitalId),
    hospitalName: deviceData.hospitalName,
    locationId: String(deviceData.locationId),
    locationName: deviceData.locationName,
    deviceType: deviceData.deviceType || "iPad",
  };
}

function App() {
  const isAdminPortal = window.location.pathname.startsWith("/admin");
  const isPharmacyPortal = window.location.pathname.startsWith("/pharmacy");
  const [device, setDevice] = useState(readStoredJson("device"));
  const [deviceRestoreMessage, setDeviceRestoreMessage] = useState("");

  const [user, setUser] = useState(readStoredJson("user"));

  const [loginForm, setLoginForm] = useState({
    username: "",
    password: "",
  });

  const [showStockChecks, setShowStockChecks] = useState(false);
  const [showCorrections, setShowCorrections] = useState(false);
  const [showPharmacyDashboard, setShowPharmacyDashboard] = useState(false);

  const [error, setError] = useState("");
  const [connectionOnline, setConnectionOnline] = useState(true);
  const [sessionNotice, setSessionNotice] = useState("");
  const activeTask = showStockChecks
      ? "stock"
      : showCorrections
        ? "corrections"
        : showPharmacyDashboard
          ? "pharmacy"
          : "logbook";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const deviceCode = params.get("device");

    if (!deviceCode) return undefined;

    let mounted = true;

    async function restoreDeviceFromLink() {
      setDeviceRestoreMessage("Restoring saved device...");

      try {
        const response = await fetch(
          `${API_URL}/device-setup/device/${encodeURIComponent(deviceCode)}`,
          { cache: "no-store" }
        );
        const data = await response.json();

        if (!mounted) return;

        if (!response.ok) {
          setDeviceRestoreMessage(data.message || "Saved device link not found");
          return;
        }

        const restoredDevice = normaliseDevice(data);
        localStorage.setItem("device", JSON.stringify(restoredDevice));
        setDevice(restoredDevice);
        setDeviceRestoreMessage("");
      } catch {
        if (mounted) {
          setDeviceRestoreMessage("Could not restore saved device");
        }
      }
    }

    restoreDeviceFromLink();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function checkConnection() {
      try {
        const response = await fetch(`${API_URL}/health`, {
          cache: "no-store",
        });

        if (mounted) {
          setConnectionOnline(response.ok);
        }
      } catch {
        if (mounted) {
          setConnectionOnline(false);
        }
      }
    }

    checkConnection();
    const intervalId = window.setInterval(checkConnection, 30000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    let timeoutId;

    function endInactiveSession() {
      setSessionNotice("Session timed out after inactivity. Please log in again.");
      logout();
    }

    function resetTimer() {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(endInactiveSession, INACTIVITY_LIMIT_MS);
    }

    const activityEvents = ["click", "keydown", "touchstart", "mousemove"];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetTimer, { passive: true });
    });

    resetTimer();

    return () => {
      window.clearTimeout(timeoutId);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimer);
      });
    };
  }, [user]);

  function showOnly(panel) {
    setShowStockChecks(panel === "stock");
    setShowCorrections(panel === "corrections");
    setShowPharmacyDashboard(panel === "pharmacy");
  }

  function returnToLogbook() {
    showOnly("");
  }

  async function login(event) {
    event.preventDefault();

    setError("");

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...loginForm,
          hospitalId: device?.hospitalId,
          hospitalName: device?.hospitalName,
          locationId: device?.locationId,
          locationName: device?.locationName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Login failed");
        return;
      }

      if (
        !device &&
        String(data.user?.role || "").toLowerCase() !== "admin"
      ) {
        setError("Admin login is required for device setup");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );

      setUser(data.user);
      setSessionNotice("");
    } catch {
      setError("Server not running");
    }
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setUser(null);

    setShowStockChecks(false);
    setShowCorrections(false);
    setShowPharmacyDashboard(false);
  }

  if (isAdminPortal) {
    return <AdminPortal connectionOnline={connectionOnline} />;
  }

  if (isPharmacyPortal) {
    return <PharmacyPortal connectionOnline={connectionOnline} />;
  }

  if (!device) {
    return (
      <main className="missing-device-shell">
        {!connectionOnline && (
          <div className="connection-banner offline">
            Server connection lost. Device setup is unavailable.
          </div>
        )}

        <section className="missing-device-card">
          <span className="eyebrow">Clinical logbook</span>
          <h1>Device Not Configured</h1>
          {deviceRestoreMessage && (
            <p className="form-error">{deviceRestoreMessage}</p>
          )}
          <p>
            This browser has not been assigned to a hospital, clinical area or
            iPad/device yet. Admin must configure the device before staff can
            use the logbook.
          </p>
          <a className="portal-link primary" href="/admin">
            Open Admin Portal
          </a>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <div className="login-shell">
        <section className="device-login-card">
          {!connectionOnline && (
            <div className="connection-banner offline">
              Server connection lost. Login and saving are unavailable.
            </div>
          )}

          {sessionNotice && (
            <div className="connection-banner warning">
              {sessionNotice}
            </div>
          )}

          <div className="device-login-header">
            <span className="eyebrow">Controlled drug logbook</span>
            <h1>{device.locationName}</h1>
            <p>{device.hospitalName}</p>
          </div>

          <div className="device-lock-panel">
            <div>
              <span>Device locked to</span>
              <strong>{device.deviceName || `${device.locationName} iPad`}</strong>
            </div>
            <small>{device.deviceType || "iPad"} · {device.deviceCode || "Saved device"}</small>
          </div>

          <form className="login-form" onSubmit={login}>
            <h2>Staff Login</h2>

            <input
              placeholder="Username"
              value={loginForm.username}
              onChange={(e) =>
                setLoginForm({
                  ...loginForm,
                  username: e.target.value,
                })
              }
            />

            <input
              type="password"
              placeholder="Password"
              value={loginForm.password}
              onChange={(e) =>
                setLoginForm({
                  ...loginForm,
                  password: e.target.value,
                })
              }
            />

            <button>
              Enter Logbook
            </button>

            {error && (
              <p className="form-error">
                {error}
              </p>
            )}
          </form>
        </section>

      </div>
    );
  }

  return (
    <div className="app">
      {!connectionOnline && (
        <div className="connection-banner offline">
          Server connection lost. Do not continue clinical entries until connection is restored.
        </div>
      )}

      <header className="app-header">
        <div className="location-banner">
          <div>
            <span className="location-label">
              Current clinical area
            </span>
            <h1>{device.locationName}</h1>
            <p>{device.hospitalName}</p>
            <div className="device-context-row">
              <span>{device.deviceName || `${device.locationName} iPad`}</span>
              <span>{device.deviceType || "iPad"}</span>
              <span>{device.deviceCode || "Saved device"}</span>
            </div>
          </div>

          <div className="session-panel">
            <span>Logged in as</span>
            <strong>{user.fullName || user.username}</strong>
            <small>{user.role}</small>

            <div className="session-actions">
              <button onClick={logout}>
                Logout
              </button>
            </div>
          </div>
        </div>

        <div className="clinical-task-grid" aria-label="Clinical task navigation">
          <button
            type="button"
            className={activeTask === "logbook" ? "active" : ""}
            onClick={returnToLogbook}
          >
            <span>Register</span>
            <strong>Main Logbook</strong>
            <small>Drug cards and patient entries</small>
          </button>

          <button
            type="button"
            className={activeTask === "stock" ? "active" : ""}
            onClick={() =>
              showStockChecks
                ? showOnly("")
                : showOnly("stock")
            }
          >
            <span>Check</span>
            <strong>Stock Checks</strong>
            <small>Daily, shift and discrepancy checks</small>
          </button>

          <button
            type="button"
            className={activeTask === "corrections" ? "active" : ""}
            onClick={() =>
              showCorrections
                ? showOnly("")
                : showOnly("corrections")
            }
          >
            <span>Correct</span>
            <strong>Corrections</strong>
            <small>Signed amendments and reversals</small>
          </button>

          <button
            type="button"
            className={activeTask === "pharmacy" ? "active" : ""}
            onClick={() =>
              showPharmacyDashboard
                ? showOnly("")
                : showOnly("pharmacy")
            }
          >
            <span>Supply</span>
            <strong>Pharmacy Requests</strong>
            <small>Requests, approvals and status</small>
          </button>

        </div>

      </header>


      {showStockChecks && (
        <StockChecks device={device} />
      )}


      {showCorrections && (
        <Corrections device={device} />
      )}


      {showPharmacyDashboard && (
        <PharmacyDashboard device={device} user={user} />
      )}


      {!showStockChecks &&
        !showCorrections &&
        !showPharmacyDashboard && (
          <ControlledDrugLogbook device={device} user={user} />
        )}

    </div>
  );
}

export default App;
