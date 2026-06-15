import express from "express";
import db from "./database.js";
import { verifyUser } from "./auth.js";

const router = express.Router();

/* =========================
   READ DRUG REGISTER
========================= */

router.get("/:drugId", verifyUser, (req, res) => {
  try {
    const rows = db
      .prepare(`
        SELECT *
        FROM drug_transactions
        WHERE drugId = ?
        ORDER BY id DESC
      `)
      .all(req.params.drugId);

    res.json(rows);

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});


/* =========================
   CREATE CD ENTRY
========================= */

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
      .prepare(`
        SELECT *
        FROM drugs
        WHERE id = ?
      `)
      .get(drugId);


    if (!drug) {
      return res.status(404).json({
        message: "Drug not found",
      });
    }


    const supplied = Number(ampoulesSupplied || 0);
    const used = Number(ampoulesUsed || 0);


    const newBalance =
      Number(drug.quantity) + supplied - used;


    if (newBalance < 0) {
      return res.status(400).json({
        message: "Not enough stock",
      });
    }


    const insert = db.prepare(`
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
        ?,?
      )
    `);


    const result = insert.run(

      "cd_entry",

      drugId,
      drugName,

      patientName || "",
      hospitalNumber || "",

      supplied,
      used,

      amountAdministered || 0,
      administeredUnit || "",

      amountWasted || 0,
      wastedUnit || "",

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
    `)
    .run(newBalance, drugId);


    const saved = db
      .prepare(`
        SELECT *
        FROM drug_transactions
        WHERE id = ?
      `)
      .get(result.lastInsertRowid);


    res.json({
      entry: saved,
      balance: newBalance,
    });


  } catch (error) {

    res.status(500).json({
      message: error.message,
    });

  }
});


export default router;