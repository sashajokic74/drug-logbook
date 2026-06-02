import Database from "better-sqlite3";

const db = new Database("druglogbook.db");

/* DRUG STOCK TABLE */

db.prepare(`
CREATE TABLE IF NOT EXISTS drugs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT,
  size TEXT,
  concentration TEXT,
  quantity INTEGER
)
`).run();


/* PATIENT LOGBOOK TABLE */

db.prepare(`
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patientName TEXT,
  hospitalNumber TEXT,
  drugName TEXT,
  doseGiven TEXT,
  quantityUsed INTEGER,
  balance INTEGER,
  staffId TEXT,
  staffName TEXT,
  checkerId TEXT,
  checkerName TEXT,
  staffSignature TEXT,
  checkerSignature TEXT,
  dateTime TEXT
)
`).run();


/* AUDIT TABLE - for next upgrade */

db.prepare(`
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();


export default db;