import express from "express";
import cors from "cors";
import drugs from "./drugData.js";

const app = express();

app.use(cors());
app.use(express.json());

let entries = [];

/* ---------------- DRUG ROUTES ---------------- */

app.get("/drugs", (req, res) => {
  return res.status(200).json(drugs);
});

app.post("/drugs", (req, res) => {
  const newDrug = {
    id: Date.now(),
    name: req.body.name,
    class: req.body.class || req.body.size || "",
    stock: Number(req.body.stock ?? req.body.quantity ?? 0),
    unit: req.body.unit || req.body.concentration || "",
  };

  drugs.push(newDrug);

  return res.status(201).json(newDrug);
});

app.put("/drugs/:id", (req, res) => {
  const drug = drugs.find((d) => d.id === Number(req.params.id));

  if (!drug) {
    return res.status(404).json({ message: "Drug not found" });
  }

  drug.name = req.body.name ?? drug.name;
  drug.class = req.body.class ?? req.body.size ?? drug.class;
  drug.stock =
    req.body.stock !== undefined
      ? Number(req.body.stock)
      : req.body.quantity !== undefined
      ? Number(req.body.quantity)
      : drug.stock;
  drug.unit = req.body.unit ?? req.body.concentration ?? drug.unit;

  return res.status(200).json(drug);
});

app.delete("/drugs/:id", (req, res) => {
  const index = drugs.findIndex((d) => d.id === Number(req.params.id));

  if (index === -1) {
    return res.status(404).json({ message: "Drug not found" });
  }

  drugs.splice(index, 1);

  return res.status(204).end();
});

/* ---------------- LOGBOOK ENTRY ROUTES ---------------- */

app.get("/entries", (req, res) => {
  return res.status(200).json(entries);
});

app.post("/entries", (req, res) => {
  const selectedDrug = drugs.find((drug) => drug.name === req.body.drugName);

  if (!selectedDrug) {
    return res.status(404).json({ message: "Drug not found" });
  }

  const quantityUsed = Number(req.body.quantityUsed);

  if (!quantityUsed || quantityUsed <= 0) {
    return res.status(400).json({ message: "Invalid quantity used" });
  }

  if (quantityUsed > selectedDrug.stock) {
    return res.status(400).json({ message: "Not enough stock" });
  }

  selectedDrug.stock = selectedDrug.stock - quantityUsed;

  const newEntry = {
    id: Date.now(),
    patientName: req.body.patientName,
    hospitalNumber: req.body.hospitalNumber,
    drugName: req.body.drugName,
    doseGiven: req.body.doseGiven,
    quantityUsed,
    balance: selectedDrug.stock,
    staffId: req.body.staffId,
    staffName: req.body.staffName,
    checkerId: req.body.checkerId,
    checkerName: req.body.checkerName,
    staffSignature: req.body.staffSignature,
    checkerSignature: req.body.checkerSignature,
    dateTime: new Date().toLocaleString(),
  };

  entries.push(newEntry);

  return res.status(201).json({
    entry: newEntry,
    drugs,
  });
});

app.delete("/entries/:id", (req, res) => {
  const index = entries.findIndex((entry) => entry.id === Number(req.params.id));

  if (index === -1) {
    return res.status(404).json({ message: "Entry not found" });
  }

  entries.splice(index, 1);

  return res.status(204).end();
});

/* ---------------- SERVER ---------------- */

const PORT = 8000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});