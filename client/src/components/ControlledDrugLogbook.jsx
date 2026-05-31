import { useEffect, useState } from "react";
import drugsData from "../drug data/drugs";

function ControlledDrugLogbook() {
  const AUTHORISED_DELETE_ID = "112233";

  const [inventory, setInventory] = useState(drugsData);
  const [entries, setEntries] = useState([]);

  const [newDrug, setNewDrug] = useState({
    name: "",
    size: "",
    concentration: "",
    quantity: "",
  });

  const [formData, setFormData] = useState({
    patientName: "",
    hospitalNumber: "",
    drugName: "",
    doseGiven: "",
    quantityUsed: "",
    staffId: "",
    staffName: "",
    checkerId: "",
    checkerName: "",
    staffSignature: "",
    checkerSignature: "",
  });

  useEffect(() => {
    const savedEntries = localStorage.getItem("logbookEntries");
    const savedInventory = localStorage.getItem("drugInventory");

    if (savedEntries) setEntries(JSON.parse(savedEntries));
    if (savedInventory) setInventory(JSON.parse(savedInventory));
  }, []);

  useEffect(() => {
    localStorage.setItem("logbookEntries", JSON.stringify(entries));
    localStorage.setItem("drugInventory", JSON.stringify(inventory));
  }, [entries, inventory]);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData({ ...formData, [name]: value });
  }

  function handleNewDrugChange(event) {
    const { name, value } = event.target;
    setNewDrug({ ...newDrug, [name]: value });
  }

  function addDrug() {
    if (!newDrug.name || !newDrug.size || !newDrug.concentration || !newDrug.quantity) {
      alert("Please complete all drug fields");
      return;
    }

    setInventory([
      ...inventory,
      {
        id: Date.now(),
        name: newDrug.name,
        size: newDrug.size,
        concentration: newDrug.concentration,
        quantity: Number(newDrug.quantity),
      },
    ]);

    setNewDrug({
      name: "",
      size: "",
      concentration: "",
      quantity: "",
    });
  }

  function handleSubmit(event) {
    event.preventDefault();

    const selectedDrug = inventory.find(
      (drug) => drug.name === formData.drugName
    );

    const quantityUsed = Number(formData.quantityUsed);

    if (!selectedDrug) return alert("Please select a drug");
    if (!quantityUsed || quantityUsed <= 0) return alert("Please enter quantity used");
    if (quantityUsed > selectedDrug.quantity) return alert("Not enough stock");

    const newBalance = selectedDrug.quantity - quantityUsed;

    setInventory(
      inventory.map((drug) =>
        drug.name === formData.drugName
          ? { ...drug, quantity: newBalance }
          : drug
      )
    );

    setEntries([
      ...entries,
      {
        ...formData,
        balance: newBalance,
        dateTime: new Date().toLocaleString(),
      },
    ]);

    setFormData({
      patientName: "",
      hospitalNumber: "",
      drugName: "",
      doseGiven: "",
      quantityUsed: "",
      staffId: "",
      staffName: "",
      checkerId: "",
      checkerName: "",
      staffSignature: "",
      checkerSignature: "",
    });
  }

  function deleteEntry(indexToDelete) {
    const enteredId = prompt("Enter authorised staff ID to delete:");

    if (enteredId !== AUTHORISED_DELETE_ID) {
      alert("Not authorised");
      return;
    }

    setEntries(entries.filter((_, index) => index !== indexToDelete));
  }

  function getDrugClass(name) {
    const drugName = name.toLowerCase();

    if (drugName.includes("midazolam")) return "midazolam-card";
    if (drugName.includes("preservative")) return "pf-morphine-card";
    if (drugName.includes("cocaine")) return "cocaine-card";
    if (drugName.includes("ketamine")) return "ketamine-card";
    if (drugName.includes("alfentanil")) return "alfentanil-card";
    if (drugName.includes("oxycodone")) return "oxycodone-card";
    if (drugName.includes("morphine")) return "morphine-card";
    if (drugName.includes("remifentanil")) return "remifentanil-card";

    return "fentanyl-card";
  }

  return (
    <main className="page">
      <h1>Controlled Drug Digital Logbook</h1>

      <div className="prototype-warning">
        <strong>Prototype Notice:</strong> This application is a prototype/demo only.
        Real clinical use requires approval from the relevant NHS or private trust and
        must comply with their data handling, governance, security and patient
        confidentiality policies.
      </div>

      <div className="add-drug-box">
        <h2>➕ Add New Drug</h2>

        <div className="add-drug-grid">
          <input
            name="name"
            placeholder="Drug name"
            value={newDrug.name}
            onChange={handleNewDrugChange}
          />

          <input
            name="size"
            placeholder="Size"
            value={newDrug.size}
            onChange={handleNewDrugChange}
          />

          <input
            name="concentration"
            placeholder="Concentration"
            value={newDrug.concentration}
            onChange={handleNewDrugChange}
          />

          <input
            type="number"
            name="quantity"
            placeholder="Quantity"
            value={newDrug.quantity}
            onChange={handleNewDrugChange}
          />

          <button type="button" onClick={addDrug}>
            Add Drug
          </button>
        </div>
      </div>

      <form className="drug-form" onSubmit={handleSubmit}>
        <div className="form-section">
          <h2>👥 Patient Details</h2>

          <label>
            Patient Name
            <input
              name="patientName"
              value={formData.patientName}
              onChange={handleChange}
              placeholder="Enter patient name"
            />
          </label>

          <label>
            Hospital / NHS Number
            <input
              name="hospitalNumber"
              value={formData.hospitalNumber}
              onChange={handleChange}
              placeholder="Enter NHS number"
            />
          </label>
        </div>

        <div className="form-section">
          <h2>💊 Drug Details</h2>

          <label>
            Select Drug
            <select
              name="drugName"
              value={formData.drugName}
              onChange={handleChange}
            >
              <option value="">Select a drug</option>
              {inventory.map((drug, index) => (
                <option key={index} value={drug.name}>
                  {drug.name} - {drug.quantity} remaining
                </option>
              ))}
            </select>
          </label>

          <label>
            Dose Given
            <input
              name="doseGiven"
              value={formData.doseGiven}
              onChange={handleChange}
              placeholder="e.g. 50 mcg"
            />
          </label>

          <label>
            Quantity Used
            <input
              type="number"
              name="quantityUsed"
              value={formData.quantityUsed}
              onChange={handleChange}
              placeholder="Enter quantity used"
            />
          </label>
        </div>

        <div className="form-section">
          <h2>👤 Staff Details</h2>

          <label>
            Staff ID
            <input
              name="staffId"
              value={formData.staffId}
              onChange={handleChange}
              placeholder="Enter staff ID"
            />
          </label>

          <label>
            Staff Name
            <input
              name="staffName"
              value={formData.staffName}
              onChange={handleChange}
              placeholder="Enter staff name"
            />
          </label>

          <label>
            Staff Digital Signature
            <input
              name="staffSignature"
              value={formData.staffSignature}
              onChange={handleChange}
              placeholder="Staff signature"
            />
          </label>
        </div>

        <div className="form-section">
          <h2>Checker Details</h2>

          <label>
            Checker ID
            <input
              name="checkerId"
              value={formData.checkerId}
              onChange={handleChange}
              placeholder="Enter checker ID"
            />
          </label>

          <label>
            Checker Name
            <input
              name="checkerName"
              value={formData.checkerName}
              onChange={handleChange}
              placeholder="Enter checker name"
            />
          </label>

          <label>
            Checker Digital Signature
            <input
              name="checkerSignature"
              value={formData.checkerSignature}
              onChange={handleChange}
              placeholder="Checker signature"
            />
          </label>
        </div>

        <button type="submit">💾 Save Entry</button>
      </form>

      <h2 className="section-title">📦 Drug Stock</h2>

      <section className="stock-grid">
        {inventory.map((drug, index) => (
          <div className={`flip-card ${getDrugClass(drug.name)}`} key={index}>
            <div className="flip-card-inner">
              <div className="flip-card-front">
                <h3>{drug.name}</h3>
                <div className="pill-icon">💊</div>
                <strong>{drug.quantity}</strong>
                <small>Hover to view</small>
              </div>

              <div className="flip-card-back">
                <h3>{drug.name}</h3>

                <p>
                  <strong>Size</strong>
                  <br />
                  {drug.size}
                </p>

                <p>
                  <strong>Concentration</strong>
                  <br />
                  {drug.concentration}
                </p>

                <p>
                  <strong>Available Quantity</strong>
                  <br />
                  {drug.quantity}
                </p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <h2 className="section-title">Patient Drug Entries</h2>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date / Time</th>
              <th>Patient</th>
              <th>NHS No.</th>
              <th>Drug</th>
              <th>Dose</th>
              <th>Used</th>
              <th>Balance</th>
              <th>Staff</th>
              <th>Checker</th>
              <th>Signatures</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {entries.map((entry, index) => (
              <tr key={index}>
                <td>{entry.dateTime}</td>
                <td>{entry.patientName}</td>
                <td>{entry.hospitalNumber}</td>
                <td>{entry.drugName}</td>
                <td>{entry.doseGiven}</td>
                <td>{entry.quantityUsed}</td>
                <td>
                  <span className="balance-pill">{entry.balance}</span>
                </td>
                <td>
                  {entry.staffName}
                  <br />
                  ({entry.staffId})
                </td>
                <td>
                  {entry.checkerName}
                  <br />
                  ({entry.checkerId})
                </td>
                <td>
                  Staff: {entry.staffSignature}
                  <br />
                  Checker: {entry.checkerSignature}
                </td>
                <td>
                  <button
                    className="delete-btn"
                    onClick={() => deleteEntry(index)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="auth-note">🔐 Authorised delete ID required: 112233</p>
    </main>
  );
}

export default ControlledDrugLogbook;