import express from "express";
import db from "../database.js";
import { verifyUser } from "../auth.js";
import { createSignatureHash } from "../signature.js";

const router = express.Router();
const REORDER_LEVEL = 5;

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

function getStaffById(id) {
  if (!id) return null;

  return db
    .prepare(`
      SELECT id, username, fullName, role, staffType
      FROM users
      WHERE id = ?
    `)
    .get(Number(id));
}

function isAdminRole(roleValue) {
  return String(roleValue || "").toLowerCase() === "admin";
}

function isDoctorOrAnaesthetistRole(roleValue) {
  const role = String(roleValue || "").toLowerCase();

  return (
    role === "doctor" ||
    role === "dr" ||
    role.startsWith("dr ") ||
    role.includes(" doctor") ||
    role.includes("surgeon") ||
    role.includes("anaesthetist")
  );
}

function isBlockedSecondCheckerRole(roleValue) {
  return isAdminRole(roleValue) || isDoctorOrAnaesthetistRole(roleValue);
}

function isAuthorisedStockRole(roleValue) {
  const role = String(roleValue || "").toLowerCase();

  if (isBlockedSecondCheckerRole(role)) {
    return false;
  }

  return (
    role.includes("odp") ||
    role.includes("anaesthetic") ||
    role.includes("anaesthetics") ||
    role.includes("nurse") ||
    role.includes("theatre")
  );
}

