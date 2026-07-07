import express from "express";
import db from "../database.js";
import { verifyUser } from "../auth.js";
import { createSignatureHash } from "../signature.js";

const router = express.Router();


db.prepare(`
CREATE TABLE IF NOT EXISTS corrections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  originalTransactionId INTEGER NOT NULL,

  correctionType TEXT NOT NULL,
  reason TEXT NOT NULL,
  correctionText TEXT NOT NULL,

  stockAdjustment REAL DEFAULT 0,

  correctedById TEXT,
  correctedByName TEXT,
  correctedByRole TEXT,
  correctedSignedAt TEXT,
  correctedSignatureHash TEXT,

  checkedById TEXT,
  checkedByName TEXT,
  checkedByRole TEXT,
  checkedSignedAt TEXT,
  checkedSignatureHash TEXT,

  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
)
`).run();


function addColumn(column, type) {
  try {
    db.prepare(
      `ALTER TABLE corrections ADD COLUMN ${column} ${type}`
    ).run();
  } catch {}
}

addColumn("correctionType", "TEXT DEFAULT 'documentation'");
addColumn("stockAdjustment", "REAL DEFAULT 0");
addColumn("hospitalId", "INTEGER");
addColumn("hospitalName", "TEXT");
addColumn("locationId", "INTEGER");
addColumn("locationName", "TEXT");


function getStaff(id) {
  return db.prepare(`
    SELECT *
    FROM users
    WHERE id = ?
  `).get(Number(id));
}

function isBlockedClinicalRole(roleValue) {
  const role = String(roleValue || "").toLowerCase();

  return (
    role === "admin" ||
    role === "doctor" ||
    role === "dr" ||
    role.startsWith("dr ") ||
    role.includes(" doctor") ||
    role.includes("surgeon") ||
    role.includes("anaesthetist")
  );
}


/* ================= GET ================= */

router.get("/", verifyUser, (req, res) => {
  try {
    const { hospitalId, locationId } = req.query;
    const params = [];
    let sql = `
      SELECT *
      FROM corrections
      WHERE 1 = 1
    `;

    if (hospitalId) {
      sql += " AND hospitalId = ?";
      params.push(Number(hospitalId));
    }

    if (locationId) {
      sql += " AND locationId = ?";
      params.push(Number(locationId));
    }

    sql += " ORDER BY id DESC";

    const rows = db.prepare(sql).all(...params);

    return res.json(rows);

  } catch (error) {

    return res.status(500).json({
      message: error.message,
    });

  }
});


/* ================= CREATE ================= */

