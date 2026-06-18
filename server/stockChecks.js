import express from "express";
import db from "./database.js";
import { verifyUser } from "./auth.js";

const router = express.Router();

db.prepare(`
  CREATE TABLE IF NOT EXISTS cd_stock_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drugId INTEGER NOT NULL,
    drugName TEXT NOT NULL,
    checkType TEXT NOT NULL,
    expectedBalance INTEGER NOT NULL,
    actualBalance INTEGER NOT NULL,
    difference INTEGER NOT NULL,
    staffOneId TEXT NOT NULL,
    staffOneName TEXT NOT NULL,
    staffTwoId TEXT NOT NULL,
    staffTwoName TEXT NOT NULL,
    notes TEXT,
    createdByUsername TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  )
`).run();

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

function isExpired(expiryDate) {
  if (!expiryDate) return false;

  const today = new Date().toISOString().slice(0, 10);

  return expiryDate < today;
}

function getActiveVerifiedStaff(id, name) {
  const staff = db
    .prepare(`
      SELECT id, username, role, fullName, active, staffType, expiryDate
      FROM users
      WHERE id = ?
    `)
    .get(Number(id));

  if (!staff) {
    return {
      ok: false,
      message: `${name} staff account not found`,
    };
  }

  if (Number(staff.active) === 0) {
    return {
      ok: false,
      message: `${name} staff account is inactive`,
    };
  }

  if (staff.staffType !== "Permanent" && isExpired(staff.expiryDate)) {
    return {
      ok: false,
      message: `${name} staff access has expired`,
    };
  }

  if (staff.role === "admin") {
    return {
      ok: false,
      message: `Admin account cannot be used for ${name} stock check`,
    };
  }

  return {
    ok: true,
    staff,
  };
}

router.post("/", verifyUser, (req, res) => {
  try {
    const {
      drugId,
      checkType,
      actualBalance,
      staffOneId,
      staffOneName,
      staffTwoId,
      staffTwoName,
      notes,
    } = req.body;

    if (!drugId || !checkType || actualBalance === undefined) {
      return res.status(400).json({
        message: "Drug, check type and actual balance are required",
      });
    }

    if (!staffOneId || !staffTwoId) {
      return res.status(400).json({
        message: "Two verified staff members are required for CD stock check",
      });
    }

    if (Number(staffOneId) === Number(staffTwoId)) {
      return res.status(400).json({
        message: "Two different staff members must complete the check",
      });
    }

    const staffOneCheck = getActiveVerifiedStaff(staffOneId, "Staff 1");

    if (!staffOneCheck.ok) {
      return res.status(403).json({
        message: staffOneCheck.message,
      });
    }

    const staffTwoCheck = getActiveVerifiedStaff(staffTwoId, "Staff 2");

    if (!staffTwoCheck.ok) {
      return res.status(403).json({
        message: staffTwoCheck.message,
      });
    }

    const drug = db
      .prepare("SELECT * FROM drugs WHERE id = ?")
      .get(Number(drugId));

    if (!drug) {
      return res.status(404).json({
        message: "Drug not found",
      });
    }

    const expectedBalance = Number(drug.quantity || 0);
    const countedBalance = Number(actualBalance);
    const difference = countedBalance - expectedBalance;

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
          staffTwoId,
          staffTwoName,
          notes,
          createdByUsername
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        staffTwoCheck.staff.id,
        staffTwoCheck.staff.fullName || staffTwoCheck.staff.username,
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