import {randomUUID} from 'node:crypto';
import {batchMetadata,patientBatch,consumeBatch,insertBatch} from '../stockBatches.js';
import express from "express";
import db from "../database.js";
import { verifyUser } from "../auth.js";
import { createSignatureHash } from "../signature.js";

import {clinicalCredentials} from '../clinicalCredentials.js';
import {transactionSubmission,rememberTransaction} from '../submissionKeys.js';
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

function isBlockedStockRole(roleValue) {
  return isAdminRole(roleValue) || isDoctorOrAnaesthetistRole(roleValue);
}

function isAuthorisedStockRole(roleValue) {
  const role = String(roleValue || "").toLowerCase();

  if (isBlockedStockRole(role)) {
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
      SELECT
        drug_transactions.*,
        (
          SELECT COUNT(*)
          FROM corrections
          WHERE corrections.originalTransactionId = drug_transactions.id
        ) AS correctionCount,
        (
          SELECT correctionType
          FROM corrections
          WHERE corrections.originalTransactionId = drug_transactions.id
          ORDER BY corrections.id DESC
          LIMIT 1
        ) AS latestCorrectionType,
        (
          SELECT reason
          FROM corrections
          WHERE corrections.originalTransactionId = drug_transactions.id
          ORDER BY corrections.id DESC
          LIMIT 1
        ) AS latestCorrectionReason
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
    return res.status(error.status||500).json({ message: error.message });
  }
});

router.post("/", verifyUser, clinicalCredentials([['administeredById','administeredCredentials'],['witnessId','witnessCredentials']]), transactionSubmission, (req, res) => {
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

    const supplied=Number(ampoulesSupplied??0),opened=Number(ampoulesUsed??0),given=Number(amountAdministered??0),discarded=Number(amountWasted??0);
    if(![supplied,opened].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000)||![given,discarded].every(n=>Number.isFinite(n)&&n>=0&&n<=1000000000))return res.status(400).json({message:'Use nonnegative dose and waste amounts, and whole stock quantities.'});
    if(supplied>0&&(given!==0||discarded!==0))return res.status(400).json({message:'A stock receipt cannot include an administered or wasted dose.'});
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
      0,
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

      if (isAdminRole(witnessStaff.role)) {
        return res.status(400).json({
          message: "Admin account cannot sign as witness / second signature",
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
    if(typeof req.body.expectedBalance!=='number'||req.body.expectedBalance!==previousBalance)return res.status(409).json({message:'Stock changed. Refresh and check the balance before signing.'});
    const newBalance = previousBalance + received - used;

    if (newBalance < 0) {
      return res.status(400).json({ message: "Not enough stock" });
    }

    let requisition=null;
    if(received>0){
      requisition=db.prepare('SELECT * FROM pharmacy_requests WHERE id=?').get(Number(req.body.requestId));
      if(!requisition||requisition.status!=='DISPATCHED'||Number(requisition.drugId)!==Number(drugId)||Number(requisition.hospitalId)!==Number(hospitalId)||Number(requisition.locationId)!==Number(locationId)||received>Number(requisition.quantityRequested)-Number(requisition.quantityReceived||0))return res.status(409).json({message:'Select the dispatched requisition matching this medicine, location and outstanding quantity. It may already have been received.'});
    }
    const packaging=received>0?batchMetadata(req.body.batchNumber,req.body.expiryDate,{incoming:true}):patientBatch(req.body,used);
    const batchId=received>0?randomUUID():packaging.id;
    req.body.batchId=batchId;req.body.batchNumber=packaging.batchNumber;req.body.expiryDate=packaging.expiryDate;
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
      record:{...req.body,stockBalanceBefore:previousBalance,stockBalanceAfter:newBalance},
    });

    const witnessSignatureHash = createSignatureHash({
      userId: witnessStaff.id,
      username: witnessStaff.username,
      fullName: witnessStaff.fullName,
      role: witnessStaff.role,
      action: transactionType,
      drugName: drug.name,
      timestamp: witnessSignedAt,
      record:{...req.body,stockBalanceBefore:previousBalance,stockBalanceAfter:newBalance},
    });

    const saveTransaction = db.transaction(() => {
      if(isPatientUse)consumeBatch(packaging,used);
      if(requisition){const newReceived=Number(requisition.quantityReceived||0)+received;const changed=db.prepare("UPDATE pharmacy_requests SET quantityReceived=?,status=?,completedAt=CASE WHEN ?='COMPLETED' THEN datetime('now') ELSE completedAt END WHERE id=? AND status='DISPATCHED' AND quantityReceived=?").run(newReceived,newReceived===Number(requisition.quantityRequested)?'COMPLETED':'DISPATCHED',newReceived===Number(requisition.quantityRequested)?'COMPLETED':'DISPATCHED',requisition.id,Number(requisition.quantityReceived||0));if(changed.changes!==1)throw new Error('Requisition changed. Refresh before receiving.');}
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

      if(received>0)insertBatch({id:batchId,hospitalId,locationId,drugId,...packaging,quantity:received,source:'pharmacy-receipt',firstId:administeredStaff.id,secondId:witnessStaff.id,transactionId:Number(result.lastInsertRowid)});
      db.prepare('UPDATE drug_transactions SET batchId=?,batchNumber=?,expiryDate=?,pharmacyRequestId=? WHERE id=?').run(batchId,packaging.batchNumber,packaging.expiryDate,requisition?.id||null,result.lastInsertRowid);
      const saved=db.prepare('SELECT * FROM drug_transactions WHERE id=?').get(result.lastInsertRowid);
      rememberTransaction(req,{entry:saved,balance:newBalance,reorderRequired});
      return saved;
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
    return res.status(error.status||500).json({ message: error.message });
  }
});

export default router;
