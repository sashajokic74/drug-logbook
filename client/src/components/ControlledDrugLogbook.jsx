import { useEffect, useState } from "react";
import DrugRegister from "./DrugRegister";

const API_URL = "http://localhost:8000";

function ControlledDrugLogbook({ device }) {
  const AUTHORISED_DELETE_ID = "112233";

  const [inventory, setInventory] = useState([]);
  const [selectedDrug, setSelectedDrug] = useState(null);

  const [newDrug, setNewDrug] = useState({
    name: "",
    size: "",
    concentration: "",
    quantity: "",
  });

  function normaliseDrug(drug) {
    return {
      id: drug.id,
      name: drug.name || "",
      size: drug.size || "",
      concentration: drug.concentration || "",
      quantity: Number(drug.quantity || 0),
      category: drug.category || "",
    };
  }

  async function loadDrugs() {
    const response = await fetch(`${API_URL}/drugs`);
    const data = await response.json();
    setInventory(data.map(normaliseDrug));
  }

  useEffect(() => {
    loadDrugs();
  }, []);

  function handleNewDrugChange(event) {
    const { name, value } = event.target;

    setNewDrug({
      ...newDrug,
      [name]: value,
    });
  }

  async function addDrug() {
    if (
      !newDrug.name ||
      !newDrug.size ||
      !newDrug.concentration ||
      !newDrug.quantity
    ) {
      alert("Please complete all drug fields");
      return;
    }

    await fetch(`${API_URL}/drugs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: newDrug.name.trim(),
        size: newDrug.size.trim(),
        concentration: newDrug.concentration.trim(),
        quantity: Number(newDrug.quantity),
      }),
    });

    setNewDrug({
      name: "",
      size: "",
      concentration: "",
      quantity: "",
    });

    loadDrugs();
  }

  async function editDrug(drugId) {
    const drugToEdit = inventory.find((drug) => drug.id === drugId);
    if (!drugToEdit) return;

    const updatedName = prompt("Edit drug name:", drugToEdit.name);
    if (updatedName === null) return;

    const updatedSize = prompt("Edit size:", drugToEdit.size);
    if (updatedSize === null) return;

    const updatedConcentration = prompt(
      "Edit concentration:",
      drugToEdit.concentration
    );
    if (updatedConcentration === null) return;

    const updatedQuantity = prompt("Edit quantity:", drugToEdit.quantity);
    if (updatedQuantity === null) return;

    if (
      !updatedName.trim() ||
      !updatedSize.trim() ||
      !updatedConcentration.trim() ||
      updatedQuantity === "" ||
      Number.isNaN(Number(updatedQuantity))
    ) {
      alert("All drug fields are required");
      return;
    }

    await fetch(`${API_URL}/drugs/${drugId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: updatedName.trim(),
        size: updatedSize.trim(),
        concentration: updatedConcentration.trim(),
        quantity: Number(updatedQuantity),
      }),
    });

    loadDrugs();
  }

  async function deleteDrug(drugId) {
    const enteredId = prompt("Enter authorised staff ID to delete drug:");

    if (enteredId !== AUTHORISED_DELETE_ID) {
      alert("Not authorised");
      return;
    }

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this drug?"
    );

    if (!confirmDelete) return;

    await fetch(`${API_URL}/drugs/${drugId}`, {
      method: "DELETE",
    });

    loadDrugs();
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

  if (selectedDrug) {
    return (
      <main className="page">
        <DrugRegister
          drug={selectedDrug}
          device={device}
          onClose={() => {
            setSelectedDrug(null);
            loadDrugs();
          }}
        />
      </main>
    );
  }

  return (
    <main className="page">
      <h1>Controlled Drug Digital Logbook</h1>

      <div className="prototype-warning">
        <strong>Prototype Notice:</strong> This application is a prototype/demo
        only. Real clinical use requires approval from the relevant NHS or
        private trust and must comply with their data handling, governance,
        security and patient confidentiality policies.
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

      <h2 className="section-title">📦 Drug Stock</h2>

      <section className="stock-grid">
        {inventory.map((drug) => (
          <div className={`flip-card ${getDrugClass(drug.name)}`} key={drug.id}>
            <div className="flip-card-inner">
              <div
                className="flip-card-front"
                onClick={() => setSelectedDrug(drug)}
                style={{ cursor: "pointer" }}
              >
                <h3>{drug.name}</h3>
                <div className="pill-icon">💊</div>
                <strong>{drug.quantity}</strong>
                <small>Click to open register</small>
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

                <div className="drug-card-actions">
                  <button
                    type="button"
                    className="edit-btn"
                    onClick={() => editDrug(drug.id)}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="delete-btn"
                    onClick={() => deleteDrug(drug.id)}
                  >
                    Delete
                  </button>

                  <button
                    type="button"
                    className="edit-btn"
                    onClick={() => setSelectedDrug(drug)}
                  >
                    Register
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>

      <p className="auth-note">🔐 Authorised delete ID required: 112233</p>
    </main>
  );
}

export default ControlledDrugLogbook;
