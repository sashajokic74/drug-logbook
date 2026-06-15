import transactionRoutes from "./transactions.js";
import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import seedDrugs from "./drugData.js";
import db from "./database.js";
import { loginUser, verifyUser, adminOnly } from "./auth.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/transactions", transactionRoutes);

/* ================= DEFAULT ADMIN USER ================= */

const existingAdmin = db
  .prepare("SELECT * FROM users WHERE username = ?")
  .get("admin");

if (!existingAdmin) {
  const hashedPassword = bcrypt.hashSync("admin123", 10);

  db.prepare(`
    INSERT INTO users
    (username, password, role, fullName, active)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    "admin",
    hashedPassword,
    "admin",
    "System Administrator",
    1
  );

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

app.post("/login", loginUser);

/* ================= USER ROUTES ================= */

app.get("/users", verifyUser, adminOnly, (req, res) => {
  try {
    const users = db
      .prepare(`
        SELECT id, username, role, fullName, active, createdAt
        FROM users
        ORDER BY id ASC
      `)
      .all();

    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post("/users", verifyUser, adminOnly, (req, res) => {
  try {
    const { username, password, role, fullName } = req.body;

    if (!username || !password || !role || !fullName) {
      return res.status(400).json({
        message: "Full name, username, password and role are required",
      });
    }

    const existingUser = db
      .prepare("SELECT * FROM users WHERE username = ?")
      .get(username);

    if (existingUser) {
      return res.status(409).json({
        message: "Username already exists",
      });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const result = db
      .prepare(`
        INSERT INTO users
        (username, password, role, fullName, active)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(username, hashedPassword, role, fullName, 1);

    const newUser = db
      .prepare(`
        SELECT id, username, role, fullName, active, createdAt
        FROM users
        WHERE id = ?
      `)
      .get(result.lastInsertRowid);

    db.prepare(`
      INSERT INTO audit (action, username, role)
      VALUES (?, ?, ?)
    `).run(
      `Created user: ${newUser.username}`,
      req.user.username,
      req.user.role
    );

    return res.status(201).json(newUser);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.put("/users/:id/deactivate", verifyUser, adminOnly, (req, res) => {
  try {
    const userToDeactivate = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(Number(req.params.id));

    if (!userToDeactivate) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (userToDeactivate.username === "admin") {
      return res.status(400).json({
        message: "Main admin account cannot be deactivated",
      });
    }

    db.prepare("UPDATE users SET active = 0 WHERE id = ?").run(
      Number(req.params.id)
    );

    db.prepare(`
      INSERT INTO audit (action, username, role)
      VALUES (?, ?, ?)
    `).run(
      `Deactivated user: ${userToDeactivate.username}`,
      req.user.username,
      req.user.role
    );

    return res.status(200).json({
      message: "User deactivated",
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
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

app.get("/audit", verifyUser, adminOnly, (req, res) => {
  const audit = db.prepare("SELECT * FROM audit ORDER BY id DESC").all();
  return res.status(200).json(audit);
});

/* ================= SERVER ================= */
// ================= REGISTER ENTRY =================

app.post("/register", verifyUser, (req, res) => {

  const {
    drugId,
    patientName,
    hospitalNumber,
    supplied,
    administered,
    destroyed,
    staffId,
    staffName,
    staffSignature,
    checkerId,
    checkerName,
    checkerSignature
  } = req.body;


  const drug = db
    .prepare("SELECT * FROM drugs WHERE id = ?")
    .get(drugId);


  if (!drug) {

    return res.status(404).json({
      message: "Drug not found"
    });

  }


  const newBalance =
    Number(drug.quantity)
    + Number(supplied || 0)
    - Number(administered || 0)
    - Number(destroyed || 0);



  db.prepare(`
    INSERT INTO drug_register
    (
      drug_id,
      patient_name,
      hospital_number,
      supplied,
      administered,
      destroyed,
      balance,
      staff_id,
      staff_name,
      staff_signature,
      checker_id,
      checker_name,
      checker_signature
    )

    VALUES
    (
      ?,?,?,?,?,?,?,?,?,?,?,?,?
    )
  `)
  .run(

    drugId,

    patientName,

    hospitalNumber,

    supplied || 0,

    administered || 0,

    destroyed || 0,

    newBalance,

    staffId,

    staffName,

    staffSignature,

    checkerId,

    checkerName,

    checkerSignature

  );



  db.prepare(
    `
    UPDATE drugs
    SET quantity = ?
    WHERE id = ?
    `
  )
  .run(
    newBalance,
    drugId
  );



  res.json({

    message: "Entry saved",

    balance: newBalance

  });


});
const PORT = 8000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});