router.get("/:drugId", verifyUser, (req, res) => {
  try {
    const { hospitalId, locationId } = req.query;
    const params = [Number(req.params.drugId)];

    let sql = `
      SELECT *
      FROM drug_transactions
      WHERE drugId = ?
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
      hospitalId,
      hospitalName,
      locationId,
      locationName,
      notes,
    } = req.body;

    const drug = db
      .prepare("SELECT * FROM drugs WHERE id = ?")
      .get(Number(drugId));

    if (!drug) {
      return res.status(404).json({ message: "Drug not found" });
    }

    if (!hospitalId || !locationId) {
      return res.status(400).json({
        message: "Device hospital and location are required",
      });
    }

    db.prepare(`
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
    `).run(
      Number(hospitalId),
      hospitalName || "",
      Number(locationId),
      locationName || "",
      Number(drugId),
      Number(drug.quantity || 0),
      Number(drug.minimumStock || 5),
      Number(drug.maximumStock || 20)
    );

    const locationStock = db
      .prepare(`
        SELECT *
        FROM location_drug_stock
        WHERE hospitalId = ?
          AND locationId = ?
          AND drugId = ?
      `)
      .get(Number(hospitalId), Number(locationId), Number(drugId));

    const received = Number(ampoulesSupplied || 0);
    const used = Number(ampoulesUsed || 0);
    const administered = Number(amountAdministered || 0);
    const wasted = Number(amountWasted || 0);

    const isPatientUse = used > 0;

    if (received <= 0 && used <= 0) {
      return res.status(400).json({
        message: "Enter ampoules used or ampoules received",
      });
    }

    if (received > 0 && used > 0) {
      return res.status(400).json({
        message:
          "Patient use and pharmacy supply must be recorded as separate entries",
      });
    }

    if (isPatientUse && (!patientName || !hospitalNumber)) {
      return res.status(400).json({
        message: "Patient name and MRN / NHS / hospital number are required",
      });
    }

    if (!administeredById || !witnessId) {
      return res.status(400).json({
        message: "Two verified staff members are required",
      });
    }

    if (Number(administeredById) === Number(witnessId)) {
      return res.status(400).json({
        message: "Two different staff members are required",
      });
    }

    const administeredStaff = getStaffById(administeredById);
    const witnessStaff = getStaffById(witnessId);

    if (!administeredStaff || !witnessStaff) {
      return res.status(400).json({
        message: "Verified staff record not found",
      });
    }

    if (isPatientUse) {
      if (isAdminRole(administeredStaff.role)) {
        return res.status(400).json({
          message: "Admin account cannot sign as administering clinician",
        });
      }

      if (isBlockedSecondCheckerRole(witnessStaff.role)) {
        return res.status(400).json({
          message:
            "Second checker must be ODP, anaesthetic practitioner, theatre practitioner or nurse",
        });
      }
    } else if (
      !isAuthorisedStockRole(administeredStaff.role) ||
      !isAuthorisedStockRole(witnessStaff.role)
    ) {
      return res.status(400).json({
        message:
          "Only ODP, anaesthetic practitioner, theatre practitioner or nurse can receive and check controlled drug stock",
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

    const previousBalance = Number(locationStock.quantity || 0);
    const newBalance = previousBalance + received - used;

    if (newBalance < 0) {
      return res.status(400).json({ message: "Not enough stock" });
    }

    const transactionType = isPatientUse ? "patient_use" : "pharmacy_supply";
    const reorderRequired = newBalance < REORDER_LEVEL;

    const administeredSignedAt = new Date().toISOString();
    const witnessSignedAt = new Date().toISOString();

    const administeredSignatureHash = createSignatureHash({
      userId: administeredStaff.id,
      username: administeredStaff.username,
      fullName: administeredStaff.fullName,
      role: administeredStaff.role,
      action: transactionType,
      drugName: drug.name,
      timestamp: administeredSignedAt,
    });

    const witnessSignatureHash = createSignatureHash({
      userId: witnessStaff.id,
      username: witnessStaff.username,
      fullName: witnessStaff.fullName,
      role: witnessStaff.role,
      action: transactionType,
      drugName: drug.name,
      timestamp: witnessSignedAt,
    });

    const saveTransaction = db.transaction(() => {
      const result = db
        .prepare(`
          INSERT INTO drug_transactions
          (
          transactionType,
          hospitalId,
          hospitalName,
          locationId,
          locationName,
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
            administeredRole,
            administeredStaffType,
            administeredSignedAt,
            administeredSignatureHash,

            witnessId,
            witnessName,
            witnessSignature,
            witnessRole,
            witnessStaffType,
            witnessSignedAt,
            witnessSignatureHash,

            createdByUserId,
            createdByUsername,
            createdByFullName,
            notes
          )
          VALUES
          (
            ?,?,?,?,?,?,?,?,?,?,
            ?,?,?,?,?,?,?,?,?,?,
            ?,?,?,?,?,?,?,?,?,?,
            ?,?,?,?,?
          )
        `)
        .run(
          transactionType,
          Number(hospitalId),
          hospitalName || "",
          Number(locationId),
          locationName || "",
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

          administeredStaff.id,
          administeredStaff.fullName || administeredByName || "",
          administeredSignature || administeredStaff.username,
          administeredStaff.role,
          administeredStaff.staffType || "Permanent",
          administeredSignedAt,
          administeredSignatureHash,

          witnessStaff.id,
          witnessStaff.fullName || witnessName || "",
          witnessSignature || witnessStaff.username,
          witnessStaff.role,
          witnessStaff.staffType || "Permanent",
          witnessSignedAt,
          witnessSignatureHash,

          req.user.id,
          req.user.username,
          req.user.fullName || req.user.username,

          notes || ""
        );

      db.prepare(`
        UPDATE location_drug_stock
        SET quantity = ?
          , updatedAt = CURRENT_TIMESTAMP
        WHERE hospitalId = ?
          AND locationId = ?
          AND drugId = ?
      `).run(
        newBalance,
        Number(hospitalId),
        Number(locationId),
        Number(drugId)
      );

      db.prepare(`
        INSERT INTO audit (action, username, role)
        VALUES (?, ?, ?)
      `).run(
        `${transactionType}: ${drug.name} ${previousBalance} -> ${newBalance} (${locationName || "location"})`,
        req.user.username,
        req.user.role
      );

      return db
        .prepare("SELECT * FROM drug_transactions WHERE id = ?")
        .get(result.lastInsertRowid);
    });

    const saved = saveTransaction();

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
