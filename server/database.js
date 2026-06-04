import Database from "better-sqlite3";

const db = new Database("druglog.db");

/* ================= DRUG TABLE ================= */

db.prepare(`
CREATE TABLE IF NOT EXISTS drugs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT,
  size TEXT,
  concentration TEXT,
  quantity INTEGER DEFAULT 0
)
`).run();

/* ================= ENTRIES TABLE ================= */

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
  staffSignature TEXT,
  checkerId TEXT,
  checkerName TEXT,
  checkerSignature TEXT,
  dateTime TEXT
)
`).run();

/* ================= USERS TABLE ================= */

db.prepare(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL,
  fullName TEXT,
  active INTEGER DEFAULT 1,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

try {
  db.prepare("ALTER TABLE users ADD COLUMN fullName TEXT").run();
} catch (error) {}

try {
  db.prepare("ALTER TABLE users ADD COLUMN createdAt DATETIME DEFAULT CURRENT_TIMESTAMP").run();
} catch (error) {}

try {
  db.prepare("ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 1").run();
} catch (error) {}

/* ================= AUDIT TABLE ================= */

db.prepare(`
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT,
  username TEXT,
  role TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

export default db;