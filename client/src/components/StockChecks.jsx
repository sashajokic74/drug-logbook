import { useEffect, useState } from "react";

const API_URL = "http://localhost:8000";

function StockChecks() {
  const [drugs, setDrugs] = useState([]);
  const [checks, setChecks] = useState([]);
  const [message, setMessage] = useState("");

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

  const [form, setForm] = useState({
    drugId: "",
    checkType: "Before Operating List",
    actualBalance: "",
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

  const selectedDrug = drugs.find(
    (drug) => Number(drug.id) === Number(form.drugId)
  );

  async function verifyStaffOne() {
    setMessage("");

    const response = await fetch(`${API_URL}/checker/verify`, {
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

    if (result.role === "admin") {
      setStaffOne(null);
      setMessage("Admin account cannot complete CD stock check");
      return;
    }

    setStaffOne(result);
    setMessage(`Staff 1 verified: ${result.fullName}`);
  }

  async function verifyStaffTwo() {
    setMessage("");

    if (!staffOne) {
      setMessage("Verify Staff 1 first");
      return;
    }

    const response = await fetch(`${API_URL}/checker/verify`, {
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

    if (result.role === "admin") {
      setStaffTwo(null);
      setMessage("Admin account cannot complete CD stock check");
      return;
    }

    setStaffTwo(result);
    setMessage(`Staff 2 verified: ${result.fullName}`);
  }

  async function submitCheck() {
    setMessage("");

    if (!form.drugId || form.actualBalance === "") {
      setMessage("Please select drug and enter actual counted balance");
      return;
    }

    if (!staffOne || !staffTwo) {
      setMessage("Two verified staff members are required");
      return;
    }

    if (Number(staffOne.id) === Number(staffTwo.id)) {
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
        staffOneId: staffOne.id,
        staffOneName: staffOne.fullName || staffOne.username,
        staffTwoId: staffTwo.id,
        staffTwoName: staffTwo.fullName || staffTwo.username,
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
      notes: "",
    });

    setStaffOne(null);
    setStaffTwo(null);

    setStaffOneForm({
      username: "",
      password: "",
    });

    setStaffTwoForm({
      username: "",
      password: "",
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

      <h3>Staff 1 Verification</h3>

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
        <p style={{ color: "green", fontWeight: "bold" }}>
          ✓ Staff 1 verified: {staffOne.fullName} ({staffOne.role},{" "}
          {staffOne.staffType})
        </p>
      )}

      <h3>Staff 2 Verification</h3>

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
        <p style={{ color: "green", fontWeight: "bold" }}>
          ✓ Staff 2 verified: {staffTwo.fullName} ({staffTwo.role},{" "}
          {staffTwo.staffType})
        </p>
      )}

      <input
        name="notes"
        placeholder="Notes / discrepancy explanation"
        value={form.notes}
        onChange={updateForm}
      />

      <button type="button" onClick={submitCheck}>
        Save CD Stock Check
      </button>

      {message && (
        <p
          style={{
            fontWeight: "bold",
            color:
              message.includes("correct") ||
              message.includes("verified") ||
              message.includes("created")
                ? "green"
                : "red",
          }}
        >
          {message}
        </p>
      )}

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