import express from "express";
import cors from "cors";
import seedDrugs from "./drugData.js";
import db from "./database.js";

const app = express();

app.use(cors());
app.use(express.json());


/* ================= DATABASE SEED ================= */

const existingDrugs = db
  .prepare("SELECT * FROM drugs")
  .all();

console.log("Drugs in SQLite:", existingDrugs.length);


if (existingDrugs.length === 0) {

  console.log("Adding original drug cards...");

  const insertDrug = db.prepare(`
    INSERT INTO drugs
    (name, category, size, concentration, quantity)
    VALUES (?, ?, ?, ?, ?)
  `);


  seedDrugs.forEach((drug) => {

    insertDrug.run(
      drug.name,
      drug.category,
      drug.size,
      drug.concentration,
      drug.quantity
    );

  });


  console.log("Original cards saved to SQLite");

}



/* ================= DRUG ROUTES ================= */


app.get("/drugs", (req, res) => {

  const drugs = db
    .prepare("SELECT * FROM drugs")
    .all();


  return res.status(200).json(drugs);

});




app.post("/drugs", (req, res) => {


  const result = db.prepare(`
    INSERT INTO drugs
    (name, category, size, concentration, quantity)
    VALUES (?, ?, ?, ?, ?)
  `)
  .run(
    req.body.name,
    req.body.category || "",
    req.body.size || "",
    req.body.concentration || "",
    Number(req.body.quantity || 0)
  );


  const newDrug = db
    .prepare("SELECT * FROM drugs WHERE id=?")
    .get(result.lastInsertRowid);


  return res.status(201).json(newDrug);

});




app.put("/drugs/:id", (req, res) => {


  db.prepare(`
    UPDATE drugs SET
    name=?,
    category=?,
    size=?,
    concentration=?,
    quantity=?
    WHERE id=?
  `)
  .run(
    req.body.name,
    req.body.category,
    req.body.size,
    req.body.concentration,
    Number(req.body.quantity),
    Number(req.params.id)
  );


  const updatedDrug = db
    .prepare("SELECT * FROM drugs WHERE id=?")
    .get(req.params.id);


  return res.json(updatedDrug);

});




app.delete("/drugs/:id", (req, res) => {


  db.prepare(
    "DELETE FROM drugs WHERE id=?"
  )
  .run(req.params.id);


  return res.status(204).end();

});




/* ================= ENTRIES ================= */


app.get("/entries", (req, res) => {


  const entries = db
    .prepare("SELECT * FROM entries ORDER BY id DESC")
    .all();


  return res.json(entries);

});




app.post("/entries", (req, res) => {


  const selectedDrug = db
    .prepare("SELECT * FROM drugs WHERE name=?")
    .get(req.body.drugName);


  if (!selectedDrug) {

    return res.status(404).json({
      message: "Drug not found"
    });

  }


  const quantityUsed =
    Number(req.body.quantityUsed);


  if (quantityUsed > selectedDrug.quantity) {

    return res.status(400).json({
      message: "Not enough stock"
    });

  }


  const balance =
    selectedDrug.quantity - quantityUsed;


  db.prepare(
    "UPDATE drugs SET quantity=? WHERE id=?"
  )
  .run(balance, selectedDrug.id);



  const result = db.prepare(`

    INSERT INTO entries

    (
      patientName,
      hospitalNumber,
      drugName,
      doseGiven,
      quantityUsed,
      balance,
      staffId,
      staffName,
      checkerId,
      checkerName,
      staffSignature,
      checkerSignature,
      dateTime
    )

    VALUES

    (?,?,?,?,?,?,?,?,?,?,?,?,?)

  `)
  .run(

    req.body.patientName,
    req.body.hospitalNumber,
    req.body.drugName,
    req.body.doseGiven,
    quantityUsed,
    balance,
    req.body.staffId,
    req.body.staffName,
    req.body.checkerId,
    req.body.checkerName,
    req.body.staffSignature,
    req.body.checkerSignature,
    new Date().toLocaleString()

  );


  const entry = db
    .prepare("SELECT * FROM entries WHERE id=?")
    .get(result.lastInsertRowid);


  const drugs = db
    .prepare("SELECT * FROM drugs")
    .all();



  return res.status(201).json({
    entry,
    drugs
  });

});




app.delete("/entries/:id", (req,res)=>{


  db.prepare(
    "DELETE FROM entries WHERE id=?"
  )
  .run(req.params.id);


  return res.status(204).end();

});




/* ================= SERVER ================= */


const PORT = 8000;


app.listen(PORT, () => {

  console.log(`Server running on port ${PORT}`);

});