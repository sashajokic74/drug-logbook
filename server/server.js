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
import userRoutes from "./routes/users.js";
import { config } from "./config.js";

const app = express();

app.use(
  cors({
    origin: config.corsOrigin,
  })
);

app.use(express.json());

app.use("/transactions", transactionRoutes);
app.use("/checker", checkerRoutes);
app.use("/stock-checks", stockCheckRoutes);
app.use("/corrections", correctionRoutes);
app.use("/locations", locationRoutes);
app.use("/pharmacy-requests", verifyUser, pharmacyRequestRoutes);
app.use("/users", userRoutes);

/* ================= DEVICE SETUP ROUTES ================= */

app.get("/device-setup/hospitals", (req, res) => {
  try {
    const hospitals = db
      .prepare(`
        SELECT *
        FROM hospitals
        WHERE active = 1
        ORDER BY name ASC
      `)
      .all();

    return res.json(hospitals);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post("/device-setup/hospitals", verifyUser, adminOnly, (req, res) => {
  try {
    const { name } = req.body;
    const hospitalName = String(name || "").trim();

    if (!hospitalName) {
      return res.status(400).json({ message: "Hospital name is required" });
    }

    const existingHospital = db
      .prepare(
        "SELECT * FROM hospitals WHERE lower(name) = lower(?) AND active = 1"
      )
      .get(hospitalName);

    if (existingHospital) {
      return res.status(200).json(existingHospital);
    }

    const result = db
      .prepare(`
        INSERT INTO hospitals (name, active)
        VALUES (?, 1)
      `)
      .run(hospitalName);

    const hospital = db
      .prepare("SELECT * FROM hospitals WHERE id = ?")
      .get(result.lastInsertRowid);

    return res.status(201).json(hospital);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get("/device-setup/locations", (req, res) => {
  try {
    const { hospitalId } = req.query;

    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital is required" });
    }

    const locations = db
      .prepare(`
        SELECT *
        FROM locations
        WHERE active = 1
          AND hospitalId = ?
        ORDER BY name ASC
      `)
      .all(Number(hospitalId));

    return res.json(locations);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post("/device-setup/locations", verifyUser, adminOnly, (req, res) => {
  try {
    const { hospitalId, name, type } = req.body;
    const locationName = String(name || "").trim();

    if (!hospitalId || !locationName) {
      return res.status(400).json({
        message: "Hospital and location name are required",
      });
    }

    const hospital = db
      .prepare("SELECT * FROM hospitals WHERE id = ? AND active = 1")
      .get(Number(hospitalId));

    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found" });
    }

    const existingLocation = db
      .prepare(`
        SELECT *
        FROM locations
        WHERE hospitalId = ?
          AND lower(name) = lower(?)
          AND active = 1
      `)
      .get(Number(hospitalId), locationName);

    if (existingLocation) {
      return res.status(200).json(existingLocation);
    }

    const result = db
      .prepare(`
        INSERT INTO locations
        (
          hospitalId,
          hospitalName,
          name,
          type,
          active
        )
        VALUES (?, ?, ?, ?, 1)
      `)
      .run(
        hospital.id,
        hospital.name,
        locationName,
        type || "Theatre"
      );

    const location = db
      .prepare("SELECT * FROM locations WHERE id = ?")
      .get(result.lastInsertRowid);

    return res.status(201).json(location);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get("/device-setup/devices", (req, res) => {
  try {
    const { hospitalId, locationId } = req.query;
    const params = [];

    let sql = `
      SELECT *
      FROM devices
      WHERE active = 1
    `;

    if (hospitalId) {
      sql += " AND hospitalId = ?";
      params.push(Number(hospitalId));
    }

    if (locationId) {
      sql += " AND locationId = ?";
      params.push(Number(locationId));
    }

    sql += " ORDER BY hospitalName ASC, locationName ASC, deviceName ASC";

    const devices = db.prepare(sql).all(...params);

    return res.json(devices);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post("/device-setup/devices", verifyUser, adminOnly, (req, res) => {
  try {
    const {
      deviceName,
      deviceCode,
      hospitalId,
      hospitalName,
      locationId,
      locationName,
      deviceType,
    } = req.body;

    if (!deviceName || !deviceCode || !hospitalId || !locationId) {
      return res.status(400).json({
        message: "Device name, code, hospital and location are required",
      });
    }

    const existingDevice = db
      .prepare("SELECT * FROM devices WHERE deviceCode = ? AND active = 1")
      .get(deviceCode);

    if (existingDevice) {
      return res.status(200).json(existingDevice);
    }

    const result = db
      .prepare(`
        INSERT INTO devices
        (
          deviceName,
          deviceCode,
          hospitalId,
          hospitalName,
          locationId,
          locationName,
          deviceType,
          active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `)
      .run(
        deviceName,
        deviceCode,
        Number(hospitalId),
        hospitalName || "",
        Number(locationId),
        locationName || "",
        deviceType || "iPad"
      );

    const device = db
      .prepare("SELECT * FROM devices WHERE id = ?")
      .get(result.lastInsertRowid);

    return res.status(201).json(device);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

/* ================= DEFAULT ADMIN USER ================= */

const existingAdmin = db
  .prepare("SELECT * FROM users WHERE username = ?")
  .get("admin");

if (!existingAdmin) {
  const hashedPassword = bcrypt.hashSync(config.defaultAdminPassword, 10);

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
  try {
    const { hospitalId, hospitalName, locationId, locationName } = req.query;

    if (!hospitalId || !locationId) {
      const drugs = db.prepare("SELECT * FROM drugs").all();
      return res.status(200).json(drugs);
    }

    const drugs = db.prepare("SELECT * FROM drugs ORDER BY name ASC").all();
    const insertStock = db.prepare(`
      INSERT OR IGNORE INTO location_drug_stock
      (
        hospitalId,
        hospitalName,
        locationId,
        locationName,
        drugId,
        quantity,
        minimumStock,
        maximumStock
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const ensureStockRows = db.transaction(() => {
      drugs.forEach((drug) => {
        insertStock.run(
          Number(hospitalId),
          hospitalName || "",
          Number(locationId),
          locationName || "",
          drug.id,
          Number(drug.quantity || 0),
          Number(drug.minimumStock || 5),
          Number(drug.maximumStock || 20)
        );
      });
    });

    ensureStockRows();

    const locationDrugs = db
      .prepare(`
        SELECT
          drugs.*,
          location_drug_stock.quantity AS quantity,
          location_drug_stock.minimumStock AS minimumStock,
          location_drug_stock.maximumStock AS maximumStock,
          location_drug_stock.hospitalId AS hospitalId,
          location_drug_stock.hospitalName AS hospitalName,
          location_drug_stock.locationId AS locationId,
          location_drug_stock.locationName AS locationName
        FROM drugs
        JOIN location_drug_stock
          ON location_drug_stock.drugId = drugs.id
        WHERE location_drug_stock.hospitalId = ?
          AND location_drug_stock.locationId = ?
        ORDER BY drugs.name ASC
      `)
      .all(Number(hospitalId), Number(locationId));

    return res.status(200).json(locationDrugs);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post("/drugs", verifyUser, adminOnly, (req, res) => {
  try {
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

    if (req.body.hospitalId && req.body.locationId) {
      db.prepare(`
        INSERT OR REPLACE INTO location_drug_stock
        (
          hospitalId,
          hospitalName,
          locationId,
          locationName,
          drugId,
          quantity,
          minimumStock,
          maximumStock,
          updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        Number(req.body.hospitalId),
        req.body.hospitalName || "",
        Number(req.body.locationId),
        req.body.locationName || "",
        result.lastInsertRowid,
        Number(req.body.quantity || 0),
        Number(req.body.minimumStock || 5),
        Number(req.body.maximumStock || 20)
      );
    }

    const newDrug = db
      .prepare("SELECT * FROM drugs WHERE id = ?")
      .get(result.lastInsertRowid);

    return res.status(201).json(newDrug);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
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

  if (req.body.hospitalId && req.body.locationId && req.body.quantity !== undefined) {
    db.prepare(`
      INSERT INTO location_drug_stock
      (
        hospitalId,
        hospitalName,
        locationId,
        locationName,
        drugId,
        quantity,
        minimumStock,
        maximumStock,
        updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(hospitalId, locationId, drugId)
      DO UPDATE SET
        quantity = excluded.quantity,
        hospitalName = excluded.hospitalName,
        locationName = excluded.locationName,
        updatedAt = CURRENT_TIMESTAMP
    `).run(
      Number(req.body.hospitalId),
      req.body.hospitalName || "",
      Number(req.body.locationId),
      req.body.locationName || "",
      Number(req.params.id),
      Number(req.body.quantity),
      Number(savedDrug.minimumStock || 5),
      Number(savedDrug.maximumStock || 20)
    );
  }

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
    const { hospitalId, locationId, listDate } = req.query;
    const selectedDate = listDate || new Date().toISOString().slice(0, 10);

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
          AND listDate = ?
        ORDER BY patientName ASC
      `)
      .all(Number(hospitalId), Number(locationId), selectedDate);

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

app.put("/patients/archive", verifyUser, (req, res) => {
  try {
    const { hospitalId, locationId, listDate } = req.body;
    const selectedDate = listDate || new Date().toISOString().slice(0, 10);

    if (!hospitalId || !locationId) {
      return res.status(400).json({
        message: "Hospital and location are required",
      });
    }

    const result = db
      .prepare(`
        UPDATE patients
        SET active = 0
        WHERE hospitalId = ?
          AND locationId = ?
          AND listDate = ?
          AND active = 1
      `)
      .run(Number(hospitalId), Number(locationId), selectedDate);

    return res.json({
      archived: result.changes,
      message: `${result.changes} patients archived from ${selectedDate}`,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

/* ================= AUDIT ROUTE ================= */

app.get("/audit", verifyUser, adminOnly, (req, res) => {
  const audit = db.prepare("SELECT * FROM audit ORDER BY id DESC").all();
  return res.status(200).json(audit);
});

app.get("/audit-trail", verifyUser, adminOnly, (req, res) => {
  try {
    const { hospitalId, locationId, fromDate, toDate, type, search } = req.query;
    const locationFilter = {
      hospitalId: hospitalId ? Number(hospitalId) : null,
      locationId: locationId ? Number(locationId) : null,
    };

    function inDateRange(row) {
      const createdAt = String(row.createdAt || "").slice(0, 10);
      if (fromDate && createdAt < fromDate) return false;
      if (toDate && createdAt > toDate) return false;
      return true;
    }

    function matchesSearch(row) {
      if (!search) return true;
      return JSON.stringify(row).toLowerCase().includes(String(search).toLowerCase());
    }

    function matchesType(row) {
      if (!type || type === "ALL") return true;
      return row.type === type;
    }

    function matchesLocation(row) {
      if (locationFilter.hospitalId && Number(row.hospitalId) !== locationFilter.hospitalId) {
        return false;
      }
      if (locationFilter.locationId && Number(row.locationId) !== locationFilter.locationId) {
        return false;
      }
      return true;
    }

    const transactions = db
      .prepare(`
        SELECT *
        FROM drug_transactions
        ORDER BY createdAt DESC
        LIMIT 500
      `)
      .all()
      .map((entry) => ({
        id: `transaction-${entry.id}`,
        recordId: entry.id,
        type: "TRANSACTION",
        category: entry.transactionType || "transaction",
        action:
          entry.transactionType === "pharmacy_supply"
            ? "Pharmacy stock received"
            : entry.transactionType === "CORRECTION"
              ? "Correction stock adjustment"
              : "Patient drug administration",
        createdAt: entry.createdAt,
        hospitalId: entry.hospitalId,
        hospitalName: entry.hospitalName,
        locationId: entry.locationId,
        locationName: entry.locationName,
        drugName: entry.drugName,
        patientName: entry.patientName,
        hospitalNumber: entry.hospitalNumber,
        beforeBalance: entry.stockBalanceBefore,
        afterBalance: entry.stockBalanceAfter,
        quantity:
          Number(entry.ampoulesUsed || 0) > 0
            ? Number(entry.ampoulesUsed || 0)
            : Number(entry.ampoulesSupplied || 0),
        staff: [entry.administeredByName, entry.witnessName].filter(Boolean).join(" / "),
        signatureHash: [entry.administeredSignatureHash, entry.witnessSignatureHash]
          .filter(Boolean)
          .join(" / "),
        notes: entry.notes || "",
      }));

    const stockChecks = db
      .prepare(`
        SELECT *
        FROM cd_stock_checks
        ORDER BY createdAt DESC
        LIMIT 500
      `)
      .all()
      .map((check) => ({
        id: `stock-check-${check.id}`,
        recordId: check.id,
        type: "STOCK_CHECK",
        category: check.checkType,
        action: `CD stock check: ${check.checkType}`,
        createdAt: check.createdAt,
        hospitalId: check.hospitalId,
        hospitalName: check.hospitalName,
        locationId: check.locationId,
        locationName: check.locationName,
        drugName: check.drugName,
        beforeBalance: check.expectedBalance,
        afterBalance: check.actualBalance,
        quantity: check.difference,
        staff: [check.staffOneName, check.staffTwoName].filter(Boolean).join(" / "),
        signatureHash: [check.staffOneSignatureHash, check.staffTwoSignatureHash]
          .filter(Boolean)
          .join(" / "),
        notes: check.notes || "",
      }));

    const corrections = db
      .prepare(`
        SELECT *
        FROM corrections
        ORDER BY createdAt DESC
        LIMIT 500
      `)
      .all()
      .map((correction) => ({
        id: `correction-${correction.id}`,
        recordId: correction.id,
        type: "CORRECTION",
        category: correction.correctionType,
        action:
          correction.correctionType === "entry_error"
            ? "Correction with stock reversal"
            : "Documentation correction",
        createdAt: correction.createdAt,
        hospitalId: correction.hospitalId,
        hospitalName: correction.hospitalName,
        locationId: correction.locationId,
        locationName: correction.locationName,
        quantity: correction.stockAdjustment,
        staff: [correction.correctedByName, correction.checkedByName]
          .filter(Boolean)
          .join(" / "),
        signatureHash: [correction.correctedSignatureHash, correction.checkedSignatureHash]
          .filter(Boolean)
          .join(" / "),
        notes: `${correction.reason || ""}${correction.correctionText ? ` - ${correction.correctionText}` : ""}`,
      }));

    const pharmacyRequests = db
      .prepare(`
        SELECT *
        FROM pharmacy_requests
        ORDER BY createdAt DESC
        LIMIT 500
      `)
      .all()
      .map((request) => ({
        id: `pharmacy-${request.id}`,
        recordId: request.id,
        type: "PHARMACY",
        category: request.status,
        action: `Pharmacy requisition ${request.status || ""}`.trim(),
        createdAt: request.createdAt,
        hospitalId: request.hospitalId,
        hospitalName: request.hospitalName,
        locationId: request.locationId,
        locationName: request.locationName,
        drugName: request.drugName,
        quantity: request.quantityRequested,
        staff: request.requestedByName,
        signatureHash: request.requestedSignatureHash || "",
        notes: `Requisition ${request.requisitionNumber}${request.reason ? ` - ${request.reason}` : ""}`,
      }));

    const genericAudit =
      locationFilter.hospitalId || locationFilter.locationId
        ? []
        : db
            .prepare(`
              SELECT *
              FROM audit
              ORDER BY createdAt DESC
              LIMIT 500
            `)
            .all()
            .map((entry) => ({
              id: `audit-${entry.id}`,
              recordId: entry.id,
              type: "SYSTEM",
              category: entry.role || "system",
              action: entry.action,
              createdAt: entry.createdAt,
              staff: entry.username,
              notes: entry.role || "",
            }));

    const rows = [
      ...transactions,
      ...stockChecks,
      ...corrections,
      ...pharmacyRequests,
      ...genericAudit,
    ]
      .filter(matchesLocation)
      .filter(inDateRange)
      .filter(matchesType)
      .filter(matchesSearch)
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 300);

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

/* ================= SERVER ================= */

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});
