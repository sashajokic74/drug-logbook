import { useEffect, useState } from "react";

import { API_URL } from "../apiConfig";

function Corrections({ device }) {
  const [drugs, setDrugs] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [message, setMessage] = useState("");

  const [correctedBy, setCorrectedBy] = useState(null);
  const [checkedBy, setCheckedBy] = useState(null);

  const [correctedByForm, setCorrectedByForm] = useState({
    username: "",
    password: "",
  });

  const [checkedByForm, setCheckedByForm] = useState({
    username: "",
    password: "",
  });

  const [form, setForm] = useState({
    drugId: "",
    originalTransactionId: "",
    correctionType: "documentation",
    reason: "",
    correctionText: "",
  });

  useEffect(() => {
    loadDrugs();
    loadCorrections();
  }, [device?.hospitalId, device?.locationId]);

  useEffect(() => {
    if (form.drugId) {
      loadTransactions(form.drugId);
    } else {
      setTransactions([]);
    }
  }, [form.drugId, device?.hospitalId, device?.locationId]);

  function deviceQuery() {
    const params = new URLSearchParams();

    if (device?.hospitalId) params.set("hospitalId", device.hospitalId);
    if (device?.hospitalName) params.set("hospitalName", device.hospitalName);
    if (device?.locationId) params.set("locationId", device.locationId);
    if (device?.locationName) params.set("locationName", device.locationName);

    const query = params.toString();
    return query ? `?${query}` : "";
  }

  async function loadDrugs() {
    try {
      const response = await fetch(`${API_URL}/drugs${deviceQuery()}`);
      const data = await response.json();
      setDrugs(Array.isArray(data) ? data : []);
    } catch {
      setMessage("Could not load drugs");
    }
  }

  async function loadTransactions(drugId) {
    try {
      const token = localStorage.getItem("token");

      const response = await fetch(`${API_URL}/transactions/${drugId}${deviceQuery()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch {
      setMessage("Could not load transactions");
    }
  }

  async function loadCorrections() {
    try {
      const token = localStorage.getItem("token");

      const response = await fetch(`${API_URL}/corrections${deviceQuery()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      setCorrections(Array.isArray(data) ? data : []);
    } catch {
      setMessage("Could not load corrections");
    }
  }

  function updateForm(event) {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
  }

  function updateCorrectedByForm(event) {
    setCorrectedByForm({
      ...correctedByForm,
      [event.target.name]: event.target.value,
    });
  }

  function updateCheckedByForm(event) {
    setCheckedByForm({
      ...checkedByForm,
      [event.target.name]: event.target.value,
    });
  }

  const selectedTransaction = transactions.find(
    (entry) => Number(entry.id) === Number(form.originalTransactionId)
  );
  const correctionByOriginalEntry = corrections.reduce((lookup, correction) => {
    const entryId = String(correction.originalTransactionId);
    const existing = lookup[entryId] || {
      count: 0,
      hasReversal: false,
      latestReason: "",
    };

    lookup[entryId] = {
      count: existing.count + 1,
      hasReversal:
        existing.hasReversal || correction.correctionType === "entry_error",
      latestReason: existing.latestReason || correction.reason || "",
    };

    return lookup;
  }, {});

  function isBlockedClinicalRole(roleValue) {
    const role = String(roleValue || "").toLowerCase();

    return (
      role === "admin" ||
      role === "doctor" ||
      role === "dr" ||
      role.startsWith("dr ") ||
      role.includes(" doctor") ||
      role.includes("surgeon") ||
      role.includes("anaesthetist")
    );
  }

  function automaticStockAdjustment() {
    if (!selectedTransaction) return 0;

    if (form.correctionType !== "entry_error") return 0;

    return (
      Number(selectedTransaction.ampoulesUsed || 0) -
      Number(selectedTransaction.ampoulesSupplied || 0)
    );
  }

  async function verifyCorrectedBy() {
    setMessage("");

    const response = await fetch(`${API_URL}/checker/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: correctedByForm.username,
        password: correctedByForm.password,
        currentUserId: checkedBy ? checkedBy.id : null,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setCorrectedBy(null);
      setMessage(result.message || "Could not verify correction staff");
      return;
    }

    if (isBlockedClinicalRole(result.role)) {
      setCorrectedBy(null);
      setMessage("Admin, doctor and anaesthetist accounts cannot sign clinical correction");
      return;
    }

    setCorrectedBy(result);
    setMessage(`Correction staff verified: ${result.fullName}`);
  }

  async function verifyCheckedBy() {
    setMessage("");

    if (!correctedBy) {
      setMessage("Verify correction staff first");
      return;
    }

    const response = await fetch(`${API_URL}/checker/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: checkedByForm.username,
        password: checkedByForm.password,
        currentUserId: correctedBy.id,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setCheckedBy(null);
      setMessage(result.message || "Could not verify checker");
      return;
    }

    if (isBlockedClinicalRole(result.role)) {
      setCheckedBy(null);
      setMessage("Admin, doctor and anaesthetist accounts cannot sign clinical correction");
      return;
    }

    setCheckedBy(result);
    setMessage(`Correction checker verified: ${result.fullName}`);
  }

  async function saveCorrection() {
    setMessage("");

    if (!form.originalTransactionId || !form.reason || !form.correctionText) {
      setMessage("Select original entry, enter reason and correction text");
      return;
    }

    if (!correctedBy || !checkedBy) {
      setMessage("Two verified staff members are required");
      return;
    }

    if (Number(correctedBy.id) === Number(checkedBy.id)) {
      setMessage("Correction and checker must be two different people");
      return;
    }

    if (
      form.correctionType === "entry_error" &&
      correctionByOriginalEntry[String(form.originalTransactionId)]?.hasReversal
    ) {
      setMessage("This entry has already been reversed by a correction");
      return;
    }

    const token = localStorage.getItem("token");

    const response = await fetch(`${API_URL}/corrections`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        originalTransactionId: Number(form.originalTransactionId),
        correctionType: form.correctionType,
        reason: form.reason,
        correctionText: form.correctionText,
        hospitalId: device?.hospitalId,
        hospitalName: device?.hospitalName,
        locationId: device?.locationId,
        locationName: device?.locationName,
        correctedById: correctedBy.id,
        checkedById: checkedBy.id,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.message || "Could not save correction");
      return;
    }

    setMessage(result.message || "Correction entry saved");

    setForm({
      drugId: "",
      originalTransactionId: "",
      correctionType: "documentation",
      reason: "",
      correctionText: "",
    });

    setCorrectedBy(null);
    setCheckedBy(null);

    setCorrectedByForm({
      username: "",
      password: "",
    });

    setCheckedByForm({
      username: "",
      password: "",
    });

    setTransactions([]);
    await loadCorrections();
    await loadDrugs();
  }

  return (
    <section className="register-box">
      <h2>📝 Correction Entry</h2>

      <p>
        Corrections do not delete or edit the original register entry. They add
        a signed correction record. If the entry was made in error, stock is
        reversed automatically after two staff verify.
      </p>

      <label>
        Select Drug
        <select name="drugId" value={form.drugId} onChange={updateForm}>
          <option value="">Select drug</option>

          {drugs.map((drug) => (
            <option key={drug.id} value={drug.id}>
              {drug.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Original Entry
        <select
          name="originalTransactionId"
          value={form.originalTransactionId}
          onChange={updateForm}
          disabled={!form.drugId}
        >
          <option value="">Select original entry</option>

          {transactions.map((entry) => (
            <option key={entry.id} value={entry.id}>
              #{entry.id} — {entry.createdAt} — {entry.patientName || "-"} —{" "}
              Used {entry.ampoulesUsed} — Received {entry.ampoulesSupplied} —{" "}
              Balance {entry.stockBalanceAfter}
              {correctionByOriginalEntry[String(entry.id)]?.hasReversal
                ? " — REVERSED"
                : correctionByOriginalEntry[String(entry.id)]?.count
                  ? " — CORRECTED"
                  : ""}
            </option>
          ))}
        </select>
      </label>

      <label>
        Correction Type
        <select
          name="correctionType"
          value={form.correctionType}
          onChange={updateForm}
        >
          <option value="documentation">Documentation only</option>
          <option value="entry_error">Entry entered in error — reverse stock</option>
        </select>
      </label>

      {selectedTransaction && (
        <div
          style={{
            border: "1px solid #ddd",
            padding: "10px",
            margin: "10px 0",
            borderRadius: "8px",
            background: "#f9fafb",
          }}
        >
          <h4>Original Entry Preview</h4>

          <p>
            <strong>Date:</strong> {selectedTransaction.createdAt}
          </p>

          <p>
            <strong>Drug:</strong> {selectedTransaction.drugName}
          </p>

          <p>
            <strong>Patient:</strong> {selectedTransaction.patientName || "-"}
          </p>

          <p>
            <strong>MRN / NHS:</strong>{" "}
            {selectedTransaction.hospitalNumber || "-"}
          </p>

          <p>
            <strong>Received:</strong> {selectedTransaction.ampoulesSupplied}
          </p>

          <p>
            <strong>Used:</strong> {selectedTransaction.ampoulesUsed}
          </p>

          <p>
            <strong>Balance After:</strong>{" "}
            {selectedTransaction.stockBalanceAfter}
          </p>

          <p>
            <strong>Staff:</strong> {selectedTransaction.administeredByName}
          </p>

          <p>
            <strong>Witness:</strong> {selectedTransaction.witnessName}
          </p>

          {correctionByOriginalEntry[String(selectedTransaction.id)] && (
            <p>
              <strong>Correction status:</strong>{" "}
              {correctionByOriginalEntry[String(selectedTransaction.id)].hasReversal
                ? "Entry reversed by correction"
                : "Documentation correction recorded"}
              {correctionByOriginalEntry[String(selectedTransaction.id)].latestReason
                ? ` - ${correctionByOriginalEntry[String(selectedTransaction.id)].latestReason}`
                : ""}
            </p>
          )}

          {form.correctionType === "entry_error" && (
            <p style={{ color: "red", fontWeight: "bold" }}>
              Automatic stock reversal after verification:{" "}
              {automaticStockAdjustment() > 0 ? "+" : ""}
              {automaticStockAdjustment()} ampoules
            </p>
          )}
        </div>
      )}

      <input
        name="reason"
        placeholder="Reason for correction"
        value={form.reason}
        onChange={updateForm}
      />

      <textarea
        name="correctionText"
        placeholder="Correction details"
        value={form.correctionText}
        onChange={updateForm}
        rows={4}
        style={{ width: "100%" }}
      />

      <h3>Corrected By Verification</h3>

      <input
        name="username"
        placeholder="Correcting staff username"
        value={correctedByForm.username}
        onChange={updateCorrectedByForm}
      />

      <input
        name="password"
        type="password"
        placeholder="Correcting staff password"
        value={correctedByForm.password}
        onChange={updateCorrectedByForm}
      />

      <button type="button" onClick={verifyCorrectedBy}>
        Verify Correcting Staff
      </button>

      {correctedBy && (
        <p style={{ color: "green", fontWeight: "bold" }}>
          ✓ Correcting staff verified: {correctedBy.fullName} (
          {correctedBy.role}, {correctedBy.staffType})
        </p>
      )}

      <h3>Checked By Verification</h3>

      <input
        name="username"
        placeholder="Checker username"
        value={checkedByForm.username}
        onChange={updateCheckedByForm}
      />

      <input
        name="password"
        type="password"
        placeholder="Checker password"
        value={checkedByForm.password}
        onChange={updateCheckedByForm}
      />

      <button type="button" onClick={verifyCheckedBy}>
        Verify Checker
      </button>

      {checkedBy && (
        <p style={{ color: "green", fontWeight: "bold" }}>
          ✓ Checker verified: {checkedBy.fullName} ({checkedBy.role},{" "}
          {checkedBy.staffType})
        </p>
      )}

      <button type="button" onClick={saveCorrection}>
        Save Correction Entry
      </button>

      {message && (
        <p
          style={{
            fontWeight: "bold",
            color:
              message.includes("saved") ||
              message.includes("verified") ||
              message.includes("adjusted")
                ? "green"
                : "red",
          }}
        >
          {message}
        </p>
      )}

      <h3>Correction History</h3>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Original Entry</th>
            <th>Type</th>
            <th>Stock Adjustment</th>
            <th>Reason</th>
            <th>Correction</th>
            <th>Corrected By</th>
            <th>Correction Signature</th>
            <th>Checked By</th>
            <th>Checker Signature</th>
          </tr>
        </thead>

        <tbody>
          {corrections.map((correction) => (
            <tr key={correction.id}>
              <td>{correction.createdAt}</td>

              <td>#{correction.originalTransactionId}</td>

              <td>
                {correction.correctionType === "entry_error"
                  ? "Entry entered in error"
                  : "Documentation only"}
              </td>

              <td
                style={{
                  color:
                    Number(correction.stockAdjustment || 0) === 0
                      ? "black"
                      : "red",
                  fontWeight: "bold",
                }}
              >
                {Number(correction.stockAdjustment || 0) > 0 ? "+" : ""}
                {correction.stockAdjustment || 0}
              </td>

              <td>{correction.reason}</td>

              <td>{correction.correctionText}</td>

              <td>
                {correction.correctedByName}
                <br />
                <small>{correction.correctedByRole}</small>
              </td>

              <td>
                {correction.correctedSignedAt ? (
                  <>
                    ✓ Signed
                    <br />
                    <small>
                      {new Date(
                        correction.correctedSignedAt
                      ).toLocaleString()}
                    </small>
                    <br />
                    <small>
                      ID:{" "}
                      {correction.correctedSignatureHash
                        ? correction.correctedSignatureHash.substring(0, 10)
                        : "-"}
                    </small>
                  </>
                ) : (
                  "-"
                )}
              </td>

              <td>
                {correction.checkedByName}
                <br />
                <small>{correction.checkedByRole}</small>
              </td>

              <td>
                {correction.checkedSignedAt ? (
                  <>
                    ✓ Signed
                    <br />
                    <small>
                      {new Date(correction.checkedSignedAt).toLocaleString()}
                    </small>
                    <br />
                    <small>
                      ID:{" "}
                      {correction.checkedSignatureHash
                        ? correction.checkedSignatureHash.substring(0, 10)
                        : "-"}
                    </small>
                  </>
                ) : (
                  "-"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default Corrections;
