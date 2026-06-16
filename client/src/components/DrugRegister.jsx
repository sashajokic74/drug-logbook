import { useEffect, useState } from "react";

const API_URL = "http://localhost:8000";
const REORDER_LEVEL = 5;

function DrugRegister({ drug, onClose }) {
  const [transactions, setTransactions] = useState([]);
  const [balance, setBalance] = useState(Number(drug.quantity || 0));

  const [supplyForm, setSupplyForm] = useState({
    ampoulesReceived: "",
    notes: "",
  });

  const [form, setForm] = useState({
    patientName: "",
    hospitalNumber: "",
    ampoulesUsed: "",
    amountAdministered: "",
    administeredUnit: "mcg",
    amountWasted: "",
    wastedUnit: "mcg",
    administeredById: "",
    administeredByName: "",
    administeredSignature: "",
    witnessId: "",
    witnessName: "",
    witnessSignature: "",
    notes: "",
  });

  useEffect(() => {
    loadTransactions();
  }, [drug.id]);

  async function loadTransactions() {
    try {
      const token = localStorage.getItem("token");

      const transactionsResponse = await fetch(
        `${API_URL}/transactions/${drug.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const transactionsData = await transactionsResponse.json();

      if (Array.isArray(transactionsData)) {
        setTransactions(transactionsData);
      } else {
        setTransactions([]);
      }

      const drugsResponse = await fetch(`${API_URL}/drugs`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const drugsData = await drugsResponse.json();

      const currentDrug = drugsData.find(
        (item) => Number(item.id) === Number(drug.id)
      );

      if (currentDrug) {
        setBalance(Number(currentDrug.quantity || 0));
      }
    } catch (error) {
      console.log(error);
    }
  }

  function updateForm(event) {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
  }

  function updateSupplyForm(event) {
    setSupplyForm({
      ...supplyForm,
      [event.target.name]: event.target.value,
    });
  }

  function patientNewBalance() {
    const used = Number(form.ampoulesUsed || 0);
    return Number(balance || 0) - used;
  }

  function supplyNewBalance() {
    const received = Number(supplyForm.ampoulesReceived || 0);
    return Number(balance || 0) + received;
  }

  function totalAccountedFor() {
    return Number(form.amountAdministered || 0) + Number(form.amountWasted || 0);
  }

  async function saveSupplyEntry() {
    const received = Number(supplyForm.ampoulesReceived || 0);

    if (!received || received <= 0) {
      alert("Enter ampoules received from pharmacy");
      return;
    }

    const token = localStorage.getItem("token");

    const response = await fetch(`${API_URL}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        drugId: drug.id,
        drugName: drug.name,

        patientName: "",
        hospitalNumber: "",

        ampoulesSupplied: received,
        ampoulesUsed: 0,

        amountAdministered: 0,
        administeredUnit: "",
        amountWasted: 0,
        wastedUnit: "",

        administeredById: "PHARMACY",
        administeredByName: "Pharmacy Supply",
        administeredSignature: "Pharmacy",

        witnessId: "STOCK",
        witnessName: "Stock Update",
        witnessSignature: "Stock",

        notes: supplyForm.notes || "Pharmacy stock received",
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.message);
      return;
    }

    setSupplyForm({
      ampoulesReceived: "",
      notes: "",
    });

    await loadTransactions();
  }

  async function savePatientEntry() {
    const administeredPerson = form.administeredByName || form.administeredById;
    const witnessPerson = form.witnessName || form.witnessId;

    if (!administeredPerson || !witnessPerson) {
      alert("Administered by and witness/checker are required");
      return;
    }

    if (
      administeredPerson.trim().toLowerCase() ===
      witnessPerson.trim().toLowerCase()
    ) {
      alert("Administered by and witness/checker must be different people");
      return;
    }

    if (patientNewBalance() < 0) {
      alert("Not enough stock");
      return;
    }

    const token = localStorage.getItem("token");

    const response = await fetch(`${API_URL}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        drugId: drug.id,
        drugName: drug.name,

        patientName: form.patientName,
        hospitalNumber: form.hospitalNumber,

        ampoulesSupplied: 0,
        ampoulesUsed: Number(form.ampoulesUsed || 0),

        amountAdministered: Number(form.amountAdministered || 0),
        administeredUnit: form.administeredUnit,

        amountWasted: Number(form.amountWasted || 0),
        wastedUnit: form.wastedUnit,

        administeredById: form.administeredById,
        administeredByName: administeredPerson,
        administeredSignature: form.administeredSignature,

        witnessId: form.witnessId,
        witnessName: witnessPerson,
        witnessSignature: form.witnessSignature,

        notes: form.notes,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.message);
      return;
    }

    await loadTransactions();

    if (result.reorderRequired) {
      alert("⚠️ Stock below 5 ampoules. Reorder from pharmacy.");
    }

    setForm({
      patientName: "",
      hospitalNumber: "",
      ampoulesUsed: "",
      amountAdministered: "",
      administeredUnit: "mcg",
      amountWasted: "",
      wastedUnit: "mcg",
      administeredById: "",
      administeredByName: "",
      administeredSignature: "",
      witnessId: "",
      witnessName: "",
      witnessSignature: "",
      notes: "",
    });
  }

  return (
    <div className="register-box">
      <button onClick={onClose}>← Back to Drugs</button>

      <h2>📖 {drug.name} Register</h2>

      <p>
        <strong>Size:</strong> {drug.size} |{" "}
        <strong>Concentration:</strong> {drug.concentration}
      </p>

      <h2>Current Balance: {balance} ampoules</h2>

      {balance < REORDER_LEVEL && (
        <p style={{ color: "red", fontWeight: "bold" }}>
          ⚠️ Stock below 5 ampoules. Reorder from pharmacy.
        </p>
      )}

      <h3>Pharmacy Stock Supply</h3>

      <input value={`Current balance: ${balance} ampoules`} disabled />

      <input
        name="ampoulesReceived"
        placeholder="Ampoules received from pharmacy"
        value={supplyForm.ampoulesReceived}
        onChange={updateSupplyForm}
      />

      <input
        value={`Balance after pharmacy supply: ${supplyNewBalance()} ampoules`}
        disabled
      />

      <input
        name="notes"
        placeholder="Requisition number / pharmacy note"
        value={supplyForm.notes}
        onChange={updateSupplyForm}
      />

      <button type="button" onClick={saveSupplyEntry}>
        ➕ Add Pharmacy Supply
      </button>

      <hr />

      <h3>Patient Entry</h3>

      <input
        name="patientName"
        placeholder="Patient name"
        value={form.patientName}
        onChange={updateForm}
      />

      <input
        name="hospitalNumber"
        placeholder="Hospital number / MRN / NHS No."
        value={form.hospitalNumber}
        onChange={updateForm}
      />

      <h3>Stock Used For Patient</h3>

      <input value={`Previous balance: ${balance} ampoules`} disabled />

      <input
        name="ampoulesUsed"
        placeholder="Ampoules opened / used"
        value={form.ampoulesUsed}
        onChange={updateForm}
      />

      <input value={`New balance: ${patientNewBalance()} ampoules`} disabled />

      {patientNewBalance() < REORDER_LEVEL && (
        <p style={{ color: "red", fontWeight: "bold" }}>
          ⚠️ Reorder required from pharmacy
        </p>
      )}

      <h3>Dose Given / Wasted</h3>

      <input
        name="amountAdministered"
        placeholder="Amount administered"
        value={form.amountAdministered}
        onChange={updateForm}
      />

      <select
        name="administeredUnit"
        value={form.administeredUnit}
        onChange={updateForm}
      >
        <option>mcg</option>
        <option>mg</option>
        <option>ml</option>
      </select>

      <input
        name="amountWasted"
        placeholder="Amount wasted"
        value={form.amountWasted}
        onChange={updateForm}
      />

      <select name="wastedUnit" value={form.wastedUnit} onChange={updateForm}>
        <option>mcg</option>
        <option>mg</option>
        <option>ml</option>
      </select>

      <input
        value={`Total accounted for: ${totalAccountedFor()} ${form.administeredUnit}`}
        disabled
      />

      <h3>Administered By</h3>

      <input
        name="administeredById"
        placeholder="Staff ID"
        value={form.administeredById}
        onChange={updateForm}
      />

      <input
        name="administeredByName"
        placeholder="Staff name"
        value={form.administeredByName}
        onChange={updateForm}
      />

      <input
        name="administeredSignature"
        placeholder="Digital signature"
        value={form.administeredSignature}
        onChange={updateForm}
      />

      <h3>Witness / Checker</h3>

      <input
        name="witnessId"
        placeholder="Witness ID"
        value={form.witnessId}
        onChange={updateForm}
      />

      <input
        name="witnessName"
        placeholder="Witness name"
        value={form.witnessName}
        onChange={updateForm}
      />

      <input
        name="witnessSignature"
        placeholder="Witness signature"
        value={form.witnessSignature}
        onChange={updateForm}
      />

      <input
        name="notes"
        placeholder="Notes"
        value={form.notes}
        onChange={updateForm}
      />

      <button type="button" onClick={savePatientEntry}>
        💾 Save Patient Entry
      </button>

      <h3>Register Entries</h3>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Patient</th>
            <th>MRN / NHS No.</th>
            <th>Received</th>
            <th>Used</th>
            <th>Given</th>
            <th>Waste</th>
            <th>Balance After</th>
            <th>Staff</th>
            <th>Witness</th>
            <th>Notes</th>
          </tr>
        </thead>

        <tbody>
          {transactions.map((entry) => (
            <tr key={entry.id}>
              <td>{entry.createdAt}</td>
              <td>{entry.patientName || "-"}</td>
              <td>{entry.hospitalNumber || "-"}</td>
              <td>{entry.ampoulesSupplied}</td>
              <td>{entry.ampoulesUsed}</td>
              <td>
                {entry.amountAdministered}
                {entry.administeredUnit}
              </td>
              <td>
                {entry.amountWasted}
                {entry.wastedUnit}
              </td>
              <td>{entry.stockBalanceAfter}</td>
              <td>{entry.administeredByName}</td>
              <td>{entry.witnessName}</td>
              <td>{entry.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DrugRegister;