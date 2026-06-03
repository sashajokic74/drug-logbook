import Database from "better-sqlite3";

const db = new Database("druglogbook.db");

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

  checkerId TEXT,
  checkerName TEXT,

  staffSignature TEXT,
  checkerSignature TEXT,

  dateTime TEXT
)
`).run();

/* ================= AUDIT TABLE ================= */

db.prepare(`
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  username TEXT,
  role TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

/* ================= DEFAULT ADMIN ================= */

const adminExists = db
  .prepare("SELECT * FROM users WHERE username = ?")
  .get("admin");

if (!adminExists) {
  db.prepare(`
    INSERT INTO users
    (username, password, role, fullName)
    VALUES (?, ?, ?, ?)
  `).run(
    "admin",
    "admin123",
    "admin",
    "System Administrator"
  );

  console.log("Admin user created");
}

export default db;