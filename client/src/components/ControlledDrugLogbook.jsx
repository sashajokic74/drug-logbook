import { useEffect, useState } from "react";
import DrugRegister from "./DrugRegister";

import { API_URL } from "../apiConfig";

function ControlledDrugLogbook({ device, user }) {
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
    const params = new URLSearchParams();

    if (device?.hospitalId) params.set("hospitalId", device.hospitalId);
    if (device?.hospitalName) params.set("hospitalName", device.hospitalName);
    if (device?.locationId) params.set("locationId", device.locationId);
    if (device?.locationName) params.set("locationName", device.locationName);

    const query = params.toString() ? `?${params.toString()}` : "";
    const response = await fetch(`${API_URL}/drugs${query}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const data = await response.json();
    setInventory(Array.isArray(data) ? data.map(normaliseDrug) : []);
  }

  useEffect(() => {
    loadDrugs();
  }, [device?.hospitalId, device?.locationId]);

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

    const token = localStorage.getItem("token");

    await fetch(`${API_URL}/drugs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: newDrug.name.trim(),
        size: newDrug.size.trim(),
        concentration: newDrug.concentration.trim(),
        quantity: Number(newDrug.quantity),
        hospitalId: device?.hospitalId,
        hospitalName: device?.hospitalName,
        locationId: device?.locationId,
        locationName: device?.locationName,
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

    const token = localStorage.getItem("token");

    await fetch(`${API_URL}/drugs/${drugId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: updatedName.trim(),
        size: updatedSize.trim(),
        concentration: updatedConcentration.trim(),
        quantity: Number(updatedQuantity),
        hospitalId: device?.hospitalId,
        hospitalName: device?.hospitalName,
        locationId: device?.locationId,
        locationName: device?.locationName,
      }),
    });

    loadDrugs();
  }

  async function deleteDrug(drugId) {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this drug?"
    );

    if (!confirmDelete) return;

    const token = localStorage.getItem("token");

    await fetch(`${API_URL}/drugs/${drugId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
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

  const totalAmpoules = inventory.reduce(
    (total, drug) => total + Number(drug.quantity || 0),
    0
  );

  const lowStockCount = inventory.filter(
    (drug) => Number(drug.quantity || 0) < 5
  ).length;
  const canManageDrugStock = String(user?.role || "").toLowerCase() === "admin";

  function stockStatus(drug) {
    const quantity = Number(drug.quantity || 0);

    if (quantity === 0) return "No stock";
    if (quantity < 5) return "Low stock";
    return "In stock";
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
      <section className="register-hero">
        <div>
          <span className="eyebrow">Controlled drug register</span>
          <h1>Digital Logbook</h1>
          <p>
            {device?.locationName || "Clinical area"} ·{" "}
            {device?.hospitalName || "Hospital"}
          </p>
        </div>

        <div className="register-stats" aria-label="Stock summary">
          <div>
            <strong>{inventory.length}</strong>
            <span>Drugs</span>
          </div>

          <div>
            <strong>{totalAmpoules}</strong>
            <span>Ampoules</span>
          </div>

          <div className={lowStockCount > 0 ? "stat-alert" : ""}>
            <strong>{lowStockCount}</strong>
            <span>Low stock</span>
          </div>
        </div>
      </section>

      <div className="prototype-warning">
        <strong>Prototype Notice:</strong> This application is a prototype/demo
        only. Real clinical use requires approval from the relevant NHS or
        private trust and must comply with their data handling, governance,
        security and patient confidentiality policies.
      </div>

      <details className="add-drug-box add-drug-disclosure">
        <summary>
          <span>
            <strong>Add controlled drug</strong>
            <small>New stock is added to this selected hospital area.</small>
          </span>
        </summary>

        <div className="add-drug-grid">
          <label>
            Drug name
            <input
              name="name"
              placeholder="Midazolam"
              value={newDrug.name}
              onChange={handleNewDrugChange}
            />
          </label>

          <label>
            Size
            <input
              name="size"
              placeholder="2ml ampoule"
              value={newDrug.size}
              onChange={handleNewDrugChange}
            />
          </label>

          <label>
            Concentration
            <input
              name="concentration"
              placeholder="5mg/ml"
              value={newDrug.concentration}
              onChange={handleNewDrugChange}
            />
          </label>

          <label>
            Quantity
            <input
              type="number"
              name="quantity"
              placeholder="10"
              value={newDrug.quantity}
              onChange={handleNewDrugChange}
            />
          </label>

          <button type="button" onClick={addDrug}>
            Add Drug
          </button>
        </div>
      </details>

      <div className="section-heading">
        <div>
          <span className="eyebrow">Current stock</span>
          <h2 className="section-title">Drug Stock</h2>
        </div>
      </div>

      <section className="stock-grid">
        {inventory.map((drug) => (
          <div className="drug-tile" key={drug.id}>
            <div className={`flip-card ${getDrugClass(drug.name)}`}>
              <div className="flip-card-inner">
                <div className="flip-card-front">
                  <h3>{drug.name}</h3>
                  <span className="stock-status">{stockStatus(drug)}</span>
                  <strong>{drug.quantity}</strong>
                  <small>ampoules available</small>
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

                  {canManageDrugStock && (
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
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="register-card-btn"
              onClick={() => setSelectedDrug(drug)}
            >
              Register
            </button>
          </div>
        ))}
      </section>
    </main>
  );
}

export default ControlledDrugLogbook;
