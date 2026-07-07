import "dotenv/config";
import transactionRoutes from "./routes/transactions.js";
import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import seedDrugs from "./drugData.js";
import db from "./database.js";
import { loginUser, verifyUser, adminOnly } from "./auth.js";
import checkerRoutes from "./routes/checker.js";
import stockCheckRoutes from "./routes/stockChecks.js";
import correctionRoutes from "./routes/corrections.js";
import locationRoutes from "./routes/locations.js";
import pharmacyRequestRoutes from "./routes/pharmacyRequests.js";
import deviceSetupRoutes from "./routes/deviceSetup.js";
import userRoutes from "./routes/users.js";

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.use(express.json());

app.use("/transactions", transactionRoutes);
app.use("/checker", checkerRoutes);
app.use("/stock-checks", stockCheckRoutes);
app.use("/corrections", correctionRoutes);
app.use("/locations", locationRoutes);
app.use("/pharmacy-requests", pharmacyRequestRoutes);
app.use("/device-setup", deviceSetupRoutes);
app.use("/users", userRoutes);

/* ================= DEFAULT ADMIN USER ================= */

const existingAdmin = db
  .prepare("SELECT * FROM users WHERE username = ?")
  .get("admin");

if (!existingAdmin) {
  const hashedPassword = bcrypt.hashSync("admin123", 10);

  db.prepare(`
    INSERT INTO users
    (username, password, role, fullName, active, staffType, expiryDate)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    "admin",
    hashedPassword,
    "admin",
    "System Administrator",
    1,
    "Permanent",
    null
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

/* ================= DRUG ROUTES ================= */

app.get("/drugs", (req, res) => {
  const drugs = db.prepare("SELECT * FROM drugs").all();
  return res.status(200).json(drugs);
});

app.post("/drugs", verifyUser, adminOnly, (req, res) => {
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

app.put("/drugs/:id", verifyUser, adminOnly, (req, res) => {
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

app.delete("/drugs/:id", verifyUser, adminOnly, (req, res) => {
  const existingDrug = db
    .prepare("SELECT * FROM drugs WHERE id = ?")
    .get(Number(req.params.id));

  if (!existingDrug) {
    return res.status(404).json({ message: "Drug not found" });
  }

  db.prepare("DELETE FROM drugs WHERE id = ?").run(Number(req.params.id));

  return res.status(204).end();
});

/* ================= PATIENT LIST ROUTES ================= */

app.get("/patients", verifyUser, (req, res) => {
  try {
    const { hospitalId, locationId } = req.query;

    if (!hospitalId || !locationId) {
      return res.status(400).json({
        message: "Hospital and location are required",
      });
    }

    const patients = db
      .prepare(`
        SELECT *
        FROM patients
        WHERE active = 1
          AND hospitalId = ?
          AND locationId = ?
        ORDER BY patientName ASC
      `)
      .all(Number(hospitalId), Number(locationId));

    return res.json(patients);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post("/patients", verifyUser, (req, res) => {
  try {
    const {
      hospitalId,
      hospitalName,
      locationId,
      locationName,
      patientName,
      hospitalNumber,
      speciality,
      procedure,
      listDate,
    } = req.body;

    if (!hospitalId || !locationId || !patientName || !hospitalNumber) {
      return res.status(400).json({
        message: "Hospital, location, patient name and MRN / NHS number are required",
      });
    }

    const result = db
      .prepare(`
        INSERT INTO patients
        (
          hospitalId,
          hospitalName,
          locationId,
          locationName,
          patientName,
          hospitalNumber,
          speciality,
          procedure,
          listDate,
          active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `)
      .run(
        Number(hospitalId),
        hospitalName || "",
        Number(locationId),
        locationName || "",
        patientName.trim(),
        hospitalNumber.trim(),
        speciality || "",
        procedure || "",
        listDate || new Date().toISOString().slice(0, 10)
      );

    const patient = db
      .prepare("SELECT * FROM patients WHERE id = ?")
      .get(result.lastInsertRowid);

    return res.status(201).json(patient);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post("/patients/bulk", verifyUser, (req, res) => {
  try {
    const {
      hospitalId,
      hospitalName,
      locationId,
      locationName,
      patients,
    } = req.body;

    if (!hospitalId || !locationId) {
      return res.status(400).json({
        message: "Hospital and location are required",
      });
    }

    if (!Array.isArray(patients) || patients.length === 0) {
      return res.status(400).json({
        message: "No patients to upload",
      });
    }

    const insertPatient = db.prepare(`
      INSERT INTO patients
      (
        hospitalId,
        hospitalName,
        locationId,
        locationName,
        patientName,
        hospitalNumber,
        speciality,
        procedure,
        listDate,
        active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    let created = 0;

    const savePatients = db.transaction(() => {
      patients.forEach((patient) => {
        if (!patient.patientName || !patient.hospitalNumber) return;

        insertPatient.run(
          Number(hospitalId),
          hospitalName || "",
          Number(locationId),
          locationName || "",
          String(patient.patientName).trim(),
          String(patient.hospitalNumber).trim(),
          patient.speciality || "",
          patient.procedure || "",
          patient.listDate || new Date().toISOString().slice(0, 10)
        );

        created += 1;
      });
    });

    savePatients();

    return res.status(201).json({
      message: `${created} patients uploaded`,
      created,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});


app.get("/audit", verifyUser, adminOnly, (req, res) => {
  const audit = db.prepare("SELECT * FROM audit ORDER BY id DESC").all();
  return res.status(200).json(audit);
});

/* ================= SERVER ================= */

const PORT = 8000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
