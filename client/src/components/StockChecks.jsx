import { useEffect, useState } from "react";

import { API_URL } from "../apiConfig";

function StockChecks({ device }) {
  const [drugs, setDrugs] = useState([]);
  const [checks, setChecks] = useState([]);
  const [message, setMessage] = useState("");
  const [checkType, setCheckType] = useState("Before Operating List");
  const [stockRows, setStockRows] = useState({});

  const [staffOne, setStaffOne] = useState(null);
  const [staffTwo, setStaffTwo] = useState(null);

  const [staffOneForm, setStaffOneForm] = useState({
    username: "",
    password: "",
  });

  const [staffTwoForm, setStaffTwoForm] = useState({
    username: "",
    password: "",
  });

  useEffect(() => {
    loadDrugs();
    loadChecks();
  }, [device?.hospitalId, device?.locationId]);

  useEffect(() => {
    setStockRows((currentRows) => {
      const nextRows = {};

      drugs.forEach((drug) => {
        nextRows[drug.id] = currentRows[drug.id] || {
          actualBalance: "",
          checkedCorrect: false,
          notes: "",
        };
      });

      return nextRows;
    });
  }, [drugs]);

  function deviceQuery() {
    const params = new URLSearchParams();

    if (device?.hospitalId) params.set("hospitalId", device.hospitalId);
    if (device?.hospitalName) params.set("hospitalName", device.hospitalName);
    if (device?.locationId) params.set("locationId", device.locationId);
    if (device?.locationName) params.set("locationName", device.locationName);

    const query = params.toString();
    return query ? "?" + query : "";
  }

  async function loadDrugs() {
    const response = await fetch(API_URL + "/drugs" + deviceQuery(), {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const data = await response.json();
    setDrugs(Array.isArray(data) ? data : []);
  }

  async function loadChecks() {
    const token = localStorage.getItem("token");

    const response = await fetch(API_URL + "/stock-checks" + deviceQuery(), {
      headers: {
        Authorization: "Bearer " + token,
      },
    });

    const data = await response.json();
    setChecks(Array.isArray(data) ? data : []);
  }

  function updateStockRow(drugId, field, value) {
    setStockRows((currentRows) => ({
      ...currentRows,
      [drugId]: {
        ...(currentRows[drugId] || {}),
        [field]: value,
      },
    }));
  }

  function updateStaffOneForm(event) {
    setStaffOneForm({
      ...staffOneForm,
      [event.target.name]: event.target.value,
    });
  }

  function updateStaffTwoForm(event) {
    setStaffTwoForm({
      ...staffTwoForm,
      [event.target.name]: event.target.value,
    });
  }

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

  async function verifyStaffOne() {
    setMessage("");

    const response = await fetch(API_URL + "/checker/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: staffOneForm.username,
        password: staffOneForm.password,
        currentUserId: staffTwo ? staffTwo.id : null,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setStaffOne(null);
      setMessage(result.message || "Could not verify staff 1");
      return;
    }

    if (isBlockedClinicalRole(result.role)) {
      setStaffOne(null);
      setMessage("Admin, doctor and anaesthetist accounts cannot complete CD stock check");
      return;
    }

    setStaffOne(result);
    setMessage("Staff 1 verified: " + result.fullName);
  }

  async function verifyStaffTwo() {
    setMessage("");

    if (!staffOne) {
      setMessage("Verify Staff 1 first");
      return;
    }

    const response = await fetch(API_URL + "/checker/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: staffTwoForm.username,
        password: staffTwoForm.password,
        currentUserId: staffOne.id,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setStaffTwo(null);
      setMessage(result.message || "Could not verify staff 2");
      return;
    }

    if (isBlockedClinicalRole(result.role)) {
      setStaffTwo(null);
      setMessage("Admin, doctor and anaesthetist accounts cannot complete CD stock check");
      return;
    }

    setStaffTwo(result);
    setMessage("Staff 2 verified: " + result.fullName);
  }

  const completedRows = drugs.filter((drug) => {
    const row = stockRows[drug.id] || {};
    return row.actualBalance !== "";
  });

  const correctRows = drugs.filter((drug) => {
    const row = stockRows[drug.id] || {};
    return row.checkedCorrect && Number(row.actualBalance) === Number(drug.quantity || 0);
  });

  const discrepancyRows = drugs.filter((drug) => {
    const row = stockRows[drug.id] || {};
    return row.actualBalance !== "" && Number(row.actualBalance) !== Number(drug.quantity || 0);
  });

  const allRowsCompleted = drugs.length > 0 && completedRows.length === drugs.length;

  async function submitCheck() {
    setMessage("");

    if (drugs.length === 0) {
      setMessage("No drugs available to check");
      return;
    }

    if (!allRowsCompleted) {
      setMessage("Enter counted balance for every drug before signing");
      return;
    }

    const untickedCorrectRows = drugs.filter((drug) => {
      const row = stockRows[drug.id] || {};
      return Number(row.actualBalance) === Number(drug.quantity || 0) && !row.checkedCorrect;
    });

    if (untickedCorrectRows.length > 0) {
      setMessage("Tick Correct for every drug where the balance matches");
      return;
    }

    const discrepancyWithoutNotes = discrepancyRows.filter((drug) => {
      const row = stockRows[drug.id] || {};
      return !String(row.notes || "").trim();
    });

    if (discrepancyWithoutNotes.length > 0) {
      setMessage("Add a discrepancy note for any drug where the balance does not match");
      return;
    }

    if (!staffOne || !staffTwo) {
      setMessage("Two verified staff members are required at the bottom");
      return;
    }

    if (Number(staffOne.id) === Number(staffTwo.id)) {
      setMessage("Two different staff members must complete the check");
      return;
    }

    const token = localStorage.getItem("token");

    for (const drug of drugs) {
      const row = stockRows[drug.id];

      const response = await fetch(API_URL + "/stock-checks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          drugId: Number(drug.id),
          checkType,
          actualBalance: Number(row.actualBalance),
          hospitalId: device?.hospitalId,
          hospitalName: device?.hospitalName,
          locationId: device?.locationId,
          locationName: device?.locationName,
          staffOneId: staffOne.id,
          staffTwoId: staffTwo.id,
          notes: row.notes || "",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.message || "Could not save stock check");
        return;
      }
    }

    setMessage(
      discrepancyRows.length === 0
        ? "Full stock check completed. All drugs correct."
        : "Full stock check completed with " + discrepancyRows.length + " discrepancy record(s)."
    );

    setStockRows({});
    setStaffOne(null);
    setStaffTwo(null);
    setStaffOneForm({ username: "", password: "" });
    setStaffTwoForm({ username: "", password: "" });

    await loadDrugs();
    await loadChecks();
  }

  return (
    <section className="register-box stock-check-workspace">
      <section className="stock-check-header">
        <div>
          <span className="eyebrow">Controlled drug cupboard</span>
          <h2>Full Stock Check</h2>
          <p>
            Tick each drug after counting. Two authorised staff sign once at the bottom.
          </p>
        </div>

        <div className="stock-check-progress">
          <strong>{completedRows.length}/{drugs.length}</strong>
          <span>checked</span>
        </div>
      </section>

      <label className="stock-check-type">
        Check Type
        <select value={checkType} onChange={(event) => setCheckType(event.target.value)}>
          <option>Before Operating List</option>
          <option>After Operating List</option>
          <option>Daily CD Cupboard Check</option>
          <option>Shift Handover</option>
        </select>
      </label>

      <div className="stock-check-summary-grid">
        <div>
          <strong>{drugs.length}</strong>
          <span>Total drugs</span>
        </div>
        <div>
          <strong>{correctRows.length}</strong>
          <span>Correct</span>
        </div>
        <div className={discrepancyRows.length > 0 ? "stock-check-alert" : ""}>
          <strong>{discrepancyRows.length}</strong>
          <span>Discrepancies</span>
        </div>
      </div>

      <div className="stock-check-list">
        {drugs.map((drug) => {
          const row = stockRows[drug.id] || {};
          const actualEntered = row.actualBalance !== "";
          const difference = actualEntered
            ? Number(row.actualBalance) - Number(drug.quantity || 0)
            : 0;
          const isCorrect = actualEntered && difference === 0;

          return (
            <article
              key={drug.id}
              className={
                "stock-check-row " +
                (isCorrect && row.checkedCorrect ? "stock-check-row-ok" : "") +
                (actualEntered && difference !== 0 ? " stock-check-row-alert" : "")
              }
            >
              <div>
                <strong>{drug.name}</strong>
                <span>{drug.size} | {drug.concentration}</span>
              </div>

              <div className="stock-check-expected">
                <small>Expected</small>
                <strong>{drug.quantity}</strong>
              </div>

              <label>
                Counted
                <input
                  type="number"
                  value={row.actualBalance || ""}
                  onChange={(event) =>
                    updateStockRow(drug.id, "actualBalance", event.target.value)
                  }
                />
              </label>

              <label className="stock-check-tick">
                <input
                  type="checkbox"
                  checked={Boolean(row.checkedCorrect)}
                  disabled={!isCorrect}
                  onChange={(event) =>
                    updateStockRow(drug.id, "checkedCorrect", event.target.checked)
                  }
                />
                Correct
              </label>

              <div className="stock-check-difference">
                <small>Difference</small>
                <strong>{actualEntered ? difference : "-"}</strong>
              </div>

              <input
                placeholder="Discrepancy note if needed"
                value={row.notes || ""}
                onChange={(event) => updateStockRow(drug.id, "notes", event.target.value)}
              />
            </article>
          );
        })}
      </div>

      <section className="stock-check-signoff">
        <h3>Final Sign Off</h3>

        <div className="stock-check-signoff-grid">
          <div>
            <h4>Staff 1 Verification</h4>

            <input
              name="username"
              placeholder="Staff 1 username"
              value={staffOneForm.username}
              onChange={updateStaffOneForm}
            />

            <input
              name="password"
              type="password"
              placeholder="Staff 1 password"
              value={staffOneForm.password}
              onChange={updateStaffOneForm}
            />

            <button type="button" onClick={verifyStaffOne}>
              Verify Staff 1
            </button>

            {staffOne && (
              <p className="verified-message">
                Staff 1 verified: {staffOne.fullName} ({staffOne.role}, {staffOne.staffType})
              </p>
            )}
          </div>

          <div>
            <h4>Staff 2 Verification</h4>

            <input
              name="username"
              placeholder="Staff 2 username"
              value={staffTwoForm.username}
              onChange={updateStaffTwoForm}
            />

            <input
              name="password"
              type="password"
              placeholder="Staff 2 password"
              value={staffTwoForm.password}
              onChange={updateStaffTwoForm}
            />

            <button type="button" onClick={verifyStaffTwo}>
              Verify Staff 2
            </button>

            {staffTwo && (
              <p className="verified-message">
                Staff 2 verified: {staffTwo.fullName} ({staffTwo.role}, {staffTwo.staffType})
              </p>
            )}
          </div>
        </div>

        <button type="button" className="save-stock-check-btn" onClick={submitCheck}>
          Save Full Stock Check
        </button>

        {message && (
          <p
            className={
              "stock-check-message " +
              (message.includes("completed") || message.includes("verified") ? "ok" : "alert")
            }
          >
            {message}
          </p>
        )}
      </section>

      <h3>Stock Check History</h3>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Drug</th>
            <th>Type</th>
            <th>Expected</th>
            <th>Actual</th>
            <th>Difference</th>
            <th>Staff 1</th>
            <th>Staff 1 Signature</th>
            <th>Staff 2</th>
            <th>Staff 2 Signature</th>
            <th>Notes</th>
          </tr>
        </thead>

        <tbody>
          {checks.map((check) => (
            <tr key={check.id}>
              <td>{check.createdAt}</td>
              <td>{check.drugName}</td>
              <td>{check.checkType}</td>
              <td>{check.expectedBalance}</td>
              <td>{check.actualBalance}</td>

              <td
                style={{
                  color: Number(check.difference) === 0 ? "green" : "red",
                  fontWeight: "bold",
                }}
              >
                {check.difference}
              </td>

              <td>
                {check.staffOneName}
                <br />
                <small>
                  {check.staffOneRole || ""}{" "}
                  {check.staffOneStaffType ? "(" + check.staffOneStaffType + ")" : ""}
                </small>
              </td>

              <td>
                {check.staffOneSignedAt ? (
                  <>
                    Signed
                    <br />
                    <small>{new Date(check.staffOneSignedAt).toLocaleString()}</small>
                    <br />
                    <small>
                      ID:{" "}
                      {check.staffOneSignatureHash
                        ? check.staffOneSignatureHash.substring(0, 10)
                        : "-"}
                    </small>
                  </>
                ) : (
                  "-"
                )}
              </td>

              <td>
                {check.staffTwoName}
                <br />
                <small>
                  {check.staffTwoRole || ""}{" "}
                  {check.staffTwoStaffType ? "(" + check.staffTwoStaffType + ")" : ""}
                </small>
              </td>

              <td>
                {check.staffTwoSignedAt ? (
                  <>
                    Signed
                    <br />
                    <small>{new Date(check.staffTwoSignedAt).toLocaleString()}</small>
                    <br />
                    <small>
                      ID:{" "}
                      {check.staffTwoSignatureHash
                        ? check.staffTwoSignatureHash.substring(0, 10)
                        : "-"}
                    </small>
                  </>
                ) : (
                  "-"
                )}
              </td>

              <td>{check.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default StockChecks;
