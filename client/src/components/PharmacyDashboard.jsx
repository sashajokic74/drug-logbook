import { useEffect, useState } from "react";
import {
  getPharmacyRequests,
  approvePharmacyRequest,
  rejectPharmacyRequest,
} from "../pharmacy";

function PharmacyDashboard({ device, user }) {
  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  useEffect(() => {
    loadRequests();
  }, [device?.hospitalId, device?.locationId]);

  async function loadRequests() {
    setMessage("");

    try {
      const data = await getPharmacyRequests({
        hospitalId: device?.hospitalId,
        locationId: device?.locationId,
      });
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function approveRequest(id) {
    try {
      await approvePharmacyRequest(id);
      await loadRequests();
      setMessage("Pharmacy request approved.");
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
      setMessage("Pharmacy request rejected.");
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

  const statusCounts = ["REQUESTED", "APPROVED", "COMPLETED", "REJECTED"]
    .map((status) => ({
      status,
      count: requests.filter(
        (request) => String(request.status || "").toUpperCase() === status
      ).length,
    }));
  const canActionRequests = user?.role === "admin" || user?.role === "pharmacy";

  return (
    <div className="register-box">
      <section className="pharmacy-dashboard-header">
        <div>
          <span className="eyebrow">Controlled drug requisitions</span>
          <h2>Pharmacy Dashboard</h2>
          <p>
            {device?.locationName || "Current location"} ·{" "}
            {device?.hospitalName || "Hospital"}
          </p>
        </div>

        <button type="button" onClick={loadRequests}>
          Refresh
        </button>
      </section>

      <p>
        Requisitions are location-specific. Stock can only be received when the
        requisition number, drug and quantity match.
      </p>

      {message && (
        <p
          style={{
            color: message.includes("approved") || message.includes("rejected")
              ? "green"
              : "red",
            fontWeight: "bold",
          }}
        >
          {message}
        </p>
      )}

      <div className="pharmacy-status-grid">
        {statusCounts.map((item) => (
          <button
            key={item.status}
            type="button"
            className={selectedStatus === item.status ? "selected" : ""}
            onClick={() => setSelectedStatus(item.status)}
          >
            <strong>{item.count}</strong>
            <span>{item.status}</span>
          </button>
        ))}
      </div>

      <div className="pharmacy-filter-row">
        {["ALL", "REQUESTED", "APPROVED", "COMPLETED", "REJECTED"].map(
          (status) => (
            <button
              key={status}
              type="button"
              onClick={() => setSelectedStatus(status)}
              className={selectedStatus === status ? "selected" : ""}
            >
              {status}
            </button>
          )
        )}
      </div>

      {filteredRequests.length === 0 ? (
        <p>No pharmacy requests found.</p>
      ) : (
        <div className="pharmacy-request-list">
          {filteredRequests.map((request) => (
            <article className="pharmacy-request-card" key={request.id}>
              <div>
                <span className="pharmacy-requisition">
                  {request.requisitionNumber}
                </span>
                <h3>{request.drugName}</h3>
                <p>
                  {request.quantityRequested} ampoules · {request.reason || "No reason recorded"}
                </p>
              </div>

              <dl>
                <div>
                  <dt>Status</dt>
                  <dd style={statusStyle(request.status)}>{request.status || "-"}</dd>
                </div>

                <div>
                  <dt>Requested by</dt>
                  <dd>{request.requestedByName}</dd>
                </div>

                <div>
                  <dt>Location</dt>
                  <dd>{request.locationName || "-"}</dd>
                </div>

                <div>
                  <dt>Created</dt>
                  <dd>
                    {request.createdAt
                      ? new Date(request.createdAt).toLocaleString()
                      : "-"}
                  </dd>
                </div>

                <div>
                  <dt>Completed</dt>
                  <dd>
                    {request.completedAt
                      ? new Date(request.completedAt).toLocaleString()
                      : "-"}
                  </dd>
                </div>
              </dl>

              {String(request.status || "").toUpperCase() === "REQUESTED" && (
                <div className="pharmacy-card-actions">
                  {canActionRequests ? (
                    <>
                      <button type="button" onClick={() => approveRequest(request.id)}>
                        Approve
                      </button>
                      <button type="button" onClick={() => rejectRequest(request.id)}>
                        Reject
                      </button>
                    </>
                  ) : (
                    <small>Admin/pharmacy user can approve or reject.</small>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default PharmacyDashboard;
