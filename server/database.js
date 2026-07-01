import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, "druglog.db"));

function addColumnIfMissing(table, column, type) {
  try {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
  } catch {
    // column already exists
  }
}

/* ================= HOSPITAL TABLE ================= */

db.prepare(`
CREATE TABLE IF NOT EXISTS hospitals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

/* ================= LOCATION TABLE ================= */

db.prepare(`
CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hospitalId INTEGER NOT NULL,
  hospitalName TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'Theatre',
  active INTEGER DEFAULT 1,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

/* ================= DEVICES TABLE ================= */

db.prepare(`
CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  deviceName TEXT NOT NULL,
  deviceCode TEXT UNIQUE NOT NULL,

  hospitalId INTEGER NOT NULL,
  hospitalName TEXT NOT NULL,

  locationId INTEGER NOT NULL,
  locationName TEXT NOT NULL,

  deviceType TEXT DEFAULT 'iPad',
  active INTEGER DEFAULT 1,

  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

/* ================= DRUG TABLE ================= */

db.prepare(`
CREATE TABLE IF NOT EXISTS drugs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT,
  size TEXT,
  concentration TEXT,
  quantity INTEGER DEFAULT 0,

  hospitalId INTEGER,
  hospitalName TEXT,
  locationId INTEGER,
  locationName TEXT,

  minimumStock INTEGER DEFAULT 5,
  maximumStock INTEGER DEFAULT 20
)
`).run();

addColumnIfMissing("drugs", "hospitalId", "INTEGER");
addColumnIfMissing("drugs", "hospitalName", "TEXT");
addColumnIfMissing("drugs", "locationId", "INTEGER");
addColumnIfMissing("drugs", "locationName", "TEXT");
addColumnIfMissing("drugs", "minimumStock", "INTEGER DEFAULT 5");
addColumnIfMissing("drugs", "maximumStock", "INTEGER DEFAULT 20");
addColumnIfMissing("users", "hospitalId", "INTEGER");
addColumnIfMissing("users", "hospitalName", "TEXT");
addColumnIfMissing("users", "locationId", "INTEGER");
addColumnIfMissing("users", "locationName", "TEXT");
addColumnIfMissing("users", "deviceId", "INTEGER");
addColumnIfMissing("users", "deviceName", "TEXT");

/* ================= PATIENT LISTS ================= */

db.prepare(`
CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  hospitalId INTEGER,
  hospitalName TEXT,
  locationId INTEGER,
  locationName TEXT,

  patientName TEXT NOT NULL,
  hospitalNumber TEXT NOT NULL,
  speciality TEXT,
  procedure TEXT,
  listDate TEXT,

  active INTEGER DEFAULT 1,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

addColumnIfMissing("patients", "hospitalId", "INTEGER");
addColumnIfMissing("patients", "hospitalName", "TEXT");
addColumnIfMissing("patients", "locationId", "INTEGER");
addColumnIfMissing("patients", "locationName", "TEXT");
addColumnIfMissing("patients", "speciality", "TEXT");
addColumnIfMissing("patients", "procedure", "TEXT");
addColumnIfMissing("patients", "listDate", "TEXT");
addColumnIfMissing("patients", "active", "INTEGER DEFAULT 1");

/* ================= OLD ENTRIES TABLE ================= */

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
  staffType TEXT DEFAULT 'Permanent',
  expiryDate TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

addColumnIfMissing("users", "fullName", "TEXT");
addColumnIfMissing("users", "active", "INTEGER DEFAULT 1");
addColumnIfMissing("users", "staffType", "TEXT DEFAULT 'Permanent'");
addColumnIfMissing("users", "expiryDate", "TEXT");
addColumnIfMissing("users", "createdAt", "DATETIME DEFAULT CURRENT_TIMESTAMP");

/* ================= CD REGISTER TRANSACTIONS ================= */

db.prepare(`
CREATE TABLE IF NOT EXISTS drug_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  transactionType TEXT,

  hospitalId INTEGER,
  hospitalName TEXT,
  locationId INTEGER,
  locationName TEXT,

  drugId INTEGER NOT NULL,
  drugName TEXT NOT NULL,

  patientName TEXT,
  hospitalNumber TEXT,

  ampoulesSupplied REAL DEFAULT 0,
  ampoulesUsed REAL DEFAULT 0,

  amountAdministered REAL DEFAULT 0,
  administeredUnit TEXT,

  amountWasted REAL DEFAULT 0,
  wastedUnit TEXT,

  stockBalanceBefore REAL DEFAULT 0,
  stockBalanceAfter REAL DEFAULT 0,

  administeredById TEXT,
  administeredByName TEXT,
  administeredSignature TEXT,
  administeredRole TEXT,
  administeredStaffType TEXT,
  administeredSignedAt TEXT,
  administeredSignatureHash TEXT,

  witnessId TEXT,
  witnessName TEXT,
  witnessSignature TEXT,
  witnessRole TEXT,
  witnessStaffType TEXT,
  witnessSignedAt TEXT,
  witnessSignatureHash TEXT,

  createdByUserId INTEGER,
  createdByUsername TEXT,
  createdByFullName TEXT,

  notes TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

const transactionColumns = [
  ["transactionType", "TEXT"],

  ["hospitalId", "INTEGER"],
  ["hospitalName", "TEXT"],
  ["locationId", "INTEGER"],
  ["locationName", "TEXT"],

  ["ampoulesSupplied", "REAL DEFAULT 0"],
  ["ampoulesUsed", "REAL DEFAULT 0"],

  ["amountAdministered", "REAL DEFAULT 0"],
  ["administeredUnit", "TEXT"],

  ["amountWasted", "REAL DEFAULT 0"],
  ["wastedUnit", "TEXT"],

  ["stockBalanceBefore", "REAL DEFAULT 0"],
  ["stockBalanceAfter", "REAL DEFAULT 0"],

  ["administeredById", "TEXT"],
  ["administeredByName", "TEXT"],
  ["administeredSignature", "TEXT"],
  ["administeredRole", "TEXT"],
  ["administeredStaffType", "TEXT"],
  ["administeredSignedAt", "TEXT"],
  ["administeredSignatureHash", "TEXT"],

  ["witnessId", "TEXT"],
  ["witnessName", "TEXT"],
  ["witnessSignature", "TEXT"],
  ["witnessRole", "TEXT"],
  ["witnessStaffType", "TEXT"],
  ["witnessSignedAt", "TEXT"],
  ["witnessSignatureHash", "TEXT"],

  ["createdByUserId", "INTEGER"],
  ["createdByUsername", "TEXT"],
  ["createdByFullName", "TEXT"],

  ["notes", "TEXT"],
];

transactionColumns.forEach(([column, type]) => {
  addColumnIfMissing("drug_transactions", column, type);
});

/* ================= CD STOCK CHECKS ================= */

db.prepare(`
CREATE TABLE IF NOT EXISTS cd_stock_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  hospitalId INTEGER,
  hospitalName TEXT,
  locationId INTEGER,
  locationName TEXT,

  drugId INTEGER NOT NULL,
  drugName TEXT NOT NULL,

  checkType TEXT NOT NULL,

  expectedBalance INTEGER NOT NULL,
  actualBalance INTEGER NOT NULL,
  difference INTEGER NOT NULL,

  staffOneId TEXT NOT NULL,
  staffOneName TEXT NOT NULL,
  staffOneRole TEXT,
  staffOneStaffType TEXT,
  staffOneSignedAt TEXT,
  staffOneSignatureHash TEXT,

  staffTwoId TEXT NOT NULL,
  staffTwoName TEXT NOT NULL,
  staffTwoRole TEXT,
  staffTwoStaffType TEXT,
  staffTwoSignedAt TEXT,
  staffTwoSignatureHash TEXT,

  notes TEXT,
  createdByUsername TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
)
`).run();

const stockCheckColumns = [
  ["hospitalId", "INTEGER"],
  ["hospitalName", "TEXT"],
  ["locationId", "INTEGER"],
  ["locationName", "TEXT"],

  ["staffOneRole", "TEXT"],
  ["staffOneStaffType", "TEXT"],
  ["staffOneSignedAt", "TEXT"],
  ["staffOneSignatureHash", "TEXT"],

  ["staffTwoRole", "TEXT"],
  ["staffTwoStaffType", "TEXT"],
  ["staffTwoSignedAt", "TEXT"],
  ["staffTwoSignatureHash", "TEXT"],
];

stockCheckColumns.forEach(([column, type]) => {
  addColumnIfMissing("cd_stock_checks", column, type);
});

/* ================= CORRECTIONS ================= */

db.prepare(`
CREATE TABLE IF NOT EXISTS corrections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  originalTransactionId INTEGER NOT NULL,

  hospitalId INTEGER,
  hospitalName TEXT,
  locationId INTEGER,
  locationName TEXT,

  correctionType TEXT NOT NULL DEFAULT 'documentation',
  reason TEXT NOT NULL,
  correctionText TEXT NOT NULL,

  stockAdjustment REAL DEFAULT 0,

  correctedById TEXT,
  correctedByName TEXT,
  correctedByRole TEXT,
  correctedSignedAt TEXT,
  correctedSignatureHash TEXT,

  checkedById TEXT,
  checkedByName TEXT,
  checkedByRole TEXT,
  checkedSignedAt TEXT,
  checkedSignatureHash TEXT,

  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
)
`).run();

const correctionColumns = [
  ["hospitalId", "INTEGER"],
  ["hospitalName", "TEXT"],
  ["locationId", "INTEGER"],
  ["locationName", "TEXT"],
  ["correctionType", "TEXT NOT NULL DEFAULT 'documentation'"],
  ["stockAdjustment", "REAL DEFAULT 0"],
];

correctionColumns.forEach(([column, type]) => {
  addColumnIfMissing("corrections", column, type);
});

/* ================= PHARMACY REQUESTS ================= */

db.prepare(`
CREATE TABLE IF NOT EXISTS pharmacy_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  requisitionNumber TEXT UNIQUE NOT NULL,

  hospitalId INTEGER,
  hospitalName TEXT,
  locationId INTEGER,
  locationName TEXT,

  drugId INTEGER NOT NULL,
  drugName TEXT NOT NULL,
  drugSize TEXT,
  drugConcentration TEXT,

  currentBalance REAL DEFAULT 0,
  quantityRequested REAL NOT NULL,

  reason TEXT,
  status TEXT DEFAULT 'Sent to Pharmacy',

  requestedById TEXT NOT NULL,
  requestedByName TEXT NOT NULL,
  requestedByRole TEXT,
  requestedByStaffType TEXT,
  requestedSignedAt TEXT,
  requestedSignatureHash TEXT,

  pharmacyEmail TEXT DEFAULT 'pharmacy.request@nhs.uk',
  emailSubject TEXT,
  emailBody TEXT,
  emailSent INTEGER DEFAULT 0,
  emailSentAt TEXT,

  receivedTransactionId INTEGER,
  receivedById TEXT,
  receivedByName TEXT,
  receivedAt TEXT,

  createdByUsername TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
)
`).run();
addColumnIfMissing("pharmacy_requests", "completedAt", "TEXT");
addColumnIfMissing("pharmacy_requests", "completedAt", "TEXT");
addColumnIfMissing("pharmacy_requests", "completedById", "TEXT");
addColumnIfMissing("pharmacy_requests", "completedByName", "TEXT");
addColumnIfMissing("pharmacy_requests", "checkedById", "TEXT");
addColumnIfMissing("pharmacy_requests", "checkedByName", "TEXT");

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
