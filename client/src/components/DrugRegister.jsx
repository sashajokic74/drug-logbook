import { useEffect, useState } from "react";

const API_URL = "http://localhost:8000";
const REORDER_LEVEL = 5;

function DrugRegister({ drug, onClose }) {
  const [transactions, setTransactions] = useState([]);
  const [balance, setBalance] = useState(Number(drug.quantity || 0));
  const [showSupplyForm, setShowSupplyForm] = useState(false);

  const [administeredUser, setAdministeredUser] = useState(null);
  const [checkerUser, setCheckerUser] = useState(null);

  const [adminForm, setAdminForm] = useState({
    username: "",
    password: "",
  });

  const [checkerForm, setCheckerForm] = useState({
    username: "",
    password: "",
  });

  const [supplyForm, setSupplyForm] = useState({
    ampoulesReceived: "",
    requisitionNumber: "",
    receivedById: "",
    receivedByName: "",
    receivedSignature: "",
    checkedById: "",
    checkedByName: "",
    checkedSignature: "",
  });

  const [form, setForm] = useState({
    patientName: "",
    hospitalNumber: "",
    ampoulesUsed: "",
    amountAdministered: "",
    administeredUnit: "mcg",
    amountWasted: "",
    wastedUnit: "mcg",
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
      setTransactions(Array.isArray(transactionsData) ? transactionsData : []);

      const drugsResponse = await fetch(`${API_URL}/drugs`);
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

  function updateAdminForm(event) {
    setAdminForm({
      ...adminForm,
      [event.target.name]: event.target.value,
    });
  }

  function updateCheckerForm(event) {
    setCheckerForm({
      ...checkerForm,
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
    return Number(balance || 0) - Number(form.ampoulesUsed || 0);
  }

  function supplyNewBalance() {
    return Number(balance || 0) + Number(supplyForm.ampoulesReceived || 0);
  }

  function parseNumberFromText(text) {
    if (!text) return 0;

    const match = String(text).match(/[\d.]+/);

    if (!match) return 0;

    return Number(match[0]);
  }

  function getConcentrationValue() {
    return parseNumberFromText(drug.concentration);
  }

  function getAmpouleVolume() {
    return parseNumberFromText(drug.size);
  }

  function getDoseUnit() {
    const concentration = String(drug.concentration || "").toLowerCase();

    if (concentration.includes("mcg")) return "mcg";
    if (concentration.includes("mg")) return "mg";
    if (concentration.includes("ml")) return "ml";

    return form.administeredUnit || "mcg";
  }

  function amountPerAmpoule() {
    const concentrationValue = getConcentrationValue();
    const volume = getAmpouleVolume();

    if (!concentrationValue || !volume) return 0;

    if (String(drug.concentration || "").includes("/ml")) {
      return concentrationValue * volume;
    }

    return concentrationValue;
  }

  function totalAvailableFromOpenedAmpoules() {
    return Number(form.ampoulesUsed || 0) * amountPerAmpoule();
  }

  function totalAccountedFor() {
    return Number(form.amountAdministered || 0) + Number(form.amountWasted || 0);
  }

  function discrepancyAmount() {
    return totalAvailableFromOpenedAmpoules() - totalAccountedFor();
  }

  function isDoseBalanced() {
    if (!form.ampoulesUsed) return false;

    return Math.abs(discrepancyAmount()) < 0.0001;
  }

  async function verifyAdministeredBy() {
    const response = await fetch(`${API_URL}/checker/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: adminForm.username,
        password: adminForm.password,
        currentUserId: null,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.message);
      setAdministeredUser(null);
      return;
    }

    if (result.role === "admin") {
      alert("Admin account cannot be used as the administering clinician.");
      setAdministeredUser(null);
      return;
    }

    setAdministeredUser(result);
    alert(`Administered by verified: ${result.fullName}`);
  }

  async function verifySecondChecker() {
    if (!administeredUser) {
      alert("Verify the administering staff first.");
      return;
    }

    const response = await fetch(`${API_URL}/checker/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: checkerForm.username,
        password: checkerForm.password,
        currentUserId: administeredUser.id,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.message);
      setCheckerUser(null);
      return;
    }

    if (result.role === "admin") {
      alert("Admin account cannot be used as the second checker.");
      setCheckerUser(null);
      return;
    }

    setCheckerUser(result);
    alert(`Second checker verified: ${result.fullName}`);
  }

  async function saveSupplyEntry() {
    const received = Number(supplyForm.ampoulesReceived || 0);

    if (!received || received <= 0) {
      alert("Enter ampoules received from pharmacy");
      return;
    }

    if (!supplyForm.receivedByName || !supplyForm.checkedByName) {
      alert("Received by and checked by are required");
      return;
    }

    if (
      supplyForm.receivedByName.trim().toLowerCase() ===
      supplyForm.checkedByName.trim().toLowerCase()
    ) {
      alert("Received by and checked by must be two different people");
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
        administeredById: supplyForm.receivedById,
        administeredByName: supplyForm.receivedByName,
        administeredSignature: supplyForm.receivedSignature,
        witnessId: supplyForm.checkedById,
        witnessName: supplyForm.checkedByName,
        witnessSignature: supplyForm.checkedSignature,
        notes: supplyForm.requisitionNumber || "Pharmacy stock supply received",
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.message);
      return;
    }

    setSupplyForm({
      ampoulesReceived: "",
      requisitionNumber: "",
      receivedById: "",
      receivedByName: "",
      receivedSignature: "",
      checkedById: "",
      checkedByName: "",
      checkedSignature: "",
    });

    setShowSupplyForm(false);
    await loadTransactions();
  }

  async function savePatientEntry() {
    if (!administeredUser) {
      alert("Administered by staff must be verified first.");
      return;
    }

    if (!checkerUser) {
      alert("Second checker must be verified before saving.");
      return;
    }

    if (Number(administeredUser.id) === Number(checkerUser.id)) {
      alert("Same person cannot administer and check.");
      return;
    }

    if (patientNewBalance() < 0) {
      alert("Not enough stock");
      return;
    }

    if (!isDoseBalanced()) {
      alert(
        `Dose mismatch. Opened ampoules contain ${totalAvailableFromOpenedAmpoules()} ${getDoseUnit()}, but administered + wasted = ${totalAccountedFor()} ${getDoseUnit()}. Discrepancy: ${discrepancyAmount()} ${getDoseUnit()}`
      );
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
        administeredUnit: getDoseUnit(),
        amountWasted: Number(form.amountWasted || 0),
        wastedUnit: getDoseUnit(),
        administeredById: administeredUser.id,
        administeredByName:
          administeredUser.fullName || administeredUser.username,
        administeredSignature: administeredUser.username,
        witnessId: checkerUser.id,
        witnessName: checkerUser.fullName || checkerUser.username,
        witnessSignature: checkerUser.username,
        notes: form.notes,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.message);
      return;
    }

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
      notes: "",
    });

    setAdminForm({ username: "", password: "" });
    setCheckerForm({ username: "", password: "" });
    setAdministeredUser(null);
    setCheckerUser(null);

    await loadTransactions();
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
          ⚠️ LOW STOCK — order from pharmacy
        </p>
      )}

      <button type="button" onClick={() => setShowSupplyForm(!showSupplyForm)}>
        {showSupplyForm
          ? "Hide Pharmacy Stock Supply"
          : "➕ Receive Pharmacy Stock"}
      </button>

      {showSupplyForm && (
        <>
          <h3>📦 Pharmacy Stock Supply</h3>

          <input value={`Current balance: ${balance} ampoules`} disabled />

          <input
            name="ampoulesReceived"
            placeholder="Ampoules received from pharmacy"
            value={supplyForm.ampoulesReceived}
            onChange={updateSupplyForm}
          />

          <input
            value={`Balance after supply: ${supplyNewBalance()} ampoules`}
            disabled
          />

          <input
            name="requisitionNumber"
            placeholder="Requisition number / pharmacy note"
            value={supplyForm.requisitionNumber}
            onChange={updateSupplyForm}
          />

          <h4>Received By</h4>

          <input
            name="receivedById"
            placeholder="Staff ID"
            value={supplyForm.receivedById}
            onChange={updateSupplyForm}
          />

          <input
            name="receivedByName"
            placeholder="Staff name"
            value={supplyForm.receivedByName}
            onChange={updateSupplyForm}
          />

          <input
            name="receivedSignature"
            placeholder="Signature"
            value={supplyForm.receivedSignature}
            onChange={updateSupplyForm}
          />

          <h4>Checked By</h4>

          <input
            name="checkedById"
            placeholder="Checker ID"
            value={supplyForm.checkedById}
            onChange={updateSupplyForm}
          />

          <input
            name="checkedByName"
            placeholder="Checker name"
            value={supplyForm.checkedByName}
            onChange={updateSupplyForm}
          />

          <input
            name="checkedSignature"
            placeholder="Checker signature"
            value={supplyForm.checkedSignature}
            onChange={updateSupplyForm}
          />

          <button type="button" onClick={saveSupplyEntry}>
            ➕ Add Pharmacy Supply
          </button>

          <hr />
        </>
      )}

      <h3>👤 Patient Entry</h3>

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

      <h3>Dose Reconciliation</h3>

      <input
        value={`Amount per ampoule: ${amountPerAmpoule()} ${getDoseUnit()}`}
        disabled
      />

      <input
        value={`Opened ampoules total: ${totalAvailableFromOpenedAmpoules()} ${getDoseUnit()}`}
        disabled
      />

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
        value={`Administered + wasted: ${totalAccountedFor()} ${getDoseUnit()}`}
        disabled
      />

      <input
        value={`Discrepancy: ${discrepancyAmount()} ${getDoseUnit()}`}
        disabled
      />

      {form.ampoulesUsed && (
        <p
          style={{
            color: isDoseBalanced() ? "green" : "red",
            fontWeight: "bold",
          }}
        >
          {isDoseBalanced()
            ? "✓ Dose fully accounted for"
            : "⚠️ Administered + wasted does not match opened ampoule amount"}
        </p>
      )}

      <h3>Administered By Verification</h3>

      <input
        name="username"
        placeholder="Administering staff username"
        value={adminForm.username}
        onChange={updateAdminForm}
      />

      <input
        name="password"
        type="password"
        placeholder="Administering staff password"
        value={adminForm.password}
        onChange={updateAdminForm}
      />

      <button type="button" onClick={verifyAdministeredBy}>
        Verify Administered By
      </button>

      {administeredUser && (
        <p style={{ color: "green", fontWeight: "bold" }}>
          ✓ Administered by verified: {administeredUser.fullName} (
          {administeredUser.role})
        </p>
      )}

      <h3>Second Checker Verification</h3>

      <input
        name="username"
        placeholder="Checker username"
        value={checkerForm.username}
        onChange={updateCheckerForm}
      />

      <input
        name="password"
        type="password"
        placeholder="Checker password"
        value={checkerForm.password}
        onChange={updateCheckerForm}
      />

      <button type="button" onClick={verifySecondChecker}>
        Verify Second Checker
      </button>

      {checkerUser && (
        <p style={{ color: "green", fontWeight: "bold" }}>
          ✓ Second checker verified: {checkerUser.fullName} ({checkerUser.role})
        </p>
      )}

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
            <th>Type</th>
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
          {transactions.map((entry) => {
            const isSupply =
              Number(entry.ampoulesSupplied || 0) > 0 &&
              Number(entry.ampoulesUsed || 0) === 0;

            return (
              <tr key={entry.id}>
                <td>{entry.createdAt}</td>
                <td>{isSupply ? "Pharmacy Supply" : "Patient Use"}</td>
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default DrugRegister;