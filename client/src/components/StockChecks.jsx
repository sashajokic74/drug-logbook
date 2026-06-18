import { useEffect, useState } from "react";

const API_URL = "http://localhost:8000";

function StockChecks() {
  const [drugs, setDrugs] = useState([]);
  const [checks, setChecks] = useState([]);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    drugId: "",
    checkType: "Before Operating List",
    actualBalance: "",
    staffOneId: "",
    staffOneName: "",
    staffTwoId: "",
    staffTwoName: "",
    notes: "",
  });

  useEffect(() => {
    loadDrugs();
    loadChecks();
  }, []);

  async function loadDrugs() {
    const response = await fetch(`${API_URL}/drugs`);
    const data = await response.json();
    setDrugs(data);
  }

  async function loadChecks() {
    const token = localStorage.getItem("token");

    const response = await fetch(`${API_URL}/stock-checks`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    setChecks(Array.isArray(data) ? data : []);
  }

  function updateForm(event) {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
  }

  const selectedDrug = drugs.find(
    (drug) => Number(drug.id) === Number(form.drugId)
  );

  async function submitCheck() {
    setMessage("");

    if (!form.drugId || form.actualBalance === "") {
      setMessage("Please select drug and enter actual counted balance");
      return;
    }

    if (!form.staffOneName || !form.staffTwoName) {
      setMessage("Two staff members are required");
      return;
    }

    if (
      form.staffOneName.trim().toLowerCase() ===
      form.staffTwoName.trim().toLowerCase()
    ) {
      setMessage("Two different staff members must complete the check");
      return;
    }

    const token = localStorage.getItem("token");

    const response = await fetch(`${API_URL}/stock-checks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        drugId: Number(form.drugId),
        checkType: form.checkType,
        actualBalance: Number(form.actualBalance),
        staffOneId: form.staffOneId,
        staffOneName: form.staffOneName,
        staffTwoId: form.staffTwoId,
        staffTwoName: form.staffTwoName,
        notes: form.notes,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.message || "Could not save stock check");
      return;
    }

    setMessage(result.message);

    setForm({
      drugId: "",
      checkType: "Before Operating List",
      actualBalance: "",
      staffOneId: "",
      staffOneName: "",
      staffTwoId: "",
      staffTwoName: "",
      notes: "",
    });

    await loadChecks();
  }

  return (
    <section className="register-box">
      <h2>📋 Controlled Drug Stock Check</h2>

      <label>
        Select Drug
        <select name="drugId" value={form.drugId} onChange={updateForm}>
          <option value="">Select drug</option>
          {drugs.map((drug) => (
            <option key={drug.id} value={drug.id}>
              {drug.name} — {drug.quantity} ampoules expected
            </option>
          ))}
        </select>
      </label>

      <label>
        Check Type
        <select name="checkType" value={form.checkType} onChange={updateForm}>
          <option>Before Operating List</option>
          <option>After Operating List</option>
        </select>
      </label>

      {selectedDrug && (
        <input
          value={`Expected balance: ${selectedDrug.quantity} ampoules`}
          disabled
        />
      )}

      <input
        name="actualBalance"
        type="number"
        placeholder="Actual counted balance"
        value={form.actualBalance}
        onChange={updateForm}
      />

      {selectedDrug && form.actualBalance !== "" && (
        <p
          style={{
            fontWeight: "bold",
            color:
              Number(form.actualBalance) === Number(selectedDrug.quantity)
                ? "green"
                : "red",
          }}
        >
          {Number(form.actualBalance) === Number(selectedDrug.quantity)
            ? "✓ Stock count correct"
            : `🚨 Discrepancy: ${
                Number(form.actualBalance) - Number(selectedDrug.quantity)
              } ampoules`}
        </p>
      )}

      <h3>Staff 1</h3>

      <input
        name="staffOneId"
        placeholder="Staff 1 ID"
        value={form.staffOneId}
        onChange={updateForm}
      />

      <input
        name="staffOneName"
        placeholder="Staff 1 name"
        value={form.staffOneName}
        onChange={updateForm}
      />

      <h3>Staff 2</h3>

      <input
        name="staffTwoId"
        placeholder="Staff 2 ID"
        value={form.staffTwoId}
        onChange={updateForm}
      />

      <input
        name="staffTwoName"
        placeholder="Staff 2 name"
        value={form.staffTwoName}
        onChange={updateForm}
      />

      <input
        name="notes"
        placeholder="Notes / discrepancy explanation"
        value={form.notes}
        onChange={updateForm}
      />

      <button type="button" onClick={submitCheck}>
        Save CD Stock Check
      </button>

      {message && <p style={{ fontWeight: "bold" }}>{message}</p>}

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
            <th>Staff 2</th>
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
              <td>{check.staffOneName}</td>
              <td>{check.staffTwoName}</td>
              <td>{check.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default StockChecks;