import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import seedDrugs from "./drugData.js";
import db from "./database.js";

const app = express();

app.use(cors());
app.use(express.json());

const JWT_SECRET = "change-this-secret-later";

/* ================= ADMIN USER SEED ================= */

const existingAdmin = db
  .prepare("SELECT * FROM users WHERE username = ?")
  .get("admin");

if (!existingAdmin) {
  const hashedPassword = bcrypt.hashSync("admin123", 10);

  db.prepare(`
    INSERT INTO users (username, password, role)
    VALUES (?, ?, ?)
  `).run("admin", hashedPassword, "admin");

  console.log("Default admin user created");
}

/* ================= DATABASE SEED ================= */

const existingDrugs = db.prepare("SELECT * FROM drugs").all();

console.log("Drugs in SQLite:", existingDrugs.length);

if (existingDrugs.length === 0) {
  console.log("Adding original drug cards...");

  const insertDrug = db.prepare(`
    INSERT INTO drugs
    (name, category, size, concentration, quantity)
    VALUES (?, ?, ?, ?, ?)
  `);

  seedDrugs.forEach((drug) => {
    insertDrug.run(
      drug.name,
      drug.category,
      drug.size,
      drug.concentration,
      drug.quantity
    );
  });

  console.log("Original cards saved to SQLite");
}

/* ================= AUTH ROUTES ================= */

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  const user = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username);

  if (!user) {
    return res.status(401).json({ message: "Invalid username or password" });
  }

  const passwordMatch = bcrypt.compareSync(password, user.password);

  if (!passwordMatch) {
    return res.status(401).json({ message: "Invalid username or password" });
  }

  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  return res.status(200).json({
    message: "Login successful",
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  });
});

/* ================= DRUG ROUTES ================= */

app.get("/drugs", (req, res) => {
  const drugs = db.prepare("SELECT * FROM drugs").all();
  return res.status(200).json(drugs);
});

app.post("/drugs", (req, res) => {
  const result = db
    .prepare(`
      INSERT INTO drugs
      (name, category, size, concentration, quantity)
      VALUES (?, ?, ?, ?, ?)
    `)
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
  const existingDrug = db
    .prepare("SELECT * FROM drugs WHERE id = ?")
    .get(Number(req.params.id));

  if (!existingDrug) {
    return res.status(404).json({ message: "Drug not found" });
  }

  const updatedDrug = {
    name: req.body.name ?? existingDrug.name,
    category: req.body.category ?? existingDrug.category,
    size: req.body.size ?? existingDrug.size,
    concentration: req.body.concentration ?? existingDrug.concentration,
    quantity:
      req.body.quantity !== undefined
        ? Number(req.body.quantity)
        : existingDrug.quantity,
  };

  db.prepare(`
    UPDATE drugs
    SET name = ?, category = ?, size = ?, concentration = ?, quantity = ?
    WHERE id = ?
  `).run(
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
  const existingDrug = db
    .prepare("SELECT * FROM drugs WHERE id = ?")
    .get(Number(req.params.id));

  if (!existingDrug) {
    return res.status(404).json({ message: "Drug not found" });
  }

  db.prepare("DELETE FROM drugs WHERE id = ?").run(Number(req.params.id));

  return res.status(204).end();
});

/* ================= ENTRY ROUTES ================= */

app.get("/entries", (req, res) => {
  const entries = db.prepare("SELECT * FROM entries ORDER BY id DESC").all();
  return res.status(200).json(entries);
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

  const balance = selectedDrug.quantity - quantityUsed;

  db.prepare("UPDATE drugs SET quantity = ? WHERE id = ?").run(
    balance,
    selectedDrug.id
  );

  const result = db
    .prepare(`
      INSERT INTO entries
      (
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
    `)
    .run(
      req.body.patientName,
      req.body.hospitalNumber,
      req.body.drugName,
      req.body.doseGiven,
      quantityUsed,
      balance,
      req.body.staffId,
      req.body.staffName,
      req.body.checkerId,
      req.body.checkerName,
      req.body.staffSignature,
      req.body.checkerSignature,
      new Date().toLocaleString()
    );

  const entry = db
    .prepare("SELECT * FROM entries WHERE id = ?")
    .get(result.lastInsertRowid);

  const drugs = db.prepare("SELECT * FROM drugs").all();

  return res.status(201).json({
    entry,
    drugs,
  });
});

app.delete("/entries/:id", (req, res) => {
  const existingEntry = db
    .prepare("SELECT * FROM entries WHERE id = ?")
    .get(Number(req.params.id));

  if (!existingEntry) {
    return res.status(404).json({ message: "Entry not found" });
  }

  db.prepare("DELETE FROM entries WHERE id = ?").run(Number(req.params.id));

  return res.status(204).end();
});

/* ================= AUDIT ROUTE ================= */

app.get("/audit", (req, res) => {
  const audit = db.prepare("SELECT * FROM audit ORDER BY id DESC").all();
  return res.status(200).json(audit);
});

/* ================= SERVER ================= */

const PORT = 8000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});