router.post("/", verifyUser, (req, res) => {
  try {

    const {
      originalTransactionId,
      correctionType,
      reason,
      correctionText,
      hospitalId,
      hospitalName,
      locationId,
      locationName,
      correctedById,
      checkedById,
    } = req.body;


    if (!originalTransactionId) {
      return res.status(400).json({
        message: "Original entry required",
      });
    }


    if (!correctedById || !checkedById) {
      return res.status(400).json({
        message: "Two verified staff required",
      });
    }


    if (Number(correctedById) === Number(checkedById)) {
      return res.status(400).json({
        message: "Two different staff required",
      });
    }


    const original = db.prepare(`
      SELECT *
      FROM drug_transactions
      WHERE id = ?
    `).get(Number(originalTransactionId));


    if (!original) {
      return res.status(404).json({
        message: "Original transaction not found",
      });
    }


    const staff1 = getStaff(correctedById);
    const staff2 = getStaff(checkedById);


    if (!staff1 || !staff2) {
      return res.status(400).json({
        message: "Staff verification failed",
      });
    }


    if (isBlockedClinicalRole(staff1.role) || isBlockedClinicalRole(staff2.role)) {
      return res.status(400).json({
        message: "Admin, doctor and anaesthetist accounts cannot sign clinical corrections",
      });
    }


    let stockAdjustment = 0;


    // AUTOMATIC REVERSAL
    if (correctionType === "entry_error") {

      stockAdjustment =
        Number(original.ampoulesUsed || 0) -
        Number(original.ampoulesSupplied || 0);

    }


    const time1 = new Date().toISOString();
    const time2 = new Date().toISOString();


    const hash1 = createSignatureHash({
      userId: staff1.id,
      username: staff1.username,
      fullName: staff1.fullName,
      role: staff1.role,
      action: "correction",
      drugName: original.drugName,
      timestamp: time1,
    });


    const hash2 = createSignatureHash({
      userId: staff2.id,
      username: staff2.username,
      fullName: staff2.fullName,
      role: staff2.role,
      action: "correction check",
      drugName: original.drugName,
      timestamp: time2,
    });


    const result = db.prepare(`
      INSERT INTO corrections
      (
        originalTransactionId,
        hospitalId,
        hospitalName,
        locationId,
        locationName,

        correctionType,
        reason,
        correctionText,

        stockAdjustment,

        correctedById,
        correctedByName,
        correctedByRole,
        correctedSignedAt,
        correctedSignatureHash,

        checkedById,
        checkedByName,
        checkedByRole,
        checkedSignedAt,
        checkedSignatureHash
      )

      VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      originalTransactionId,
      original.hospitalId || hospitalId || null,
      original.hospitalName || hospitalName || "",
      original.locationId || locationId || null,
      original.locationName || locationName || "",

      correctionType,
      reason,
      correctionText,

      stockAdjustment,

      staff1.id,
      staff1.fullName || staff1.username,
      staff1.role,
      time1,
      hash1,

      staff2.id,
      staff2.fullName || staff2.username,
      staff2.role,
      time2,
      hash2
    );


    // ONLY AFTER BOTH SIGNATURES → CHANGE STOCK

    if (stockAdjustment !== 0) {

      const locationStock = db.prepare(`
        SELECT *
        FROM location_drug_stock
        WHERE hospitalId = ?
          AND locationId = ?
          AND drugId = ?
      `).get(
        Number(original.hospitalId || hospitalId),
        Number(original.locationId || locationId),
        Number(original.drugId)
      );

      const drug = db.prepare(`
        SELECT *
        FROM drugs
        WHERE id = ?
      `).get(original.drugId);

      const before = Number(locationStock?.quantity ?? drug.quantity ?? 0);


      const after =
        before + stockAdjustment;


      if (original.hospitalId || hospitalId) {
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
            maximumStock
          )
          VALUES (?, ?, ?, ?, ?, ?, 5, 50)
          ON CONFLICT(hospitalId, locationId, drugId)
          DO UPDATE SET
            quantity = excluded.quantity,
            updatedAt = CURRENT_TIMESTAMP
        `)
        .run(
          Number(original.hospitalId || hospitalId),
          original.hospitalName || hospitalName || "",
          Number(original.locationId || locationId),
          original.locationName || locationName || "",
          Number(original.drugId),
          after
        );
      } else {
        db.prepare(`
          UPDATE drugs
          SET quantity = ?
          WHERE id = ?
        `)
        .run(
          after,
          original.drugId
        );
      }


      db.prepare(`
        INSERT INTO drug_transactions
        (
          transactionType,
          hospitalId,
          hospitalName,
          locationId,
          locationName,

          drugId,
          drugName,

          ampoulesSupplied,

          stockBalanceBefore,
          stockBalanceAfter,

          notes
        )

        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        "CORRECTION",
        original.hospitalId || hospitalId || null,
        original.hospitalName || hospitalName || "",
        original.locationId || locationId || null,
        original.locationName || locationName || "",

        original.drugId,
        original.drugName,

        stockAdjustment,

        before,
        after,

        `Automatic correction reversal for entry #${originalTransactionId}`
      );

    }


    return res.status(201).json({
      id: result.lastInsertRowid,
      stockAdjustment,
      message:
        stockAdjustment === 0
          ? "Correction saved"
          : `Correction saved. Stock adjusted by ${stockAdjustment}`,
    });


  } catch (error) {

    return res.status(500).json({
      message: error.message,
    });

  }
});


export default router;
