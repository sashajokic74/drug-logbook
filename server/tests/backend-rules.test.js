import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

process.env.NODE_ENV = "test";
process.env.DRUGLOG_DB_PATH = path.join(
  os.tmpdir(),
  `drug-logbook-test-${process.pid}.db`
);
process.env.JWT_SECRET = "test-secret";
process.env.DEFAULT_ADMIN_PASSWORD = "admin123";

const { default: app } = await import("../server.js");
const { default: db } = await import("../database.js");

let server;
let baseUrl;

function request(pathname, options = {}) {
  return fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

function hashPassword(password = "pass123") {
  return bcrypt.hashSync(password, 4);
}

function insertUser({ username, role, fullName }) {
  const result = db
    .prepare(`
      INSERT INTO users
      (
        username,
        password,
        role,
        fullName,
        active,
        staffType,
        accessScope
      )
      VALUES (?, ?, ?, ?, 1, 'Permanent', 'ALL')
    `)
    .run(username, hashPassword(), role, fullName || username);

  return result.lastInsertRowid;
}

async function login(username = "odp") {
  const response = await request("/login", {
    method: "POST",
    body: JSON.stringify({
      username,
      password: "pass123",
      hospitalId: 1,
      locationId: 1,
      locationName: "TH8",
    }),
  });

  const body = await response.json();
  assert.equal(response.status, 200, body.message);
  return body.token;
}

function seedBaseData() {
  const odpId = insertUser({
    username: "odp",
    role: "odp",
    fullName: "Olivia ODP",
  });
  const nurseId = insertUser({
    username: "nurse",
    role: "nurse",
    fullName: "Nina Nurse",
  });
  const doctorId = insertUser({
    username: "doctor",
    role: "doctor",
    fullName: "Dr Test",
  });
  const surgeonId = insertUser({
    username: "surgeon",
    role: "surgeon",
    fullName: "Mr Surgeon",
  });

  const drugId = db
    .prepare(`
      INSERT INTO drugs
      (
        name,
        category,
        size,
        concentration,
        quantity,
        hospitalId,
        hospitalName,
        locationId,
        locationName
      )
      VALUES ('Fentanyl', 'CD', '2ml', '50mcg/ml', 10, 1, 'Test Hospital', 1, 'TH8')
    `)
    .run().lastInsertRowid;

  db.prepare(`
    INSERT INTO location_drug_stock
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
    VALUES (1, 'Test Hospital', 1, 'TH8', ?, 10, 5, 20)
  `).run(drugId);

  return { odpId, nurseId, doctorId, surgeonId, drugId };
}

async function createPatientUseTransaction({
  token,
  drugId,
  administeredById,
  witnessId,
  ampoulesUsed = 1,
}) {
  const response = await request("/transactions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      drugId,
      drugName: "Fentanyl",
      patientName: "Test Patient",
      hospitalNumber: "MRN-1",
      ampoulesSupplied: 0,
      ampoulesUsed,
      amountAdministered: 50 * ampoulesUsed,
      administeredUnit: "mcg",
      amountWasted: 50 * ampoulesUsed,
      wastedUnit: "mcg",
      administeredById,
      administeredByName: "Signer One",
      administeredSignature: "signer1",
      witnessId,
      witnessName: "Signer Two",
      witnessSignature: "signer2",
      hospitalId: 1,
      hospitalName: "Test Hospital",
      locationId: 1,
      locationName: "TH8",
      notes: "",
    }),
  });

  return {
    response,
    body: await response.json(),
  };
}

