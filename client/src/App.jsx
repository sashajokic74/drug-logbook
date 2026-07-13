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

  function showOnly(panel) {
    setShowStaffPanel(panel === "staff");
    setShowStockChecks(panel === "stock");
    setShowCorrections(panel === "corrections");
    setShowLocations(panel === "locations");
    setShowPharmacyDashboard(panel === "pharmacy");
    setShowAuditTrail(panel === "audit");
  }

  function saveDevice(deviceData) {
    setDevice(deviceData);
  }

  function saveChangedDevice(deviceData) {
    localStorage.setItem("device", JSON.stringify(deviceData));
    setDevice(deviceData);
    setShowDeviceSetup(false);
    setShowLocationAuth(false);
    setLocationSetupAdmin(false);
    setLocationAuthForm({ username: "", password: "" });
    logout();
  }

  function openLocationChange() {
    setLocationAuthError("");

    if (isAdmin) {
      setLocationSetupAdmin(true);
      setShowDeviceSetup(true);
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
      setLocationSetupAdmin(true);
      setShowLocationAuth(false);
      setShowDeviceSetup(true);
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
        body: JSON.stringify(loginForm),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Login failed");
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
  }

  if (!device) {
    return <DeviceSetup onDeviceSaved={saveDevice} />;
  }

  if (showDeviceSetup) {
    return (
      <DeviceSetup
        heading="Change Device Location"
        intro="Select the hospital, clinical area and iPad/device this screen should use."
        canManageSetup={isAdmin || locationSetupAdmin}
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
      <div className="app">
        <h1>Controlled Drug Logbook</h1>

        <p>
          Device: <strong>{device.locationName}</strong>,{" "}
          {device.hospitalName}
        </p>

        <form onSubmit={login}>
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
            Login
          </button>
        </form>

        {error && (
          <p style={{ color: "red" }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="app">

      <header className="app-header">
        <div className="location-banner">
          <div>
            <span className="location-label">Current clinical area</span>
            <h1>{device.locationName}</h1>
            <p>{device.hospitalName}</p>
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

        {showLocationAuth && (
          <form className="location-auth-panel" onSubmit={verifyLocationChangeAdmin}>
            <h3>Admin confirmation</h3>
            <p>Admin approval is required before changing this device location.</p>

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
              <button type="submit">Confirm</button>
              <button type="button" onClick={() => setShowLocationAuth(false)}>
                Cancel
              </button>
            </div>

            {locationAuthError && <strong>{locationAuthError}</strong>}
          </form>
        )}

        <div className="header-actions">

        {isAdmin && (
          <>
            <button
              onClick={() =>
                showStaffPanel
                  ? showOnly("")
                  : showOnly("staff")
              }
            >
              Staff Management
            </button>

            <button
              onClick={() =>
                showAuditTrail
                  ? showOnly("")
                  : showOnly("audit")
              }
            >
              Audit Trail
            </button>
          </>
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
        showStaffPanel && (
          <StaffManagement />
        )}


      {isAdmin &&
        showLocations && (
          <LocationManagement />
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


      {isAdmin &&
        showAuditTrail && (
          <AuditTrail device={device} />
        )}


      {!showStaffPanel &&
        !showLocations &&
        !showStockChecks &&
        !showCorrections &&
        !showPharmacyDashboard &&
        !showAuditTrail && (
          <ControlledDrugLogbook device={device} />
        )}

    </div>
  );
}

export default App;
