import { useState } from "react";
import ControlledDrugLogbook from "./components/ControlledDrugLogbook";
import StaffManagement from "./components/StaffManagement";
import StockChecks from "./components/StockChecks";
import Corrections from "./components/Corrections";
import LocationManagement from "./components/LocationManagement";
import "./index.css";

const API_URL = "http://localhost:8000";

function App() {
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

  const [error, setError] = useState("");

  function showOnly(panel) {
    setShowStaffPanel(panel === "staff");
    setShowStockChecks(panel === "stock");
    setShowCorrections(panel === "corrections");
    setShowLocations(panel === "locations");
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
  }

  if (!user) {
    return (
      <div className="app">
        <h1>Controlled Drug Logbook</h1>

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

      <header>
        Logged in as:

        <strong>
          {" "}
          {user.fullName || user.username}
        </strong>

        {" "}({user.role})

        <button onClick={logout}>
          Logout
        </button>

        <br />
        <br />

        {user.role === "admin" && (
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
                showLocations
                  ? showOnly("")
                  : showOnly("locations")
              }
            >
              Hospital / Locations
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

      </header>


      {user.role === "admin" &&
        showStaffPanel && (
          <StaffManagement />
        )}


      {user.role === "admin" &&
        showLocations && (
          <LocationManagement />
        )}


      {showStockChecks && (
        <StockChecks />
      )}


      {showCorrections && (
        <Corrections />
      )}


      {!showStaffPanel &&
        !showLocations &&
        !showStockChecks &&
        !showCorrections && (
          <ControlledDrugLogbook />
        )}

    </div>
  );
}

export default App;