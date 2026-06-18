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

function parseNumberFromText(text) {
  if (!text) return 0;
  const match = String(text).match(/[\d.]+/);
  return match ? Number(match[0]) : 0;
}

function getDoseUnit(concentration) {
  const text = String(concentration || "").toLowerCase();

  if (text.includes("mcg")) return "mcg";
  if (text.includes("mg")) return "mg";
  if (text.includes("ml")) return "ml";

  return "";
}

function amountPerAmpoule(drug) {
  const concentrationValue = parseNumberFromText(drug.concentration);
  const volume = parseNumberFromText(drug.size);

  if (!concentrationValue) return 0;

  if (String(drug.concentration || "").toLowerCase().includes("/ml")) {
    return concentrationValue * volume;
  }

  return concentrationValue;
}

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
    return res.status(500).json({ message: error.message });
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
      return res.status(404).json({ message: "Drug not found" });
    }

    const received = Number(ampoulesSupplied || 0);
    const used = Number(ampoulesUsed || 0);
    const administered = Number(amountAdministered || 0);
    const wasted = Number(amountWasted || 0);

    const isPatientUse = used > 0;

    if (!administeredByName || !witnessName) {
      return res.status(400).json({
        message: "Administered by/received by and witness/checker are required",
      });
    }

    if (
      administeredByName.trim().toLowerCase() ===
      witnessName.trim().toLowerCase()
    ) {
      return res.status(400).json({
        message: "Two different staff members are required",
      });
    }

    if (isPatientUse) {
      const unit = getDoseUnit(drug.concentration);
      const perAmpoule = amountPerAmpoule(drug);
      const totalAvailable = used * perAmpoule;
      const totalAccounted = administered + wasted;

      if (!perAmpoule || !unit) {
        return res.status(400).json({
          message:
            "Cannot calculate dose from this drug size/concentration. Please check drug setup.",
        });
      }

      if (administeredUnit !== unit || wastedUnit !== unit) {
        return res.status(400).json({
          message: `Dose unit must be ${unit} for this drug`,
        });
      }

      if (Math.abs(totalAvailable - totalAccounted) > 0.0001) {
        return res.status(400).json({
          message: `Dose mismatch. Opened ampoules contain ${totalAvailable} ${unit}, but administered + wasted = ${totalAccounted} ${unit}.`,
        });
      }
    }

    const previousBalance = Number(drug.quantity || 0);
    const newBalance = previousBalance + received - used;

    if (newBalance < 0) {
      return res.status(400).json({ message: "Not enough stock" });
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
        isPatientUse ? "patient_use" : "pharmacy_supply",
        Number(drugId),
        drugName || drug.name,
        patientName || "",
        hospitalNumber || "",
        received,
        used,
        administered,
        administeredUnit || "",
        wasted,
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
    return res.status(500).json({ message: error.message });
  }
});

export default router;