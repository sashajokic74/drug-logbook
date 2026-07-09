import { useEffect, useState } from "react";

const API_URL = "http://localhost:8000";

function StaffManagement() {
  const [staffUsers, setStaffUsers] = useState([]);
  const [staffMessage, setStaffMessage] = useState("");
  const [staffView, setStaffView] = useState("active");
  const [staffSearch, setStaffSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  const [newStaff, setNewStaff] = useState({
    fullName: "",
    username: "",
    password: "",
    role: "odp",
    staffType: "Permanent",
    expiryDate: "",
  });

  const roleOptions = [
    {
      value: "admin",
      label: "Admin / Super user",
      note: "Can manage staff, locations, audit and settings.",
    },
    {
      value: "odp",
      label: "ODP",
      note: "Can request, receive, check and administer controlled drugs.",
    },
    {
      value: "nurse",
      label: "Nurse",
      note: "Can request, receive, check and administer controlled drugs.",
    },
    {
      value: "theatre_practitioner",
      label: "Theatre practitioner",
      note: "Can request, receive, check and administer controlled drugs.",
    },
    {
      value: "pharmacy",
      label: "Pharmacy",
      note: "Can approve/reject requisitions; cannot administer drugs.",
    },
    {
      value: "viewer",
      label: "Read-only / auditor",
      note: "Can be recorded for access, but cannot sign clinical actions.",
    },
    {
      value: "anaesthetist",
      label: "Anaesthetist",
      note: "Recorded staff role; blocked from CD signing in this workflow.",
    },
    {
      value: "doctor",
      label: "Doctor",
      note: "Recorded staff role; blocked from CD signing in this workflow.",
    },
  ];

  useEffect(() => {
    loadStaffUsers();
  }, []);

  async function loadStaffUsers() {
    const token = localStorage.getItem("token");

    if (!token) {
      setStaffMessage("Please logout and login again");
      return;
    }

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

      setStaffUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.log(error);
      setStaffMessage("Server not running");
    }
  }

  function handleStaffChange(event) {
    const { name, value } = event.target;

    setNewStaff((previousStaff) => ({
      ...previousStaff,
      [name]: value,
    }));
  }

  async function createStaffUser() {
    setStaffMessage("");

    const fullName = newStaff.fullName.trim();
    const username = newStaff.username.trim();
    const password = newStaff.password.trim();
    const role = newStaff.role;
    const staffType = newStaff.staffType;
    const expiryDate = newStaff.expiryDate;

    if (!fullName || !username || !password || !role || !staffType) {
      setStaffMessage("Please complete all staff fields");
      return;
    }

    if (staffType !== "Permanent" && !expiryDate) {
      setStaffMessage("Temporary, Bank, Agency or Locum staff need an expiry date");
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setStaffMessage("Please logout and login again");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName,
          username,
          password,
          role,
          staffType,
          expiryDate: expiryDate || null,
        }),
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
        staffType: "Permanent",
        expiryDate: "",
      });

      await loadStaffUsers();
      setStaffView("active");
    } catch (error) {
      console.log(error);
      setStaffMessage("Server not running");
    }
  }

  async function deactivateStaff(id) {
    const token = localStorage.getItem("token");

    if (!token) {
      setStaffMessage("Please logout and login again");
      return;
    }

    const confirmDeactivate = window.confirm("Deactivate this staff account?");
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
    } catch (error) {
      console.log(error);
      setStaffMessage("Server not running");
    }
  }

  async function reactivateStaff(id) {
    const token = localStorage.getItem("token");

    if (!token) {
      setStaffMessage("Please logout and login again");
      return;
    }

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
    } catch (error) {
      console.log(error);
      setStaffMessage("Server not running");
    }
  }

  function isExpired(staff) {
    if (!staff.expiryDate) return false;

    const today = new Date().toISOString().slice(0, 10);

    return staff.expiryDate < today;
  }

  function roleLabel(roleValue) {
    const role = roleOptions.find((item) => item.value === roleValue);
    return role ? role.label : roleValue;
  }

  function permissionSummary(roleValue) {
    const role = roleOptions.find((item) => item.value === roleValue);
    return role ? role.note : "Custom role";
  }

  function statusLabel(staff) {
    if (isExpired(staff)) return "Expired";
    if (Number(staff.active) === 0) return "Inactive";
    return "Active";
  }

  const activeStaff = staffUsers.filter(
    (staff) => Number(staff.active) !== 0 && !isExpired(staff)
  );

  const inactiveStaff = staffUsers.filter(
    (staff) => Number(staff.active) === 0 || isExpired(staff)
  );

  const selectedStaff = staffView === "active" ? activeStaff : inactiveStaff;
  const visibleStaff = selectedStaff.filter((staff) => {
    const searchText = [
      staff.fullName,
      staff.username,
      staff.role,
      staff.staffType,
      statusLabel(staff),
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch = searchText.includes(staffSearch.toLowerCase());
    const matchesRole = roleFilter === "ALL" || staff.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <section
      style={{
        maxWidth: "1200px",
        margin: "20px auto",
        padding: "20px",
        border: "1px solid #ddd",
        borderRadius: "12px",
        background: "#ffffff",
      }}
    >
      <div className="staff-management-header">
        <div>
          <span className="eyebrow">Admin controls</span>
          <h2>Staff Management</h2>
          <p>Set who can sign, check, request, approve and audit controlled drug records.</p>
        </div>
      </div>

      <div className="permission-guide">
        {roleOptions.map((role) => (
          <div key={role.value}>
            <strong>{role.label}</strong>
            <span>{role.note}</span>
          </div>
        ))}
      </div>

      <div
        className="staff-create-grid"
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

        <select name="role" value={newStaff.role} onChange={handleStaffChange}>
          {roleOptions.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>

        <select
          name="staffType"
          value={newStaff.staffType}
          onChange={handleStaffChange}
        >
          <option value="Permanent">Permanent</option>
          <option value="Bank">Bank</option>
          <option value="Agency">Agency</option>
          <option value="Locum">Locum</option>
          <option value="Temporary">Temporary</option>
        </select>

        <input
          name="expiryDate"
          type="date"
          value={newStaff.expiryDate}
          onChange={handleStaffChange}
          disabled={newStaff.staffType === "Permanent"}
        />

        <button type="button" onClick={createStaffUser}>
          Create Staff
        </button>
      </div>

      {staffMessage && (
        <p
          style={{
            fontWeight: "bold",
            color: staffMessage.includes("created") ? "green" : "red",
          }}
        >
          {staffMessage}
        </p>
      )}

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
          Inactive / Expired Staff ({inactiveStaff.length})
        </button>
      </div>

      <div className="staff-filter-row">
        <input
          placeholder="Search staff, username, role or status"
          value={staffSearch}
          onChange={(event) => setStaffSearch(event.target.value)}
        />

        <select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
        >
          <option value="ALL">All roles</option>
          {roleOptions.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
      </div>

      <table style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>Full Name</th>
            <th>Username</th>
            <th>Role</th>
            <th>Permission</th>
            <th>Staff Type</th>
            <th>Expiry</th>
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
              <td>{roleLabel(staff.role)}</td>
              <td>{permissionSummary(staff.role)}</td>
              <td>{staff.staffType || "Permanent"}</td>
              <td>{staff.expiryDate || "-"}</td>
              <td>{statusLabel(staff)}</td>
              <td>{staff.createdAt || "-"}</td>
              <td>
                {staff.username === "admin" ? (
                  "-"
                ) : Number(staff.active) === 0 || isExpired(staff) ? (
                  <button type="button" onClick={() => reactivateStaff(staff.id)}>
                    Reactivate
                  </button>
                ) : (
                  <button type="button" onClick={() => deactivateStaff(staff.id)}>
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
          No {staffView === "active" ? "active" : "inactive / expired"} staff found.
        </p>
      )}
    </section>
  );
}

export default StaffManagement;
