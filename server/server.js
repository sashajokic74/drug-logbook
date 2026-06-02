import express from "express";
import cors from "cors";
import drugs from "./drugData.js";
import db from "./database.js";

const app = express();

app.use(cors());
app.use(express.json());

let entries = [];

/* ---------------- DATABASE SEED ---------------- */

const existingDrugs = db.prepare("SELECT * FROM drugs").all();

if (existingDrugs.length === 0) {
  const insertDrug = db.prepare(`
    INSERT INTO drugs (name, category, size, concentration, quantity)
    VALUES (?, ?, ?, ?, ?)
  `);

  drugs.forEach((drug) => {
    insertDrug.run(
      drug.name,
      drug.category || "",
      drug.size || "",
      drug.concentration || "",
      Number(drug.quantity || 0)
    );
  });
}

/* ---------------- DRUG ROUTES ---------------- */

app.get("/drugs", (req, res) => {
  const allDrugs = db.prepare("SELECT * FROM drugs").all();
  return res.status(200).json(allDrugs);
});

app.post("/drugs", (req, res) => {
  const result = db
    .prepare(
      `
      INSERT INTO drugs (name, category, size, concentration, quantity)
      VALUES (?, ?, ?, ?, ?)
    `
    )
    .run(
      req.body.name,
      req.body.category || "",
      req.body.size || "",
      req.body.concentration || "",
      Number(req.body.quantity || 0)
    );

  const newDrug = db
    .prepare("SELECT * FROM drugs WHERE id = ?")
    .get(result.lastInsertRowid);

  return res.status(201).json(newDrug);
});

app.put("/drugs/:id", (req, res) => {
  const drug = db
    .prepare("SELECT * FROM drugs WHERE id = ?")
    .get(Number(req.params.id));

  if (!drug) {
    return res.status(404).json({ message: "Drug not found" });
  }

  const updatedDrug = {
    name: req.body.name ?? drug.name,
    category: req.body.category ?? drug.category,
    size: req.body.size ?? drug.size,
    concentration: req.body.concentration ?? drug.concentration,
    quantity:
      req.body.quantity !== undefined ? Number(req.body.quantity) : drug.quantity,
  };

  db.prepare(
    `
    UPDATE drugs
    SET name = ?, category = ?, size = ?, concentration = ?, quantity = ?
    WHERE id = ?
  `
  ).run(
    updatedDrug.name,
    updatedDrug.category,
    updatedDrug.size,
    updatedDrug.concentration,
    updatedDrug.quantity,
    Number(req.params.id)
  );

  const savedDrug = db
    .prepare("SELECT * FROM drugs WHERE id = ?")
    .get(Number(req.params.id));

  return res.status(200).json(savedDrug);
});

app.delete("/drugs/:id", (req, res) => {
  const result = db
    .prepare("DELETE FROM drugs WHERE id = ?")
    .run(Number(req.params.id));

  if (result.changes === 0) {
    return res.status(404).json({ message: "Drug not found" });
  }

  return res.status(204).end();
});

/* ---------------- LOGBOOK ENTRY ROUTES ---------------- */

app.get("/entries", (req, res) => {
  const allEntries = db.prepare("SELECT * FROM entries").all();
  return res.status(200).json(allEntries);
});

app.post("/entries", (req, res) => {
  const selectedDrug = db
    .prepare("SELECT * FROM drugs WHERE name = ?")
    .get(req.body.drugName);

  if (!selectedDrug) {
    return res.status(404).json({ message: "Drug not found" });
  }

  const quantityUsed = Number(req.body.quantityUsed);

  if (!quantityUsed || quantityUsed <= 0) {
    return res.status(400).json({ message: "Invalid quantity used" });
  }

  if (quantityUsed > selectedDrug.quantity) {
    return res.status(400).json({ message: "Not enough stock" });
  }

  const newBalance = selectedDrug.quantity - quantityUsed;

  db.prepare("UPDATE drugs SET quantity = ? WHERE id = ?").run(
    newBalance,
    selectedDrug.id
  );

  const dateTime = new Date().toLocaleString();

  const result = db
    .prepare(
      `
      INSERT INTO entries (
        patientName,
        hospitalNumber,
        drugName,
        doseGiven,
        quantityUsed,
        balance,
        staffId,
        staffName,
        checkerId,
        checkerName,
        staffSignature,
        checkerSignature,
        dateTime
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
    .run(
      req.body.patientName,
      req.body.hospitalNumber,
      req.body.drugName,
      req.body.doseGiven,
      quantityUsed,
      newBalance,
      req.body.staffId,
      req.body.staffName,
      req.body.checkerId,
      req.body.checkerName,
      req.body.staffSignature,
      req.body.checkerSignature,
      dateTime
    );

  const newEntry = db
    .prepare("SELECT * FROM entries WHERE id = ?")
    .get(result.lastInsertRowid);

  const allDrugs = db.prepare("SELECT * FROM drugs").all();

  return res.status(201).json({
    entry: newEntry,
    drugs: allDrugs,
  });
});

app.delete("/entries/:id", (req, res) => {
  const result = db
    .prepare("DELETE FROM entries WHERE id = ?")
    .run(Number(req.params.id));

  if (result.changes === 0) {
    return res.status(404).json({ message: "Entry not found" });
  }

  return res.status(204).end();
});

/* ---------------- SERVER ---------------- */

const PORT = 8000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});