import express from "express";
import db from "../database.js";
import { verifyUser } from "../auth.js";
import { createSignatureHash } from "../signature.js";

const router = express.Router();

function isExpired(expiryDate) {
  if (!expiryDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return expiryDate < today;
}

function getActiveVerifiedStaff(id, label) {
  const staff = db
    .prepare(`
      SELECT id, username, role, fullName, active, staffType, expiryDate
      FROM users
      WHERE id = ?
    `)
    .get(Number(id));

  if (!staff) return { ok: false, message: `${label} staff account not found` };
  if (Number(staff.active) === 0) return { ok: false, message: `${label} staff account is inactive` };
  if (staff.staffType !== "Permanent" && isExpired(staff.expiryDate)) {
    return { ok: false, message: `${label} staff access has expired` };
  }
  if (staff.role === "admin") {
    return { ok: false, message: `Admin account cannot be used for ${label} stock check` };
  }

  return { ok: true, staff };
}

router.get("/", verifyUser, (req, res) => {
  try {
    const rows = db
      .prepare(`
        SELECT *
        FROM cd_stock_checks
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
      drugId,
      checkType,
      actualBalance,
      staffOneId,
      staffTwoId,
      notes,
    } = req.body;

    if (!drugId || !checkType || actualBalance === undefined) {
      return res.status(400).json({
        message: "Drug, check type and actual balance are required",
      });
    }

    if (!staffOneId || !staffTwoId) {
      return res.status(400).json({
        message: "Two verified staff members are required",
      });
    }

    if (Number(staffOneId) === Number(staffTwoId)) {
      return res.status(400).json({
        message: "Two different staff members must complete the check",
      });
    }

    const staffOneCheck = getActiveVerifiedStaff(staffOneId, "Staff 1");
    if (!staffOneCheck.ok) {
      return res.status(403).json({ message: staffOneCheck.message });
    }

    const staffTwoCheck = getActiveVerifiedStaff(staffTwoId, "Staff 2");
    if (!staffTwoCheck.ok) {
      return res.status(403).json({ message: staffTwoCheck.message });
    }

    const drug = db
      .prepare("SELECT * FROM drugs WHERE id = ?")
      .get(Number(drugId));

    if (!drug) {
      return res.status(404).json({ message: "Drug not found" });
    }

    const expectedBalance = Number(drug.quantity || 0);
    const countedBalance = Number(actualBalance);
    const difference = countedBalance - expectedBalance;

    const staffOneSignedAt = new Date().toISOString();
    const staffTwoSignedAt = new Date().toISOString();

    const staffOneSignatureHash = createSignatureHash({
      userId: staffOneCheck.staff.id,
      username: staffOneCheck.staff.username,
      fullName: staffOneCheck.staff.fullName,
      role: staffOneCheck.staff.role,
      action: `CD stock check ${checkType}`,
      drugName: drug.name,
      timestamp: staffOneSignedAt,
    });

    const staffTwoSignatureHash = createSignatureHash({
      userId: staffTwoCheck.staff.id,
      username: staffTwoCheck.staff.username,
      fullName: staffTwoCheck.staff.fullName,
      role: staffTwoCheck.staff.role,
      action: `CD stock check ${checkType}`,
      drugName: drug.name,
      timestamp: staffTwoSignedAt,
    });

    const result = db
      .prepare(`
        INSERT INTO cd_stock_checks
        (
          drugId,
          drugName,
          checkType,
          expectedBalance,
          actualBalance,
          difference,
          staffOneId,
          staffOneName,
          staffOneRole,
          staffOneStaffType,
          staffOneSignedAt,
          staffOneSignatureHash,
          staffTwoId,
          staffTwoName,
          staffTwoRole,
          staffTwoStaffType,
          staffTwoSignedAt,
          staffTwoSignatureHash,
          notes,
          createdByUsername
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        Number(drugId),
        drug.name,
        checkType,
        expectedBalance,
        countedBalance,
        difference,
        staffOneCheck.staff.id,
        staffOneCheck.staff.fullName || staffOneCheck.staff.username,
        staffOneCheck.staff.role,
        staffOneCheck.staff.staffType || "Permanent",
        staffOneSignedAt,
        staffOneSignatureHash,
        staffTwoCheck.staff.id,
        staffTwoCheck.staff.fullName || staffTwoCheck.staff.username,
        staffTwoCheck.staff.role,
        staffTwoCheck.staff.staffType || "Permanent",
        staffTwoSignedAt,
        staffTwoSignatureHash,
        notes || "",
        req.user.username
      );

    const saved = db
      .prepare("SELECT * FROM cd_stock_checks WHERE id = ?")
      .get(result.lastInsertRowid);

    return res.status(201).json({
      check: saved,
      discrepancy: difference !== 0,
      message:
        difference === 0
          ? "Stock check correct"
          : `Discrepancy detected: ${difference}`,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

export default router;
