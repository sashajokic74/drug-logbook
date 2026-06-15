import { useEffect, useState } from "react";

const API_URL = "http://localhost:8000";

function StaffManagement() {
  const [staffUsers, setStaffUsers] = useState([]);
  const [staffMessage, setStaffMessage] = useState("");
  const [staffView, setStaffView] = useState("active");

  const [newStaff, setNewStaff] = useState({
    fullName: "",
    username: "",
    password: "",
    role: "odp",
  });

  useEffect(() => {
    loadStaffUsers();
  }, []);

  async function loadStaffUsers() {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setStaffMessage(data.message || "Could not load staff users");
        return;
      }

      setStaffUsers(data);
    } catch {
      setStaffMessage("Server not running");
    }
  }

  function handleStaffChange(event) {
    const { name, value } = event.target;

    setNewStaff((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function createStaffUser(event) {
    event.preventDefault();
    setStaffMessage("");

    if (!newStaff.fullName || !newStaff.username || !newStaff.password) {
      setStaffMessage("Please complete all staff fields");
      return;
    }

    const token = localStorage.getItem("token");

    try {
      const response = await fetch(`${API_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newStaff),
      });

      const data = await response.json();

      if (!response.ok) {
        setStaffMessage(data.message || "Could not create staff user");
        return;
      }

      setStaffMessage(`Staff user created: ${data.username}`);

      setNewStaff({
        fullName: "",
        username: "",
        password: "",
        role: "odp",
      });

      await loadStaffUsers();
      setStaffView("active");
    } catch {
      setStaffMessage("Server not running");
    }
  }

  async function deactivateStaff(id) {
    const token = localStorage.getItem("token");

    const confirmDeactivate = window.confirm(
      "Deactivate this staff account?"
    );

    if (!confirmDeactivate) return;

    try {
      const response = await fetch(`${API_URL}/users/${id}/deactivate`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setStaffMessage(data.message || "Could not deactivate staff");
        return;
      }

      setStaffMessage("Staff account deactivated");
      await loadStaffUsers();
      setStaffView("active");
    } catch {
      setStaffMessage("Server not running");
    }
  }

  async function reactivateStaff(id) {
    const token = localStorage.getItem("token");

    try {
      const response = await fetch(`${API_URL}/users/${id}/reactivate`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setStaffMessage(data.message || "Could not reactivate staff");
        return;
      }

      setStaffMessage("Staff account reactivated");
      await loadStaffUsers();
      setStaffView("inactive");
    } catch {
      setStaffMessage("Server not running");
    }
  }

  const activeStaff = staffUsers.filter((staff) => staff.active !== 0);
  const inactiveStaff = staffUsers.filter((staff) => staff.active === 0);

  const visibleStaff = staffView === "active" ? activeStaff : inactiveStaff;

  return (
    <section
      style={{
        maxWidth: "1000px",
        margin: "20px auto",
        padding: "20px",
        border: "1px solid #ddd",
        borderRadius: "12px",
        background: "#ffffff",
      }}
    >
      <h2>👥 Staff Management</h2>

      <form
        onSubmit={createStaffUser}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        <input
          name="fullName"
          placeholder="Full name"
          value={newStaff.fullName}
          onChange={handleStaffChange}
        />

        <input
          name="username"
          placeholder="Username"
          value={newStaff.username}
          onChange={handleStaffChange}
        />

        <input
          name="password"
          type="password"
          placeholder="Password"
          value={newStaff.password}
          onChange={handleStaffChange}
        />

        <select
          name="role"
          value={newStaff.role}
          onChange={handleStaffChange}
        >
          <option value="admin">Admin</option>
          <option value="odp">ODP</option>
          <option value="anaesthetist">Anaesthetist</option>
          <option value="doctor">Doctor</option>
          <option value="nurse">Nurse</option>
          <option value="pharmacist">Pharmacist</option>
          <option value="viewer">Viewer</option>
        </select>

        <button type="submit">Create Staff</button>
      </form>

      {staffMessage && <p>{staffMessage}</p>}

      <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
        <button
          type="button"
          onClick={() => setStaffView("active")}
          style={{
            background: staffView === "active" ? "#2563eb" : "#e5e7eb",
            color: staffView === "active" ? "white" : "black",
          }}
        >
          Active Staff ({activeStaff.length})
        </button>

        <button
          type="button"
          onClick={() => setStaffView("inactive")}
          style={{
            background: staffView === "inactive" ? "#2563eb" : "#e5e7eb",
            color: staffView === "inactive" ? "white" : "black",
          }}
        >
          Inactive Staff ({inactiveStaff.length})
        </button>
      </div>

      <table style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>Full Name</th>
            <th>Username</th>
            <th>Role</th>
            <th>Status</th>
            <th>Created</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {visibleStaff.map((staff) => (
            <tr key={staff.id}>
              <td>{staff.fullName || "-"}</td>
              <td>{staff.username}</td>
              <td>{staff.role}</td>
              <td>{staff.active === 0 ? "Inactive" : "Active"}</td>
              <td>{staff.createdAt || "-"}</td>
              <td>
                {staff.username === "admin" ? (
                  "-"
                ) : staff.active === 0 ? (
                  <button onClick={() => reactivateStaff(staff.id)}>
                    Reactivate
                  </button>
                ) : (
                  <button onClick={() => deactivateStaff(staff.id)}>
                    Deactivate
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {visibleStaff.length === 0 && (
        <p style={{ marginTop: "15px" }}>
          No {staffView === "active" ? "active" : "inactive"} staff found.
        </p>
      )}
    </section>
  );
}

export default StaffManagement;