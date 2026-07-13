import { useState } from "react";
import ControlledDrugLogbook from "./components/ControlledDrugLogbook";
import StaffManagement from "./components/StaffManagement";
import StockChecks from "./components/StockChecks";
import Corrections from "./components/Corrections";
import LocationManagement from "./components/LocationManagement";
import DeviceSetup from "./components/DeviceSetup";
import PharmacyDashboard from "./components/PharmacyDashboard";
import AuditTrail from "./components/AuditTrail";
import "./index.css";

const API_URL = "http://localhost:8000";

function App() {
  const [device, setDevice] = useState(
    JSON.parse(localStorage.getItem("device"))
  );

  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("user"))
  );

  const [loginForm, setLoginForm] = useState({
    username: "",
    password: "",
  });

  const [showStaffPanel, setShowStaffPanel] = useState(false);
  const [showStockChecks, setShowStockChecks] = useState(false);
  const [showCorrections, setShowCorrections] = useState(false);
  const [showLocations, setShowLocations] = useState(false);
  const [showPharmacyDashboard, setShowPharmacyDashboard] = useState(false);
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [showAdminSetup, setShowAdminSetup] = useState(false);
  const [adminSetupTab, setAdminSetupTab] = useState("staff");
  const [showDeviceSetup, setShowDeviceSetup] = useState(false);
  const [locationSetupAdmin, setLocationSetupAdmin] = useState(false);
  const [showLocationAuth, setShowLocationAuth] = useState(false);
  const [locationAuthForm, setLocationAuthForm] = useState({
    username: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [locationAuthError, setLocationAuthError] = useState("");
  const isAdmin = String(user?.role || "").toLowerCase() === "admin";
  const isPanelOpen =
    showStaffPanel ||
    showStockChecks ||
    showCorrections ||
    showLocations ||
    showPharmacyDashboard ||
    showAuditTrail ||
    showAdminSetup;

  function showOnly(panel) {
    setShowStaffPanel(panel === "staff");
    setShowStockChecks(panel === "stock");
    setShowCorrections(panel === "corrections");
    setShowLocations(panel === "locations");
    setShowPharmacyDashboard(panel === "pharmacy");
    setShowAuditTrail(panel === "audit");
    setShowAdminSetup(panel === "admin");
  }

  function openAdminSetup(tab = "staff") {
    setAdminSetupTab(tab);
    showOnly("admin");
  }

  function returnToLogbook() {
    showOnly("");
    setShowDeviceSetup(false);
    setShowLocationAuth(false);
    setLocationSetupAdmin(false);
    setLocationAuthForm({ username: "", password: "" });
    setLocationAuthError("");
  }

  function saveDevice(deviceData) {
    setDevice(deviceData);
  }

  function saveChangedDevice(deviceData) {
    localStorage.setItem("device", JSON.stringify(deviceData));
    setDevice(deviceData);
    setShowDeviceSetup(false);
    setShowAdminSetup(false);
    setAdminSetupTab("staff");
    setLocationSetupAdmin(false);
    setShowLocationAuth(false);
    setLocationAuthForm({ username: "", password: "" });
    logout();
  }

  function openLocationChange() {
    setLocationAuthError("");

    if (isAdmin) {
      setLocationSetupAdmin(true);
      openAdminSetup("staff");
      return;
    }

    setShowLocationAuth(true);
  }

  async function verifyLocationChangeAdmin(event) {
    event.preventDefault();
    setLocationAuthError("");

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(locationAuthForm),
      });

      const data = await response.json();

      if (!response.ok) {
        setLocationAuthError(data.message || "Admin verification failed");
        return;
      }

      if (String(data.user?.role || "").toLowerCase() !== "admin") {
        setLocationAuthError("Only admin can change this device location");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);
      setLocationSetupAdmin(true);
      setShowLocationAuth(false);
      openAdminSetup("staff");
      setLocationAuthForm({ username: "", password: "" });
    } catch {
      setLocationAuthError("Server not running");
    }
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
    } catch {
      setError("Server not running");
    }
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setUser(null);

    setShowStaffPanel(false);
    setShowStockChecks(false);
    setShowCorrections(false);
    setShowLocations(false);
    setShowPharmacyDashboard(false);
    setShowAuditTrail(false);
    setShowAdminSetup(false);
  }

  if (!device) {
    return (
      <div className="app">
        <DeviceSetup
          intro={
            isAdmin
              ? "Create or select the hospital, clinical area and iPad/device for this screen."
              : "Admin login is required before creating a new hospital, location or iPad/device."
          }
          canManageSetup={isAdmin}
          onDeviceSaved={saveDevice}
        />

        {!isAdmin && (
          <form onSubmit={login}>
            <h3>Admin setup login</h3>

            <input
              placeholder="Admin username"
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
              placeholder="Admin password"
              value={loginForm.password}
              onChange={(e) =>
                setLoginForm({
                  ...loginForm,
                  password: e.target.value,
                })
              }
            />

            <button>
              Login for Setup
            </button>

            {error && (
              <p style={{ color: "red" }}>
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    );
  }

  if (showDeviceSetup) {
    return (
      <DeviceSetup
        heading="Change Device Location"
        intro="Select the hospital, clinical area and iPad/device this screen should use."
        canManageSetup={isAdmin || locationSetupAdmin}
        cancelLabel="Back to Logbook"
        onCancel={() => {
          if (!user) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
          }
          setShowDeviceSetup(false);
          setLocationSetupAdmin(false);
        }}
        onDeviceSaved={saveChangedDevice}
      />
    );
  }

  if (!user) {
    return (
      <div className="login-shell">
        <section className="device-login-card">
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

        <aside className="admin-setup-card">
          <div>
            <span className="eyebrow">Admin setup</span>
              <h2>Open admin setup</h2>
              <p>
                Admin can manage staff, hospitals, locations, devices and audit
                without entering each clinical area.
              </p>
          </div>

          <button type="button" onClick={openLocationChange}>
            Open Admin Setup
          </button>

          {showLocationAuth && (
            <form className="location-auth-panel" onSubmit={verifyLocationChangeAdmin}>
              <h3>Admin confirmation</h3>
              <p>Admin login is required before opening setup.</p>

              <input
                placeholder="Admin username"
                value={locationAuthForm.username}
                onChange={(event) =>
                  setLocationAuthForm({
                    ...locationAuthForm,
                    username: event.target.value,
                  })
                }
              />

              <input
                type="password"
                placeholder="Admin password"
                value={locationAuthForm.password}
                onChange={(event) =>
                  setLocationAuthForm({
                    ...locationAuthForm,
                    password: event.target.value,
                  })
                }
              />

              <div>
                <button type="submit">Open Setup</button>
                <button type="button" onClick={() => setShowLocationAuth(false)}>
                  Cancel
                </button>
              </div>

              {locationAuthError && <strong>{locationAuthError}</strong>}
            </form>
          )}
        </aside>
      </div>
    );
  }

  return (
    <div className="app">

      <header className="app-header">
        <div className="location-banner">
          <div>
            <span className="location-label">
              {showAdminSetup ? "Admin setup" : "Current clinical area"}
            </span>
            <h1>{showAdminSetup ? "System Administration" : device.locationName}</h1>
            <p>{showAdminSetup ? "All hospitals, locations, devices and staff" : device.hospitalName}</p>
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

        <div className="header-actions">

        {isPanelOpen && (
          <button type="button" onClick={returnToLogbook}>
            Main Logbook
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() =>
              showAdminSetup
                ? showOnly("")
                : openAdminSetup("staff")
            }
          >
            Admin Setup
          </button>
        )}

        <button
          onClick={() =>
            showStockChecks
              ? showOnly("")
              : showOnly("stock")
          }
        >
          Stock Checks
        </button>

        <button
          onClick={() =>
            showCorrections
              ? showOnly("")
              : showOnly("corrections")
          }
        >
          Corrections
        </button>

        <button
          onClick={() =>
            showPharmacyDashboard
              ? showOnly("")
              : showOnly("pharmacy")
          }
        >
          Pharmacy Requests
        </button>

        </div>

      </header>


      {isAdmin &&
        showAdminSetup && (
          <section className="admin-setup-workspace">
            <div className="admin-setup-header">
              <div>
                <span className="eyebrow">System administration</span>
                <h2>Admin Setup</h2>
                <p>Manage staff, hospitals, locations, devices and audit from one place.</p>
              </div>
            </div>

            <div className="admin-tabs" role="tablist" aria-label="Admin setup sections">
              <button
                type="button"
                className={adminSetupTab === "staff" ? "active" : ""}
                onClick={() => setAdminSetupTab("staff")}
              >
                Staff
              </button>
              <button
                type="button"
                className={adminSetupTab === "locations" ? "active" : ""}
                onClick={() => setAdminSetupTab("locations")}
              >
                Hospitals & Locations
              </button>
              <button
                type="button"
                className={adminSetupTab === "devices" ? "active" : ""}
                onClick={() => setAdminSetupTab("devices")}
              >
                Devices
              </button>
              <button
                type="button"
                className={adminSetupTab === "audit" ? "active" : ""}
                onClick={() => setAdminSetupTab("audit")}
              >
                Audit
              </button>
            </div>

            {adminSetupTab === "staff" && <StaffManagement />}
            {adminSetupTab === "locations" && <LocationManagement />}
            {adminSetupTab === "devices" && (
              <DeviceSetup
                heading="Devices & iPad Assignment"
                intro="Select or create the saved iPad/device for a hospital and clinical area."
                canManageSetup
                cancelLabel="Back to Admin Setup"
                onCancel={() => setAdminSetupTab("staff")}
                onDeviceSaved={saveChangedDevice}
              />
            )}
            {adminSetupTab === "audit" && <AuditTrail device={device} />}
          </section>
        )}


      {showStockChecks && (
        <StockChecks device={device} />
      )}


      {showCorrections && (
        <Corrections device={device} />
      )}


      {showPharmacyDashboard && (
        <PharmacyDashboard device={device} user={user} />
      )}


      {!showStaffPanel &&
        !showLocations &&
        !showStockChecks &&
        !showCorrections &&
        !showPharmacyDashboard &&
        !showAuditTrail &&
        !showAdminSetup && (
          <ControlledDrugLogbook device={device} />
        )}

    </div>
  );
}

export default App;
