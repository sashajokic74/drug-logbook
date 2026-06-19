import express from "express";
import db from "./database.js";
import { verifyUser } from "./auth.js";
import { createSignatureHash } from "./signature.js";

const router = express.Router();

db.prepare(`
  CREATE TABLE IF NOT EXISTS corrections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    originalTransactionId INTEGER NOT NULL,
    reason TEXT NOT NULL,
    correctionText TEXT NOT NULL,

    correctedById TEXT NOT NULL,
    correctedByName TEXT NOT NULL,
    correctedByRole TEXT,
    correctedByStaffType TEXT,
    correctedSignedAt TEXT,
    correctedSignatureHash TEXT,

    checkedById TEXT NOT NULL,
    checkedByName TEXT NOT NULL,
    checkedByRole TEXT,
    checkedByStaffType TEXT,
    checkedSignedAt TEXT,
    checkedSignatureHash TEXT,

    createdByUsername TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  )
`).run();

router.get("/", verifyUser, (req, res) => {
  try {
    const rows = db
      .prepare(`
        SELECT *
        FROM corrections
        ORDER BY id DESC
      `)
      .all();

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/", verifyUser, (req, res) => {
  try {
    const {
      originalTransactionId,
      reason,
      correctionText,
      correctedById,
      checkedById,
    } = req.body;

    if (!originalTransactionId || !reason || !correctionText) {
      return res.status(400).json({
        message: "Original entry, reason and correction text are required",
      });
    }

    if (!correctedById || !checkedById) {
      return res.status(400).json({
        message: "Two verified staff members are required",
      });
    }

    if (Number(correctedById) === Number(checkedById)) {
      return res.status(400).json({
        message: "Correction and checker must be two different people",
      });
    }

    const original = db
      .prepare("SELECT * FROM drug_transactions WHERE id = ?")
      .get(Number(originalTransactionId));

    if (!original) {
      return res.status(404).json({
        message: "Original transaction not found",
      });
    }

    const correctedBy = db
      .prepare(`
        SELECT id, username, fullName, role, staffType
        FROM users
        WHERE id = ?
      `)
      .get(Number(correctedById));

    const checkedBy = db
      .prepare(`
        SELECT id, username, fullName, role, staffType
        FROM users
        WHERE id = ?
      `)
      .get(Number(checkedById));

    if (!correctedBy || !checkedBy) {
      return res.status(400).json({
        message: "Verified staff records not found",
      });
    }

    if (correctedBy.role === "admin" || checkedBy.role === "admin") {
      return res.status(400).json({
        message: "Admin account cannot sign clinical correction",
      });
    }

    const correctedSignedAt = new Date().toISOString();
    const checkedSignedAt = new Date().toISOString();

    const correctedSignatureHash = createSignatureHash({
      userId: correctedBy.id,
      username: correctedBy.username,
      fullName: correctedBy.fullName,
      role: correctedBy.role,
      action: "correction_entry",
      drugName: original.drugName,
      timestamp: correctedSignedAt,
    });

    const checkedSignatureHash = createSignatureHash({
      userId: checkedBy.id,
      username: checkedBy.username,
      fullName: checkedBy.fullName,
      role: checkedBy.role,
      action: "correction_entry_check",
      drugName: original.drugName,
      timestamp: checkedSignedAt,
    });

    const result = db
      .prepare(`
        INSERT INTO corrections
        (
          originalTransactionId,
          reason,
          correctionText,

          correctedById,
          correctedByName,
          correctedByRole,
          correctedByStaffType,
          correctedSignedAt,
          correctedSignatureHash,

          checkedById,
          checkedByName,
          checkedByRole,
          checkedByStaffType,
          checkedSignedAt,
          checkedSignatureHash,

          createdByUsername
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        Number(originalTransactionId),
        reason,
        correctionText,

        correctedBy.id,
        correctedBy.fullName || correctedBy.username,
        correctedBy.role,
        correctedBy.staffType || "Permanent",
        correctedSignedAt,
        correctedSignatureHash,

        checkedBy.id,
        checkedBy.fullName || checkedBy.username,
        checkedBy.role,
        checkedBy.staffType || "Permanent",
        checkedSignedAt,
        checkedSignatureHash,

        req.user.username
      );

    const saved = db
      .prepare("SELECT * FROM corrections WHERE id = ?")
      .get(result.lastInsertRowid);

    return res.status(201).json({
      correction: saved,
      message: "Correction entry saved",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

export default router;