import express from "express";
import db from "../database.js";
import { verifyUser } from "../auth.js";
import { createSignatureHash } from "../signature.js";

const router = express.Router();

function getStaff(id) {
  return db
    .prepare(
      `
    SELECT *
    FROM users
    WHERE id = ?
  `,
    )
    .get(Number(id));
}

/* ================= GET ================= */

router.get("/", verifyUser, (req, res) => {
  try {
    const rows = db
      .prepare(
        `
      SELECT *
      FROM corrections
      ORDER BY id DESC
    `,
      )
      .all();

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

    const original = db
      .prepare(
        `
      SELECT *
      FROM drug_transactions
      WHERE id = ?
    `,
      )
      .get(Number(originalTransactionId));

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

    if (staff1.role === "admin" || staff2.role === "admin") {
      return res.status(400).json({
        message: "Admin cannot sign clinical corrections",
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

    const result = db
      .prepare(
        `
      INSERT INTO corrections
      (
        originalTransactionId,

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
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        originalTransactionId,

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
        hash2,
      );

    // ONLY AFTER BOTH SIGNATURES → CHANGE STOCK

    if (stockAdjustment !== 0) {
      const drug = db
        .prepare(
          `
        SELECT *
        FROM drugs
        WHERE id = ?
      `,
        )
        .get(original.drugId);

      const before = Number(drug.quantity || 0);

      const after = before + stockAdjustment;

      db.prepare(
        `
        UPDATE drugs
        SET quantity = ?
        WHERE id = ?
      `,
      ).run(after, original.drugId);

      db.prepare(
        `
        INSERT INTO drug_transactions
        (
          transactionType,

          drugId,
          drugName,

          ampoulesSupplied,

          stockBalanceBefore,
          stockBalanceAfter,

          notes
        )

        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      ).run(
        "CORRECTION",

        original.drugId,
        original.drugName,

        stockAdjustment,

        before,
        after,

        `Automatic correction reversal for entry #${originalTransactionId}`,
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
