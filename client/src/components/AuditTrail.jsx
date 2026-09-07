import { useEffect, useState } from "react";

import { API_URL } from "../apiConfig";

function AuditTrail({ device }) {
  const today = new Date().toISOString().slice(0, 10);
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState({
    type: "ALL",
    fromDate: "",
    toDate: today,
    search: "",
  });

  useEffect(() => {
    loadAuditTrail();
  }, [device?.hospitalId, device?.locationId, filters.type, filters.fromDate, filters.toDate]);

  function updateFilter(event) {
    setFilters({
      ...filters,
      [event.target.name]: event.target.value,
    });
  }

  async function loadAuditTrail() {
    setMessage("");

    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();

      if (device?.hospitalId) params.set("hospitalId", device.hospitalId);
      if (device?.locationId) params.set("locationId", device.locationId);
      if (filters.type !== "ALL") params.set("type", filters.type);
      if (filters.fromDate) params.set("fromDate", filters.fromDate);
      if (filters.toDate) params.set("toDate", filters.toDate);
      if (filters.search) params.set("search", filters.search);

      const response = await fetch(`${API_URL}/audit-trail?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Could not load audit trail");
        return;
      }

      setRows(Array.isArray(data) ? data : []);
    } catch {
      setMessage("Could not load audit trail");
    }
  }

  function exportCsv() {
    const headers = [
      "Date",
      "Type",
      "Action",
      "Drug",
      "Patient",
      "Before",
      "After",
      "Quantity",
      "Staff",
      "Location",
      "Signature ID",
      "Notes",
    ];
    const csvRows = rows.map((row) =>
      [
        row.createdAt || "",
        row.type || "",
        row.action || "",
        row.drugName || "",
        row.patientName || "",
        row.beforeBalance ?? "",
        row.afterBalance ?? "",
        row.quantity ?? "",
        row.staff || "",
        row.locationName || "",
        row.signatureHash || "",
        row.notes || "",
      ]
        .map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`)
        .join(",")
    );
    const blob = new Blob([[headers.join(","), ...csvRows].join("\n")], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "controlled-drug-audit-trail.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const counts = ["TRANSACTION", "STOCK_CHECK", "CORRECTION", "PHARMACY", "SYSTEM"].map(
    (type) => ({
      type,
      count: rows.filter((row) => row.type === type).length,
    })
  );

  return (
    <section className="register-box">
      <div className="audit-header">
        <div>
          <span className="eyebrow">Controlled drug governance</span>
          <h2>Audit Trail</h2>
          <p>
            {device?.locationName || "Current location"} ·{" "}
            {device?.hospitalName || "Hospital"}
          </p>
        </div>

        <button type="button" onClick={exportCsv} disabled={rows.length === 0}>
          Export CSV
        </button>
      </div>

      <div className="audit-filter-panel">
        <select name="type" value={filters.type} onChange={updateFilter}>
          <option value="ALL">All record types</option>
          <option value="TRANSACTION">Drug transactions</option>
          <option value="STOCK_CHECK">Stock checks</option>
          <option value="CORRECTION">Corrections</option>
          <option value="PHARMACY">Pharmacy requests</option>
          <option value="SYSTEM">System/admin audit</option>
        </select>

        <input
          type="date"
          name="fromDate"
          value={filters.fromDate}
          onChange={updateFilter}
        />

        <input
          type="date"
          name="toDate"
          value={filters.toDate}
          onChange={updateFilter}
        />

        <input
          name="search"
          placeholder="Search drug, staff, patient, requisition"
          value={filters.search}
          onChange={updateFilter}
        />

        <button type="button" onClick={loadAuditTrail}>
          Search
        </button>
      </div>

      {message && (
        <p style={{ color: "red", fontWeight: "bold" }}>
          {message}
        </p>
      )}

      <div className="audit-summary-grid">
        {counts.map((item) => (
          <div key={item.type}>
            <strong>{item.count}</strong>
            <span>{item.type.replace("_", " ")}</span>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <p>No audit records found for this filter.</p>
      ) : (
        <div className="audit-timeline">
          {rows.map((row) => (
            <article className="audit-row" key={row.id}>
              <div>
                <span>{row.type?.replace("_", " ")}</span>
                <strong>{row.action}</strong>
                <small>{row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}</small>
              </div>

              <dl>
                <div>
                  <dt>Drug</dt>
                  <dd>{row.drugName || "-"}</dd>
                </div>

                <div>
                  <dt>Patient</dt>
                  <dd>{row.patientName || "-"}</dd>
                </div>

                <div>
                  <dt>Balance</dt>
                  <dd>
                    {row.beforeBalance !== undefined && row.afterBalance !== undefined
                      ? `${row.beforeBalance} -> ${row.afterBalance}`
                      : "-"}
                  </dd>
                </div>

                <div>
                  <dt>Staff</dt>
                  <dd>{row.staff || "-"}</dd>
                </div>

                <div>
                  <dt>Signature ID</dt>
                  <dd>{row.signatureHash ? row.signatureHash.slice(0, 18) : "-"}</dd>
                </div>
              </dl>

              {row.notes && <p>{row.notes}</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default AuditTrail;