before(async () => {
  await new Promise((resolve) => {
    server = createServer(app);
    server.listen(0, "127.0.0.1", () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

function restrictUser(username, scope = "LOCATIONS") {
  db.prepare("INSERT OR IGNORE INTO hospitals (id, name, active) VALUES (1, 'Test Hospital', 1), (2, 'Other Hospital', 1)").run();
  db.prepare(`INSERT OR IGNORE INTO locations (id, hospitalId, hospitalName, name, type, active)
    VALUES (1, 1, 'Test Hospital', 'TH8', 'Theatre', 1), (2, 2, 'Other Hospital', 'Other Theatre', 'Theatre', 1)`).run();
  db.prepare("UPDATE users SET accessScope = ?, accessHospitalIds = '1', accessLocationIds = '1' WHERE username = ?").run(scope, username);
}

test("deactivation revokes existing sessions, including after reactivation", async () => {
  const { odpId } = seedBaseData();
  insertUser({ username: "review-admin", role: "admin" });
  const adminToken = await login("review-admin");
  const token = await login();
  assert.equal((await request(`/users/${odpId}/deactivate`, { method: "PUT", headers: auth(adminToken) })).status, 200);
  assert.equal((await request("/drugs", { headers: auth(token) })).status, 401);
  assert.equal((await request(`/users/${odpId}/reactivate`, { method: "PUT", headers: auth(adminToken) })).status, 200);
  assert.equal((await request("/drugs", { headers: auth(token) })).status, 401);
  assert.equal((await request("/drugs", { headers: auth(await login()) })).status, 200);
});

test("staff expiry and access expiry apply to existing sessions and admin logins", async () => {
  seedBaseData();
  const token = await login();
  db.prepare("UPDATE users SET staffType = 'Temporary', expiryDate = '2000-01-01' WHERE username = 'odp'").run();
  assert.equal((await request("/drugs", { headers: auth(token) })).status, 401);
  db.prepare("UPDATE users SET staffType = 'Permanent', accessExpiryDate = '2000-01-01' WHERE username = 'odp'").run();
  assert.equal((await request("/drugs", { headers: auth(token) })).status, 401);
  insertUser({ username: "expired-admin", role: "admin" });
  db.prepare("UPDATE users SET accessExpiryDate = '2000-01-01' WHERE username = 'expired-admin'").run();
  assert.equal((await request("/login", { method: "POST", body: JSON.stringify({ username: "expired-admin", password: "pass123" }) })).status, 403);
});

test("password changes, deleted accounts and legacy tokens invalidate access", async () => {
  const { odpId } = seedBaseData();
  const token = await login();
  const legacy = jwt.sign({ id: odpId, role: "admin" }, process.env.JWT_SECRET);
  assert.equal((await request("/users", { headers: auth(legacy) })).status, 401);
  db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashPassword("replacement"), odpId);
  assert.equal((await request("/drugs", { headers: auth(token) })).status, 401);
  db.prepare("DELETE FROM users WHERE id = ?").run(odpId);
  assert.equal((await request("/drugs", { headers: auth(token) })).status, 401);
});

test("permissions use current database role, not an old admin token", async () => {
  seedBaseData();
  insertUser({ username: "review-admin", role: "admin" });
  const token = await login("review-admin");
  assert.equal((await request("/users", { headers: auth(token) })).status, 200);
  db.prepare("UPDATE users SET role = 'viewer' WHERE username = 'review-admin'").run();
  assert.equal((await request("/users", { headers: auth(token) })).status, 403);
  assert.equal((await request("/patients", { method: "POST", headers: auth(token), body: JSON.stringify({ hospitalId: 1, locationId: 1 }) })).status, 403);
});

test("location-scoped accounts cannot omit scope, cross locations or spoof a hospital", async () => {
  seedBaseData();
  const token = await login();
  restrictUser("odp");
  for (const endpoint of ["/drugs", "/patients", "/transactions/1", "/stock-checks", "/corrections"]) {
    assert.equal((await request(endpoint, { headers: auth(token) })).status, 403, endpoint);
    assert.equal((await request(`${endpoint}?hospitalId=2&locationId=2`, { headers: auth(token) })).status, 403, endpoint);
    assert.equal((await request(`${endpoint}?hospitalId=2&locationId=1`, { headers: auth(token) })).status, 403, endpoint);
    assert.equal((await request(`${endpoint}?hospitalId=1&locationId=1`, { headers: auth(token) })).status, 200, endpoint);
  }
  assert.equal((await request("/patients", { method: "POST", headers: auth(token), body: JSON.stringify({ hospitalId: 2, locationId: 2, patientName: "Dummy", hospitalNumber: "D1" }) })).status, 403);
  assert.equal((await request("/users", { headers: auth(token) })).status, 403);
  assert.equal((await request("/device-setup/devices", { headers: auth(token) })).status, 403);
});

test("hospital scope validates the actual location and unknown scopes fail closed", async () => {
  seedBaseData();
  const token = await login();
  restrictUser("odp", "HOSPITAL");
  assert.equal((await request("/drugs?hospitalId=1&locationId=2", { headers: auth(token) })).status, 403);
  assert.equal((await request("/drugs?hospitalId=1&locationId=1", { headers: auth(token) })).status, 200);
  restrictUser("odp", "INVALID");
  assert.equal((await request("/drugs?hospitalId=1&locationId=1", { headers: auth(token) })).status, 403);
});

test("pharmacy lists and record actions respect location scope", async () => {
  const { drugId } = seedBaseData();
  insertUser({ username: "pharmacy", role: "pharmacy" });
  restrictUser("pharmacy");
  const token = await login("pharmacy");
  db.prepare("DELETE FROM pharmacy_requests").run();
  const insert = db.prepare(`INSERT INTO pharmacy_requests (requisitionNumber, drugId, drugName, quantityRequested, requestedById, requestedByName, hospitalId, locationId, status)
    VALUES (?, ?, 'Fentanyl', 5, 'test-requester', 'Test Requester', ?, ?, 'REQUESTED')`);
  insert.run("ACCESS-OWN", drugId, 1, 1);
  const other = insert.run("ACCESS-OTHER", drugId, 2, 2).lastInsertRowid;
  for (const endpoint of ["/pharmacy-requests", "/pharmacy-requests/pending"]) {
    const rows = await (await request(endpoint, { headers: auth(token) })).json();
    assert.deepEqual(rows.map(row => row.requisitionNumber), ["ACCESS-OWN"]);
  }
  for (const action of ["approve", "reject", "complete"]) {
    assert.equal((await request(`/pharmacy-requests/${other}/${action}`, { method: "PUT", headers: auth(token), body: "{}" })).status, 403);
  }
});

test("correction cannot target another department by spoofing the request location", async () => {
  const { doctorId, nurseId, odpId, drugId } = seedBaseData();
  const token = await login();
  const saved = await createPatientUseTransaction({ token, drugId, administeredById: doctorId, witnessId: nurseId });
  assert.equal(saved.response.status, 201);
  db.prepare("UPDATE drug_transactions SET hospitalId = 2, locationId = 2 WHERE id = ?").run(saved.body.entry.id);
  restrictUser("odp");
  const response = await request("/corrections", { method: "POST", headers: auth(token), body: JSON.stringify({
    hospitalId: 1, locationId: 1, originalTransactionId: saved.body.entry.id,
    correctedById: odpId, checkedById: nurseId, correctionType: "entry_error", reason: "test", correctionText: "test"
  }) });
  assert.equal(response.status, 403);
});

test("expired or out-of-area signers cannot sign an otherwise authorised transaction", async () => {
  const { doctorId, nurseId, drugId } = seedBaseData();
  const token = await login();
  db.prepare("UPDATE users SET accessExpiryDate = '2000-01-01' WHERE id = ?").run(nurseId);
  assert.equal((await createPatientUseTransaction({ token, drugId, administeredById: doctorId, witnessId: nurseId })).response.status, 403);
  db.prepare("UPDATE users SET accessExpiryDate = NULL WHERE id = ?").run(nurseId);
  restrictUser("nurse");
  db.prepare("UPDATE users SET accessLocationIds = '2' WHERE id = ?").run(nurseId);
  assert.equal((await createPatientUseTransaction({ token, drugId, administeredById: doctorId, witnessId: nurseId })).response.status, 403);
});

test("public requests cannot read stock or enumerate device setup", async () => {
  for (const endpoint of ["/drugs", "/device-setup/devices", "/device-setup/hospitals", "/device-setup/locations?hospitalId=1"]) {
    assert.equal((await request(endpoint)).status, 401);
  }
});

beforeEach(() => {
  db.exec(`
    DELETE FROM audit;
    DELETE FROM corrections;
    DELETE FROM drug_transactions;
    DELETE FROM location_drug_stock;
    DELETE FROM drugs;
    DELETE FROM users;
  `);
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
});

test("doctor and surgeon accounts cannot log into the iPad workflow", async () => {
  seedBaseData();

  const doctorResponse = await request("/login", {
    method: "POST",
    body: JSON.stringify({
      username: "doctor",
      password: "pass123",
      hospitalId: 1,
      locationId: 1,
      locationName: "TH8",
    }),
  });
  const doctorBody = await doctorResponse.json();

  assert.equal(doctorResponse.status, 403);
  assert.match(doctorBody.message, /signatures only/i);

  const surgeonResponse = await request("/login", {
    method: "POST",
    body: JSON.stringify({
      username: "surgeon",
      password: "pass123",
      hospitalId: 1,
      locationId: 1,
      locationName: "TH8",
    }),
  });

  assert.equal(surgeonResponse.status, 403);
});

test("signature-only roles can still verify for drug administration signatures", async () => {
  seedBaseData();

  const response = await request("/checker/verify", {
    method: "POST",
    body: JSON.stringify({
      username: "doctor",
      password: "pass123",
      currentUserId: null,
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 200, body.message);
  assert.equal(body.role, "doctor");
});

test("doctor can sign as administering clinician and surgeon can sign as witness", async () => {
  const { doctorId, surgeonId, drugId } = seedBaseData();
  const token = await login();

  const { response, body } = await createPatientUseTransaction({
    token,
    drugId,
    administeredById: doctorId,
    witnessId: surgeonId,
  });

  assert.equal(response.status, 201, body.message);
  assert.equal(body.balance, 9);
});

test("patient use cannot take stock below zero", async () => {
  const { doctorId, nurseId, drugId } = seedBaseData();
  const token = await login();

  const { response, body } = await createPatientUseTransaction({
    token,
    drugId,
    administeredById: doctorId,
    witnessId: nurseId,
    ampoulesUsed: 11,
  });

  assert.equal(response.status, 400);
  assert.match(body.message, /not enough stock/i);
});

test("entry-error correction cannot reverse the same entry twice", async () => {
  const { doctorId, nurseId, odpId, drugId } = seedBaseData();
  const token = await login();
  const transaction = await createPatientUseTransaction({
    token,
    drugId,
    administeredById: doctorId,
    witnessId: nurseId,
  });

  assert.equal(transaction.response.status, 201, transaction.body.message);

  const correctionPayload = {
    originalTransactionId: transaction.body.entry.id,
    correctionType: "entry_error",
    reason: "Entered in error",
    correctionText: "Reversal test",
    hospitalId: 1,
    hospitalName: "Test Hospital",
    locationId: 1,
    locationName: "TH8",
    correctedById: odpId,
    checkedById: nurseId,
  };

  const firstResponse = await request("/corrections", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(correctionPayload),
  });
  const firstBody = await firstResponse.json();
  assert.equal(firstResponse.status, 201, firstBody.message);

  const secondResponse = await request("/corrections", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(correctionPayload),
  });
  const secondBody = await secondResponse.json();

  assert.equal(secondResponse.status, 400);
  assert.match(secondBody.message, /already been reversed/i);
});

test("patient bulk upload saves the list for the current location and date", async () => {
  seedBaseData();
  const token = await login();

  const response = await request("/patients/bulk", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      hospitalId: 1,
      hospitalName: "Test Hospital",
      locationId: 1,
      locationName: "TH8",
      patients: [
        {
          patientName: "Upload Patient",
          hospitalNumber: "UP-1",
          speciality: "Orthopaedics",
          procedure: "Knee arthroscopy",
          listDate: "2026-07-14",
        },
      ],
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 201, body.message);
  assert.equal(body.created, 1);

  const listResponse = await request(
    "/patients?hospitalId=1&locationId=1&listDate=2026-07-14",
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  const patients = await listResponse.json();

  assert.equal(listResponse.status, 200);
  assert.equal(patients.length, 1);
  assert.equal(patients[0].patientName, "Upload Patient");
});

test("pharmacy requisition verification rejects quantity mismatch", async () => {
  const { odpId, drugId } = seedBaseData();
  insertUser({
    username: "pharmacy",
    role: "pharmacy",
    fullName: "Phil Pharmacy",
  });
  const token = await login();
  const pharmacyToken = await login("pharmacy");

  const createResponse = await request("/pharmacy-requests", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      drugId,
      quantityRequested: 5,
      reason: "Routine top up",
      requestedById: odpId,
      requestedByName: "Olivia ODP",
      requestedByRole: "odp",
      hospitalId: 1,
      hospitalName: "Test Hospital",
      locationId: 1,
      locationName: "TH8",
    }),
  });
  const createBody = await createResponse.json();

  assert.equal(createResponse.status, 201, createBody.message);

  const approveResponse = await request(
    `/pharmacy-requests/${createBody.request.id}/approve`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${pharmacyToken}`,
      },
    }
  );
  const approveBody = await approveResponse.json();

  assert.equal(approveResponse.status, 200, approveBody.message);

  const verifyResponse = await request("/pharmacy-requests/verify-requisition", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      requisitionNumber: createBody.request.requisitionNumber,
      drugId,
      quantityReceived: 4,
      hospitalId: 1,
      locationId: 1,
    }),
  });
  const verifyBody = await verifyResponse.json();

  assert.equal(verifyResponse.status, 400);
  assert.match(verifyBody.message, /quantity mismatch/i);
});
