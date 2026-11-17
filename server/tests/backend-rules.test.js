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

function clinicalJSON(body){
 const signed={...body};
 for(const [id,key] of [['administeredById','administeredCredentials'],['witnessId','witnessCredentials'],['staffOneId','staffOneCredentials'],['staffTwoId','staffTwoCredentials'],['correctedById','correctedByCredentials'],['checkedById','checkedByCredentials'],['requestedById','requestedByCredentials']]){
  if(body[id]){const u=db.prepare('SELECT username FROM users WHERE id=?').get(Number(body[id]));if(u)signed[key]={username:u.username,password:'pass123'};}
 }
 if(body.administeredById){signed.operationId=body.operationId||crypto.randomUUID();const stock=db.prepare('SELECT quantity FROM location_drug_stock WHERE hospitalId=? AND locationId=? AND drugId=?').get(body.hospitalId,body.locationId,body.drugId);signed.expectedBalance=stock?.quantity??0;}
 if(Number(body.ampoulesUsed)>0&&!Object.hasOwn(body,'batchId')){signed.batchId='fixture-batch';signed.expectedBatchVersion=db.prepare("SELECT version FROM stock_batches WHERE id='fixture-batch'").get()?.version;}
 if(Number(body.ampoulesSupplied)>0){if(!Object.hasOwn(body,'batchNumber'))signed.batchNumber='TEST-SUPPLY';if(!Object.hasOwn(body,'expiryDate'))signed.expiryDate='2099-12-31';}
 return JSON.stringify(signed);
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
    body: clinicalJSON({
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

  db.prepare("INSERT INTO stock_batches(id,hospitalId,locationId,drugId,batchNumber,expiryDate,quantity,originalQuantity,source,firstId,secondId) VALUES('fixture-batch',1,1,?,'TEST','2099-12-31',10,10,'test-fixture',?,?)").run(drugId,odpId,nurseId);
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
    body: clinicalJSON({
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
    DELETE FROM stock_custody_events;
    DELETE FROM stock_custody;
    DELETE FROM pharmacy_requests;
    DELETE FROM stock_batches;
    DELETE FROM clinical_submissions;
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
    body: clinicalJSON({
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
    body: clinicalJSON({
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
    body: clinicalJSON({
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
    body: clinicalJSON(correctionPayload),
  });
  const firstBody = await firstResponse.json();
  assert.equal(firstResponse.status, 201, firstBody.message);
  assert.equal(db.prepare("SELECT quantity FROM stock_batches WHERE id='fixture-batch'").get().quantity,10);

  const secondResponse = await request("/corrections", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: clinicalJSON(correctionPayload),
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
    body: clinicalJSON({
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
    body: clinicalJSON({
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

  const dispatch=await request(`/pharmacy-requests/${createBody.request.id}/dispatch`,{method:'PUT',headers:{Authorization:`Bearer ${pharmacyToken}`},body:JSON.stringify({reference:'TEST-DELIVERY'})});assert.equal(dispatch.status,200);
  const verifyResponse = await request("/pharmacy-requests/verify-requisition", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: clinicalJSON({
      requisitionNumber: createBody.request.requisitionNumber,
      drugId,
      quantityReceived: 6,
      hospitalId: 1,
      locationId: 1,
    }),
  });
  const verifyBody = await verifyResponse.json();

  assert.equal(verifyResponse.status, 400);
  assert.match(verifyBody.message, /outstanding/i);
});

function clinicalBody(ids,extra={}){
 return {batchId:'fixture-batch',expectedBatchVersion:0,batchNumber:'TEST-SUPPLY',expiryDate:'2099-12-31',drugId:ids.drugId,patientName:'Fictional review patient',hospitalNumber:'DEMO-REVIEW',ampoulesSupplied:0,ampoulesUsed:1,amountAdministered:60,administeredUnit:'mcg',amountWasted:40,wastedUnit:'mcg',administeredById:ids.odpId,witnessId:ids.nurseId,hospitalId:1,hospitalName:'Test Hospital',locationId:1,locationName:'TH8',expectedBalance:10,operationId:crypto.randomUUID(),administeredCredentials:{username:'odp',password:'pass123'},witnessCredentials:{username:'nurse',password:'pass123'},...extra};
}
async function postClinical(token,body,path='/transactions'){
 const response=await request(path,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};
}
test('final save rejects forged identities, invalid passwords, inactive signers and out-of-area signers',async()=>{
 const ids=seedBaseData(),token=await login();
 let body=clinicalBody(ids);delete body.witnessCredentials;
 assert.equal((await postClinical(token,body)).status,403);
 assert.equal((await postClinical(token,clinicalBody(ids,{witnessCredentials:{username:'nurse',password:'wrong'}}))).status,403);
 db.prepare('UPDATE users SET active=0 WHERE id=?').run(ids.nurseId);
 assert.equal((await postClinical(token,clinicalBody(ids))).status,403);
 db.prepare("UPDATE users SET active=1,accessScope='LOCATIONS',accessLocationIds='99' WHERE id=?").run(ids.nurseId);
 assert.equal((await postClinical(token,clinicalBody(ids))).status,403);
 assert.equal(db.prepare('SELECT count(*) n FROM drug_transactions').get().n,0);
});
test('negative dose, fractional stock, stale balances and unaccounted waste cannot change stock',async()=>{
 const ids=seedBaseData(),token=await login();
 for(const change of [{amountAdministered:-10,amountWasted:110},{ampoulesUsed:0.5,amountAdministered:30,amountWasted:20},{amountWasted:30},{expectedBalance:9}]){
  const result=await postClinical(token,clinicalBody(ids,change));assert.ok([400,409].includes(result.status),JSON.stringify(result));
 }
 assert.equal(db.prepare('SELECT quantity FROM location_drug_stock WHERE drugId=?').get(ids.drugId).quantity,10);
});
test('authenticated retry returns its saved record once; changed retry conflicts; credentials never persist',async()=>{
 const ids=seedBaseData(),token=await login(),body=clinicalBody(ids);
 const first=await postClinical(token,body);assert.equal(first.status,201,JSON.stringify(first.data));
 const retry=await postClinical(token,body);assert.equal(retry.status,200);assert.equal(retry.data.entry.id,first.data.entry.id);
 assert.equal((await postClinical(token,{...body,notes:'Changed after saving'})).status,409);
 assert.equal(db.prepare('SELECT quantity FROM location_drug_stock WHERE drugId=?').get(ids.drugId).quantity,9);
 const saved=db.prepare('SELECT * FROM clinical_submissions WHERE operationId=?').get(body.operationId);
 assert.ok(!JSON.stringify(saved).includes('pass123'));assert.ok(first.data.entry.administeredSignatureHash.startsWith('v2:'));
});
test('receipt requires a dispatched matching request and closes it atomically with stock',async()=>{
 const ids=seedBaseData(),token=await login();
 const created=await request('/pharmacy-requests',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:clinicalJSON({drugId:ids.drugId,quantityRequested:3,reason:'Review',requestedById:ids.odpId,requestedByName:'Olivia ODP',requestedByRole:'odp',hospitalId:1,hospitalName:'Test Hospital',locationId:1,locationName:'TH8'})});
 const req=(await created.json()).request;assert.ok(req);
 const body=clinicalBody(ids,{ampoulesUsed:0,ampoulesSupplied:3,amountAdministered:0,amountWasted:0,administeredUnit:'',wastedUnit:'',requestId:req.id});
 assert.equal((await postClinical(token,body)).status,409);
 const early=await request(`/pharmacy-requests/${req.id}/complete`,{method:'PUT',headers:{Authorization:`Bearer ${token}`}});assert.equal(early.status,409);
 db.prepare("UPDATE pharmacy_requests SET status='DISPATCHED' WHERE id=?").run(req.id);
 const received=await postClinical(token,body);assert.equal(received.status,201,JSON.stringify(received.data));
 assert.equal(db.prepare('SELECT status FROM pharmacy_requests WHERE id=?').get(req.id).status,'COMPLETED');
 assert.equal(db.prepare('SELECT quantity FROM location_drug_stock WHERE drugId=?').get(ids.drugId).quantity,13);
 assert.equal((await postClinical(token,{...body,operationId:crypto.randomUUID(),expectedBalance:13})).status,409);
});
test('counts reject stale snapshots and require discrepancy notes without changing stock',async()=>{
 const ids=seedBaseData(),token=await login();
 const body={drugId:ids.drugId,checkType:'Daily CD Cupboard Check',actualBalance:9,expectedBalance:10,hospitalId:1,locationId:1,staffOneId:ids.odpId,staffTwoId:ids.nurseId,staffOneCredentials:{username:'odp',password:'pass123'},staffTwoCredentials:{username:'nurse',password:'pass123'},notes:''};
 assert.equal((await postClinical(token,body,'/stock-checks')).status,400);
 assert.equal((await postClinical(token,{...body,expectedBalance:11,notes:'Review discrepancy'},'/stock-checks')).status,409);
 assert.equal((await postClinical(token,{...body,notes:'Review discrepancy'},'/stock-checks')).status,201);
 assert.equal(db.prepare('SELECT quantity FROM location_drug_stock WHERE drugId=?').get(ids.drugId).quantity,10);
});

test('batch selection blocks unknown, expired and stale stock; successful use records and consumes its physical batch',async()=>{
 const ids=seedBaseData(),token=await login();
 for(const extra of [{batchId:''},{expectedBatchVersion:9}])assert.ok([400,409].includes((await postClinical(token,clinicalBody(ids,extra))).status));
 db.prepare("UPDATE stock_batches SET expiryDate='2000-01-01' WHERE id='fixture-batch'").run();
 assert.equal((await postClinical(token,clinicalBody(ids))).status,400);
 assert.equal(db.prepare("SELECT quantity FROM stock_batches WHERE id='fixture-batch'").get().quantity,10);
 db.prepare("UPDATE stock_batches SET expiryDate='2099-12-31' WHERE id='fixture-batch'").run();
 const result=await postClinical(token,clinicalBody(ids));assert.equal(result.status,201);assert.equal(result.data.entry.batchNumber,'TEST');assert.equal(result.data.entry.expiryDate,'2099-12-31');
 assert.equal(db.prepare("SELECT quantity FROM stock_batches WHERE id='fixture-batch'").get().quantity,9);
 assert.equal((await postClinical(token,clinicalBody(ids,{expectedBalance:9}))).status,409);
});
test('existing stock packaging requires two distinct staff and cannot add or double allocate stock',async()=>{
 const ids=seedBaseData(),token=await login();db.prepare('DELETE FROM stock_batches').run();
 const b=clinicalBody(ids,{quantity:6,expectedUnallocated:10,packagingChecked:true,batchNumber:'PACK-123',expiryDate:'2099-10-30'});
 assert.equal((await postClinical(token,{...b,witnessId:ids.odpId,witnessCredentials:b.administeredCredentials},'/stock-batches')).status,400);
 assert.equal((await postClinical(token,{...b,quantity:11},'/stock-batches')).status,409);
 const saved=await postClinical(token,b,'/stock-batches');assert.equal(saved.status,201,JSON.stringify(saved));assert.equal(saved.data.unallocated,4);assert.equal(saved.data.total,10);
 assert.equal((await postClinical(token,b,'/stock-batches')).status,200);
 assert.equal(db.prepare('SELECT count(*) n FROM stock_batches').get().n,1);
 assert.equal((await postClinical(token,{...b,operationId:crypto.randomUUID()},'/stock-batches')).status,409);
 assert.ok(!db.prepare('SELECT action FROM audit').all().some(r=>r.action.includes('pass123')));
});
test('expired packaging may be recorded accurately but never administered; invalid dates are rejected',async()=>{
 const ids=seedBaseData(),token=await login();db.prepare('DELETE FROM stock_batches').run();
 const b=clinicalBody(ids,{quantity:10,expectedUnallocated:10,packagingChecked:true,batchNumber:'OLD',expiryDate:'2000-01-01'});
 assert.equal((await postClinical(token,{...b,expiryDate:'2027-02-30'},'/stock-batches')).status,400);
 const saved=await postClinical(token,b,'/stock-batches');assert.equal(saved.status,201);
 assert.equal((await postClinical(token,clinicalBody(ids,{batchId:saved.data.batch.id}))).status,400);
 assert.equal(db.prepare('SELECT quantity FROM location_drug_stock').get().quantity,10);
});
test('receipt rejects missing or expired metadata atomically and replay creates only one batch',async()=>{
 const ids=seedBaseData(),token=await login();
 const r=await request('/pharmacy-requests',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:clinicalJSON({drugId:ids.drugId,quantityRequested:3,reason:'Review',requestedById:ids.odpId,hospitalId:1,locationId:1})});
 const req=(await r.json()).request;db.prepare("UPDATE pharmacy_requests SET status='DISPATCHED' WHERE id=?").run(req.id);
 const b=clinicalBody(ids,{ampoulesUsed:0,ampoulesSupplied:3,amountAdministered:0,amountWasted:0,requestId:req.id});
 for(const change of [{batchNumber:''},{expiryDate:'2000-01-01'}])assert.equal((await postClinical(token,{...b,...change})).status,400);
 assert.equal(db.prepare('SELECT quantity FROM location_drug_stock').get().quantity,10);assert.equal(db.prepare('SELECT status FROM pharmacy_requests WHERE id=?').get(req.id).status,'DISPATCHED');
 const saved=await postClinical(token,b);assert.equal(saved.status,201);assert.equal((await postClinical(token,b)).status,200);assert.equal(db.prepare('SELECT count(*) n FROM stock_batches').get().n,2);
});

test('reversing a consumed receipt cannot borrow from another batch and cross-area reversals are blocked',async()=>{
 const ids=seedBaseData(),token=await login();
 const created=await request('/pharmacy-requests',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:clinicalJSON({drugId:ids.drugId,quantityRequested:3,reason:'Review',requestedById:ids.odpId,hospitalId:1,locationId:1})});
 const req=(await created.json()).request;db.prepare("UPDATE pharmacy_requests SET status='DISPATCHED' WHERE id=?").run(req.id);
 const receipt=await postClinical(token,clinicalBody(ids,{ampoulesUsed:0,ampoulesSupplied:3,amountAdministered:0,amountWasted:0,requestId:req.id}));assert.equal(receipt.status,201);
 const use=await postClinical(token,clinicalBody(ids,{batchId:receipt.data.entry.batchId,expectedBalance:13}));assert.equal(use.status,201);
 const correction={originalTransactionId:receipt.data.entry.id,correctionType:'entry_error',reason:'Wrong receipt',correctionText:'Reverse',hospitalId:1,locationId:1,correctedById:ids.odpId,checkedById:ids.nurseId,correctedByCredentials:{username:'odp',password:'pass123'},checkedByCredentials:{username:'nurse',password:'pass123'}};
 assert.equal((await postClinical(token,{...correction,locationId:2},'/corrections')).status,403);
 assert.equal((await postClinical(token,correction,'/corrections')).status,409);
 assert.equal(db.prepare('SELECT quantity FROM location_drug_stock').get().quantity,12);
 assert.equal(db.prepare('SELECT count(*) n FROM corrections').get().n,0);
});

async function newSupplyRequest(ids,token,extra={}){
 return postClinical(token,{drugId:ids.drugId,hospitalId:1,hospitalName:'Test Hospital',locationId:1,locationName:'TH8',quantityRequested:3,reason:'Routine top up',requestedById:ids.odpId,requestedByName:'Olivia ODP',requestedByRole:'odp',requestedByCredentials:{username:'odp',password:'pass123'},operationId:crypto.randomUUID(),...extra},'/pharmacy-requests');
}
async function manageSupply(token,id,action,body={}){const r=await request(`/pharmacy-requests/${id}/${action}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
test('requests support one or two authenticated distinct staff, reject invalid second accounts, and retry once',async()=>{
 const ids=seedBaseData(),token=await login();
 const one=await newSupplyRequest(ids,token);assert.equal(one.status,201);assert.equal(one.data.request.requestCheckerId,null);
 const operationId=crypto.randomUUID(),extra={operationId,requestCheckerId:ids.nurseId,requestCheckerCredentials:{username:'nurse',password:'pass123'}};
 const two=await newSupplyRequest(ids,token,extra);assert.equal(two.status,201,JSON.stringify(two));assert.equal(two.data.request.requestCheckerName,'Nina Nurse');
 assert.equal((await newSupplyRequest(ids,token,extra)).status,200);assert.equal(db.prepare('SELECT count(*) n FROM pharmacy_requests').get().n,2);
 assert.equal((await newSupplyRequest(ids,token,{requestCheckerId:ids.odpId,requestCheckerCredentials:{username:'odp',password:'pass123'}})).status,400);
 assert.equal((await newSupplyRequest(ids,token,{requestCheckerId:ids.nurseId,requestCheckerCredentials:{username:'nurse',password:'wrong'}})).status,403);
 assert.equal((await newSupplyRequest(ids,token,{quantityRequested:1.5})).status,400);
 assert.ok(!db.prepare('SELECT action FROM audit').all().some(r=>r.action.includes('pass123')));
 assert.equal(db.prepare('SELECT quantity FROM location_drug_stock').get().quantity,10);
});
test('approval and dispatch are pharmacy-only stages; partial batch receipts and reversal preserve outstanding quantities',async()=>{
 const ids=seedBaseData(),token=await login();insertUser({username:'pharmacy',role:'pharmacy'});const pharmacy=await login('pharmacy');
 const created=await newSupplyRequest(ids,token);assert.equal(created.status,201);const id=created.data.request.id;
 assert.equal((await manageSupply(token,id,'approve')).status,403);
 assert.equal((await manageSupply(pharmacy,id,'dispatch')).status,409);
 const approved=await manageSupply(pharmacy,id,'approve');assert.equal(approved.status,200);assert.ok(approved.data.request.approvedAt);
 const receipt=clinicalBody(ids,{ampoulesUsed:0,ampoulesSupplied:1,amountAdministered:0,amountWasted:0,requestId:id});
 assert.equal((await postClinical(token,receipt)).status,409);
 assert.equal((await manageSupply(pharmacy,id,'dispatch',{reference:'DEMO-DISPATCH'})).status,200);
 assert.equal((await manageSupply(pharmacy,id,'dispatch')).status,409);
 assert.equal(db.prepare('SELECT quantity FROM location_drug_stock').get().quantity,10);
 const first=await postClinical(token,receipt);assert.equal(first.status,201);let req=db.prepare('SELECT * FROM pharmacy_requests WHERE id=?').get(id);assert.equal(req.status,'DISPATCHED');assert.equal(req.quantityReceived,1);
 const second=await postClinical(token,{...receipt,operationId:crypto.randomUUID(),expectedBalance:11,ampoulesSupplied:2,batchNumber:'SECOND-BATCH'});assert.equal(second.status,201,JSON.stringify(second));req=db.prepare('SELECT * FROM pharmacy_requests WHERE id=?').get(id);assert.equal(req.status,'COMPLETED');assert.equal(req.quantityReceived,3);
 const reversed=await postClinical(token,{originalTransactionId:second.data.entry.id,correctionType:'entry_error',reason:'Wrong batch label',correctionText:'Reverse unused receipt',hospitalId:1,locationId:1,correctedById:ids.odpId,checkedById:ids.nurseId,correctedByCredentials:{username:'odp',password:'pass123'},checkedByCredentials:{username:'nurse',password:'pass123'}},'/corrections');assert.equal(reversed.status,201,JSON.stringify(reversed));
 req=db.prepare('SELECT * FROM pharmacy_requests WHERE id=?').get(id);assert.equal(req.status,'DISPATCHED');assert.equal(req.quantityReceived,1);assert.equal(req.completedAt,null);assert.equal(db.prepare('SELECT quantity FROM location_drug_stock').get().quantity,11);
});
test('rejection requires a reason, retains the request reason and blocks subsequent dispatch',async()=>{
 const ids=seedBaseData(),token=await login();insertUser({username:'pharmacy',role:'pharmacy'});const pharmacy=await login('pharmacy');const created=await newSupplyRequest(ids,token);const id=created.data.request.id;
 assert.equal((await manageSupply(pharmacy,id,'reject')).status,400);
 const rejected=await manageSupply(pharmacy,id,'reject',{reason:'Duplicate request'});assert.equal(rejected.status,200);assert.equal(rejected.data.request.reason,'Routine top up');assert.equal(rejected.data.request.rejectionReason,'Duplicate request');assert.equal((await manageSupply(pharmacy,id,'dispatch')).status,409);
});

function custodyBody(ids,extra={}){return {hospitalId:1,locationId:1,drugId:ids.drugId,action:'hold',batchId:'fixture-batch',quantity:4,reason:'Stock returned for review',reference:'Cupboard quarantine tray / SEAL-1',confirmed:true,expectedBalance:10,expectedBatchVersion:0,administeredById:ids.odpId,witnessId:ids.nurseId,administeredCredentials:{username:'odp',password:'pass123'},witnessCredentials:{username:'nurse',password:'pass123'},operationId:crypto.randomUUID(),...extra};}
async function custodyPharmacy(){const firstId=insertUser({username:'custody-pharmacy-one',role:'pharmacy'}),secondId=insertUser({username:'custody-pharmacy-two',role:'pharmacist'});return {token:await login('custody-pharmacy-one'),credentials:{administeredById:firstId,witnessId:secondId,administeredCredentials:{username:'custody-pharmacy-one',password:'pass123'},witnessCredentials:{username:'custody-pharmacy-two',password:'pass123'}}};}
test('stock holds preserve physical counts, block held units from administration, and replay only once',async()=>{
 const ids=seedBaseData(),token=await login(),body=custodyBody(ids);const hold=await postClinical(token,body,'/stock-custody');assert.equal(hold.status,201,JSON.stringify(hold));assert.equal(hold.data.stock.total,10);assert.equal(hold.data.stock.held,4);assert.equal(hold.data.stock.batches[0].availableQuantity,6);assert.equal((await postClinical(token,body,'/stock-custody')).status,200);assert.equal(db.prepare('SELECT count(*) n FROM stock_custody').get().n,1);
 const blocked=await postClinical(token,clinicalBody(ids,{ampoulesUsed:7,amountAdministered:420,amountWasted:280,expectedBatchVersion:1}));assert.equal(blocked.status,400);assert.match(blocked.data.message,/held stock/i);
 const use=await postClinical(token,clinicalBody(ids,{expectedBatchVersion:1}));assert.equal(use.status,201);assert.equal(db.prepare('SELECT quantity FROM location_drug_stock').get().quantity,9);assert.equal(db.prepare('SELECT heldQuantity FROM stock_batches').get().heldQuantity,4);
});
test('signed return handover deducts once; pharmacy independently receives and records final destruction without double deduction',async()=>{
 const ids=seedBaseData(),token=await login(),p=await custodyPharmacy();const hold=await postClinical(token,custodyBody(ids),'/stock-custody');assert.equal(hold.status,201);const row=hold.data.case;
 const dispatch=custodyBody(ids,{action:'dispatch',caseId:row.id,expectedCaseVersion:0,expectedBatchVersion:1,destination:'Test pharmacy',carrier:'Demo porter',seal:'SEAL-1',reference:'RETURN-1'});const moved=await postClinical(token,dispatch,'/stock-custody');assert.equal(moved.status,201,JSON.stringify(moved));assert.equal(moved.data.stock.total,6);assert.equal(moved.data.case.status,'IN_TRANSIT');assert.equal((await postClinical(token,dispatch,'/stock-custody')).status,200);assert.equal(db.prepare("SELECT count(*) n FROM drug_transactions WHERE transactionType='STOCK_RETURN'").get().n,1);
 const movement=db.prepare("SELECT * FROM drug_transactions WHERE transactionType='STOCK_RETURN'").get();assert.equal(movement.batchNumber,'TEST');assert.equal(movement.custodyCaseId,row.id);assert.ok(movement.administeredSignatureHash.startsWith('v2:'));
 const received=await postClinical(p.token,custodyBody(ids,{...p.credentials,action:'receive',caseId:row.id,expectedCaseVersion:1,receivedQuantity:4,reference:'PHARM-RECEIPT-1'}),'/stock-custody');assert.equal(received.status,201,JSON.stringify(received));assert.equal(received.data.stock.total,6);assert.equal(received.data.case.status,'PHARMACY_RECEIVED');
 const destroyed=await postClinical(p.token,custodyBody(ids,{...p.credentials,action:'destroy',caseId:row.id,expectedCaseVersion:2,authorisationReference:'AUTH-TEST',witnessCapacity:'Locally authorised witness — fictional test',method:'Completed destruction evidence',completedAt:new Date().toISOString(),authorityConfirmed:true,reference:'DEST-1'}),'/stock-custody');assert.equal(destroyed.status,201,JSON.stringify(destroyed));assert.equal(destroyed.data.stock.total,6);assert.equal(destroyed.data.case.events.length,4);assert.equal(destroyed.data.case.status,'DESTROYED');assert.ok(destroyed.data.case.events.every(e=>e.firstHash.startsWith('v2:')&&e.secondHash.startsWith('v2:')));
});
test('hold release restores availability without adding stock; expired releases and stale events are blocked',async()=>{
 const ids=seedBaseData(),token=await login();const hold=await postClinical(token,custodyBody(ids),'/stock-custody');const row=hold.data.case;
 assert.equal((await postClinical(token,custodyBody(ids,{action:'release',caseId:row.id,expectedCaseVersion:1,expectedBatchVersion:1}),'/stock-custody')).status,409);
 const released=await postClinical(token,custodyBody(ids,{action:'release',caseId:row.id,expectedCaseVersion:0,expectedBatchVersion:1}),'/stock-custody');assert.equal(released.status,201);assert.equal(released.data.stock.total,10);assert.equal(released.data.stock.held,0);assert.equal(released.data.stock.batches[0].availableQuantity,10);
 db.prepare("UPDATE stock_batches SET expiryDate='2000-01-01' WHERE id='fixture-batch'").run();const old=await postClinical(token,custodyBody(ids,{expectedBatchVersion:2}),'/stock-custody');assert.equal(old.status,201);
 const release=await postClinical(token,custodyBody(ids,{action:'release',caseId:old.data.case.id,expectedCaseVersion:0,expectedBatchVersion:3}),'/stock-custody');assert.equal(release.status,400);assert.equal(db.prepare('SELECT quantity FROM location_drug_stock').get().quantity,10);
});
test('custody receipt discrepancies block disposition and do not silently change clinical stock',async()=>{
 const ids=seedBaseData(),token=await login(),p=await custodyPharmacy();const hold=await postClinical(token,custodyBody(ids),'/stock-custody'),id=hold.data.case.id;
 assert.equal((await postClinical(token,custodyBody(ids,{action:'dispatch',caseId:id,expectedCaseVersion:0,expectedBatchVersion:1,destination:'Pharmacy',carrier:'Porter',seal:'SEAL-1'}),'/stock-custody')).status,201);
 const receipt=custodyBody(ids,{...p.credentials,action:'receive',caseId:id,expectedCaseVersion:1,receivedQuantity:3,note:''});assert.equal((await postClinical(p.token,receipt,'/stock-custody')).status,400);
 const mismatch=await postClinical(p.token,{...receipt,note:'One stock unit missing at physical receipt'},'/stock-custody');assert.equal(mismatch.status,201);assert.equal(mismatch.data.case.status,'RECEIPT_DISCREPANCY');assert.equal(mismatch.data.stock.total,6);
 const destroy=await postClinical(p.token,custodyBody(ids,{...p.credentials,action:'destroy',caseId:id,expectedCaseVersion:2,authorisationReference:'AUTH',witnessCapacity:'Test witness',method:'Evidence only',completedAt:new Date().toISOString(),authorityConfirmed:true}),'/stock-custody');assert.equal(destroy.status,409);
});
test('receipt investigations preserve original counts and require assigned pharmacy ownership and two signed reconciliation checks',async()=>{
 const ids=seedBaseData(),token=await login(),p=await custodyPharmacy();
 const hold=await postClinical(token,custodyBody(ids),'/stock-custody'),id=hold.data.case.id;
 await postClinical(token,custodyBody(ids,{action:'dispatch',caseId:id,expectedCaseVersion:0,expectedBatchVersion:1,destination:'Pharmacy',carrier:'Porter',seal:'TEST-SEAL'}),'/stock-custody');
 await postClinical(p.token,custodyBody(ids,{...p.credentials,action:'receive',caseId:id,expectedCaseVersion:1,receivedQuantity:3,note:'One unit not accounted for'}),'/stock-custody');
 const original=db.prepare('SELECT * FROM stock_custody_events WHERE caseId=? ORDER BY sequence').all(id);
 const investigate=custodyBody(ids,{...p.credentials,action:'investigate',caseId:id,expectedCaseVersion:2,incidentReference:'FICTIONAL-INCIDENT',findings:'Seal, handover and package checked; review scheduled.',ownerUsername:'custody-pharmacy-one',dueDate:'2099-01-01'});
 const resolve={...investigate,action:'resolve',receivedQuantity:4,reconciledConfirmed:true,findings:'Fourth unit located in sealed secondary pouch; both staff recounted.'};
 assert.equal((await postClinical(p.token,resolve,'/stock-custody')).status,409);
 for(const change of [{ownerUsername:'nurse'},{ownerUsername:'unknown'},{dueDate:'2026-02-30'},{findings:''}])assert.equal((await postClinical(p.token,{...investigate,...change,operationId:crypto.randomUUID()},'/stock-custody')).status,400);
 assert.equal((await postClinical(token,{...investigate,administeredById:ids.odpId,witnessId:ids.nurseId,administeredCredentials:{username:'odp',password:'pass123'},witnessCredentials:{username:'nurse',password:'pass123'}},'/stock-custody')).status,403);
 const assigned=await postClinical(p.token,investigate,'/stock-custody');assert.equal(assigned.status,201,JSON.stringify(assigned));assert.equal(assigned.data.case.status,'RECEIPT_DISCREPANCY');assert.equal(assigned.data.case.receivedQuantity,3);assert.equal(assigned.data.stock.total,6);
 const current={...resolve,expectedCaseVersion:3,operationId:crypto.randomUUID()};
 assert.equal((await postClinical(p.token,{...current,receivedQuantity:3},'/stock-custody')).status,400);
 assert.equal((await postClinical(p.token,{...current,reconciledConfirmed:false},'/stock-custody')).status,400);
 assert.equal((await postClinical(p.token,{...current,expectedCaseVersion:2},'/stock-custody')).status,409);
 const done=await postClinical(p.token,current,'/stock-custody');assert.equal(done.status,201,JSON.stringify(done));assert.equal(done.data.case.status,'PHARMACY_RECEIVED');assert.equal(done.data.case.receivedQuantity,4);assert.equal(done.data.stock.total,6);assert.equal(done.data.stock.held,0);
 assert.deepEqual(db.prepare('SELECT * FROM stock_custody_events WHERE caseId=? ORDER BY sequence LIMIT 3').all(id),original);
 const replay=await postClinical(p.token,current,'/stock-custody');assert.equal(replay.status,200);assert.equal(replay.data.case.events.length,5);
 assert.equal((await postClinical(p.token,{...current,operationId:crypto.randomUUID(),expectedCaseVersion:4},'/stock-custody')).status,409);
 assert.ok(!JSON.stringify(db.prepare('SELECT * FROM stock_custody_events WHERE caseId=?').all(id)).includes('pass123'));
});
test('custody enforces scope, two real signers, role separation and destruction evidence; no passwords persist',async()=>{
 const ids=seedBaseData(),token=await login(),p=await custodyPharmacy();
 for(const extra of [{confirmed:false},{reason:{}},{quantity:11},{witnessId:ids.odpId,witnessCredentials:{username:'odp',password:'pass123'}},{witnessCredentials:{username:'nurse',password:'wrong'}}])assert.ok([400,403].includes((await postClinical(token,custodyBody(ids,extra),'/stock-custody')).status));
 const hold=await postClinical(token,custodyBody(ids),'/stock-custody');assert.equal(hold.status,201);
 const base=custodyBody(ids,{...p.credentials,action:'destroy',caseId:hold.data.case.id,expectedCaseVersion:0,expectedBatchVersion:1,authorisationReference:'AUTH',witnessCapacity:'Test authority',method:'Fictional evidence',completedAt:new Date().toISOString(),authorityConfirmed:true});
 assert.equal((await postClinical(token,{...base,administeredById:ids.odpId,witnessId:ids.nurseId,administeredCredentials:{username:'odp',password:'pass123'},witnessCredentials:{username:'nurse',password:'pass123'}},'/stock-custody')).status,403);
 assert.equal((await postClinical(p.token,{...base,locationId:99},'/stock-custody')).status,403);
 assert.equal((await postClinical(p.token,{...base,authorityConfirmed:false},'/stock-custody')).status,400);
 assert.equal((await postClinical(p.token,{...base,completedAt:new Date(Date.now()+3600000).toISOString()},'/stock-custody')).status,400);
 assert.equal((await postClinical(p.token,{...base,completedAt:'2000-01-01T00:00:00Z'},'/stock-custody')).status,400);
 const destroyed=await postClinical(p.token,base,'/stock-custody');assert.equal(destroyed.status,201,JSON.stringify(destroyed));assert.equal(destroyed.data.stock.total,6);assert.equal(destroyed.data.stock.held,0);assert.equal(db.prepare("SELECT count(*) n FROM drug_transactions WHERE transactionType='STOCK_DESTRUCTION'").get().n,1);
 assert.ok(!JSON.stringify(db.prepare('SELECT * FROM stock_custody_events').all()).includes('pass123'));assert.ok(!JSON.stringify(db.prepare('SELECT * FROM clinical_submissions').all()).includes('pass123'));
});

test('signed custody addenda preserve earlier evidence, do not release holds, and respect current area access',async()=>{
 const ids=seedBaseData(),token=await login();const hold=await postClinical(token,custodyBody(ids),'/stock-custody');const first=db.prepare('SELECT * FROM stock_custody_events').get();
 const note=await postClinical(token,custodyBody(ids,{action:'note',caseId:hold.data.case.id,expectedCaseVersion:0,reason:'Correction of storage reference',reference:first.id,note:'Seal label clarified: DEMO-SEAL-2'}),'/stock-custody');assert.equal(note.status,201,JSON.stringify(note));assert.equal(note.data.case.status,'HELD');assert.equal(note.data.stock.total,10);assert.equal(note.data.stock.held,4);assert.equal(note.data.case.events.length,2);assert.deepEqual(db.prepare('SELECT * FROM stock_custody_events WHERE id=?').get(first.id),first);
 db.prepare("UPDATE users SET accessScope='LOCATIONS',accessLocationIds='99' WHERE id=?").run(ids.odpId);
 const read=await request('/stock-custody',{headers:{Authorization:`Bearer ${token}`}});assert.equal(read.status,200);assert.deepEqual((await read.json()).cases,[]);
 assert.equal((await postClinical(token,custodyBody(ids,{action:'release',caseId:hold.data.case.id,expectedCaseVersion:1,expectedBatchVersion:1}),'/stock-custody')).status,403);
});
