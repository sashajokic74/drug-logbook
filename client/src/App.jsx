import { useEffect, useState } from "react";
import ControlledDrugLogbook from "./components/ControlledDrugLogbook";
import StaffManagement from "./components/StaffManagement";

const API_URL = "http://localhost:8000";

function App() {
  const [user, setUser] = useState(null);

  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");

  const [showStaffPanel, setShowStaffPanel] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");

    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  async function handleLogin(event) {
    event.preventDefault();
    setError("");

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Login failed");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

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
  }

  if (!user) {
    return (
      <div className="app">
        <div
          className="card"
          style={{
            maxWidth: "420px",
            margin: "80px auto",
          }}
        >
          <h1>🔐 Staff Login</h1>

          <form onSubmit={handleLogin}>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Username"
            />

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
            />

            <button type="submit">Login</button>
          </form>

          {error && <p style={{ color: "red" }}>{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 20px",
          borderBottom: "1px solid #ddd",
          background: "#f8f9fa",
        }}
      >
        <div>
          Logged in as <strong>{user.fullName || user.username}</strong>{" "}
          <span>({user.role})</span>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
          }}
        >
          {user.role === "admin" && (
            <button onClick={() => setShowStaffPanel(!showStaffPanel)}>
              {showStaffPanel ? "Hide Staff Management" : "Staff Management"}
            </button>
          )}

          <button onClick={logout}>Logout</button>
        </div>
      </div>

      {user.role === "admin" && showStaffPanel && <StaffManagement />}

      <ControlledDrugLogbook />
    </>
  );
}

export default App;