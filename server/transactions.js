import express from "express";
import db from "./database.js";
import { verifyUser } from "./auth.js";

const router = express.Router();
const REORDER_LEVEL = 5;

function addColumnIfMissing(columnSql) {
  try {
    db.prepare(columnSql).run();
  } catch {
    // column already exists
  }
}

addColumnIfMissing(`
  ALTER TABLE drug_transactions
  ADD COLUMN stockBalanceBefore INTEGER
`);

router.get("/:drugId", verifyUser, (req, res) => {
  try {
    const rows = db
      .prepare(`
        SELECT *
        FROM drug_transactions
        WHERE drugId = ?
        ORDER BY id DESC
      `)
      .all(Number(req.params.drugId));

    return res.status(200).json(rows);
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
});

router.post("/", verifyUser, (req, res) => {
  try {
    const {
      drugId,
      drugName,
      patientName,
      hospitalNumber,
      ampoulesSupplied,
      ampoulesUsed,
      amountAdministered,
      administeredUnit,
      amountWasted,
      wastedUnit,
      administeredById,
      administeredByName,
      administeredSignature,
      witnessId,
      witnessName,
      witnessSignature,
      notes,
    } = req.body;

    const drug = db
      .prepare("SELECT * FROM drugs WHERE id = ?")
      .get(Number(drugId));

    if (!drug) {
      return res.status(404).json({
        message: "Drug not found",
      });
    }

    if (!administeredByName || !witnessName) {
      return res.status(400).json({
        message: "Administered by and witness/checker are required",
      });
    }

    if (
      administeredByName.trim().toLowerCase() ===
      witnessName.trim().toLowerCase()
    ) {
      return res.status(400).json({
        message:
          "Administered by and witness/checker must be two different people",
      });
    }

    const receivedFromPharmacy = Number(ampoulesSupplied || 0);
    const openedOrUsed = Number(ampoulesUsed || 0);

    const previousBalance = Number(drug.quantity || 0);
    const newBalance = previousBalance + receivedFromPharmacy - openedOrUsed;

    if (newBalance < 0) {
      return res.status(400).json({
        message: "Not enough stock",
      });
    }

    const reorderRequired = newBalance < REORDER_LEVEL;

    const result = db
      .prepare(`
        INSERT INTO drug_transactions
        (
          transactionType,
          drugId,
          drugName,
          patientName,
          hospitalNumber,
          ampoulesSupplied,
          ampoulesUsed,
          amountAdministered,
          administeredUnit,
          amountWasted,
          wastedUnit,
          stockBalanceBefore,
          stockBalanceAfter,
          administeredById,
          administeredByName,
          administeredSignature,
          witnessId,
          witnessName,
          witnessSignature,
          createdByUserId,
          createdByUsername,
          createdByFullName,
          notes
        )
        VALUES
        (
          ?,?,?,?,?,?,?,?,?,?,
          ?,?,?,?,?,?,?,?,?,?,
          ?,?,?
        )
      `)
      .run(
        "cd_entry",
        Number(drugId),
        drugName || drug.name,
        patientName || "",
        hospitalNumber || "",
        receivedFromPharmacy,
        openedOrUsed,
        Number(amountAdministered || 0),
        administeredUnit || "",
        Number(amountWasted || 0),
        wastedUnit || "",
        previousBalance,
        newBalance,
        administeredById || "",
        administeredByName || "",
        administeredSignature || "",
        witnessId || "",
        witnessName || "",
        witnessSignature || "",
        req.user.id,
        req.user.username,
        req.user.fullName || req.user.username,
        notes || ""
      );

    db.prepare(`
      UPDATE drugs
      SET quantity = ?
      WHERE id = ?
    `).run(newBalance, Number(drugId));

    const saved = db
      .prepare("SELECT * FROM drug_transactions WHERE id = ?")
      .get(result.lastInsertRowid);

    return res.status(201).json({
      entry: saved,
      balance: newBalance,
      reorderRequired,
      reorderMessage: reorderRequired
        ? "Stock below 5 ampoules. Reorder from pharmacy."
        : "",
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
});

export default router;