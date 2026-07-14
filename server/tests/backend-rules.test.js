import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import bcrypt from "bcrypt";

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
    server.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
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
  const token = await login();

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
