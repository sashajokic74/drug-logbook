import { useEffect, useState } from "react";
import {
  getPharmacyRequests,
  approvePharmacyRequest,
  rejectPharmacyRequest,
} from "../pharmacy";

function PharmacyDashboard() {
  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    setMessage("");

    try {
      const data = await getPharmacyRequests();
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function approveRequest(id) {
    try {
      await approvePharmacyRequest(id);
      await loadRequests();
      setMessage("✅ Pharmacy request approved.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function rejectRequest(id) {
    const reason = prompt("Reason for rejection:");
    if (reason === null) return;

    try {
      await rejectPharmacyRequest(id, reason);
      await loadRequests();
      setMessage("❌ Pharmacy request rejected.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  function statusStyle(status) {
    const value = String(status || "").toUpperCase();

    if (value === "REQUESTED") return { color: "#b45309", fontWeight: "bold" };
    if (value === "APPROVED") return { color: "#2563eb", fontWeight: "bold" };
    if (value === "COMPLETED") return { color: "#15803d", fontWeight: "bold" };
    if (value === "REJECTED") return { color: "#dc2626", fontWeight: "bold" };

    return { fontWeight: "bold" };
  }

  const filteredRequests = requests.filter((request) => {
    if (selectedStatus === "ALL") return true;
    return String(request.status || "").toUpperCase() === selectedStatus;
  });

  return (
    <div className="register-box">
      <h2>📦 Pharmacy Dashboard</h2>

      <p>
        Controlled drug pharmacy requests received from theatres, recovery and
        clinical locations.
      </p>

      {message && (
        <p
          style={{
            color: message.includes("✅") || message.includes("❌")
              ? "green"
              : "red",
            fontWeight: "bold",
          }}
        >
          {message}
        </p>
      )}

      <button type="button" onClick={loadRequests}>
        🔄 Refresh Requests
      </button>

      <h3>Pharmacy Requests</h3>

      <div
        style={{
          display: "flex",
          gap: "10px",
          marginTop: "15px",
          marginBottom: "15px",
          flexWrap: "wrap",
        }}
      >
        {["ALL", "REQUESTED", "APPROVED", "COMPLETED", "REJECTED"].map(
          (status) => (
            <button
              key={status}
              type="button"
              onClick={() => setSelectedStatus(status)}
              style={{
                background: selectedStatus === status ? "#2563eb" : "#e5e7eb",
                color: selectedStatus === status ? "white" : "black",
                fontWeight: "bold",
              }}
            >
              {status}
            </button>
          )
        )}
      </div>

      {filteredRequests.length === 0 ? (
        <p>No pharmacy requests found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Requisition No.</th>
              <th>Drug</th>
              <th>Quantity</th>
              <th>Reason</th>
              <th>Requested By</th>
              <th>Role</th>
              <th>Hospital</th>
              <th>Location</th>
              <th>Status</th>
              <th>Completed</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredRequests.map((request) => (
              <tr key={request.id}>
                <td>
                  {request.createdAt
                    ? new Date(request.createdAt).toLocaleString()
                    : "-"}
                </td>

                <td>{request.requisitionNumber}</td>
                <td>{request.drugName}</td>
                <td>{request.quantityRequested}</td>
                <td>{request.reason || "-"}</td>
                <td>{request.requestedByName}</td>
                <td>{request.requestedByRole}</td>
                <td>{request.hospitalName || "-"}</td>
                <td>{request.locationName || "-"}</td>

                <td style={statusStyle(request.status)}>
                  {request.status || "-"}
                </td>

                <td>
                  {request.completedAt
                    ? new Date(request.completedAt).toLocaleString()
                    : "-"}
                </td>

                <td>
                  {String(request.status || "").toUpperCase() ===
                    "REQUESTED" && (
                    <>
                      <button
                        type="button"
                        onClick={() => approveRequest(request.id)}
                      >
                        Approve
                      </button>

                      <button
                        type="button"
                        onClick={() => rejectRequest(request.id)}
                        style={{ marginLeft: "8px" }}
                      >
                        Reject
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default PharmacyDashboard;
