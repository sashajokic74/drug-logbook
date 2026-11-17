import express from "express";
import db from "../database.js";

import {createSignatureHash} from '../signature.js';
import {hasLocationAccess} from '../auth.js';
import {transactionSubmission,rememberTransaction} from '../submissionKeys.js';
import {clinicalCredentials} from '../clinicalCredentials.js';
const router = express.Router();

function makeRequisitionNumber() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const random = Math.floor(100000 + Math.random() * 900000);
  return `CD-${date}-${random}`;
}

function isAuthorisedRequester(roleValue) {
  const role = String(roleValue || "").toLowerCase();

  if (
    role === "admin" ||
    role === "doctor" ||
    role === "dr" ||
    role.startsWith("dr ") ||
    role.includes(" doctor") ||
    role.includes("surgeon") ||
    role.includes("anaesthetist")
  ) {
    return false;
  }

  return (
    role.includes("odp") ||
    role.includes("anaesthetic") ||
    role.includes("anaesthetics") ||
    role.includes("nurse") ||
    role.includes("theatre")
  );
}

function canManagePharmacyRequests(roleValue) {
  const role = String(roleValue || "").toLowerCase();
  return role === "pharmacy" || role === "pharmacist";
}

router.post("/", clinicalCredentials([['requestedById','requestedByCredentials']]), (req,res,next)=>req.body.requestCheckerId?clinicalCredentials([['requestCheckerId','requestCheckerCredentials']])(req,res,next):next(), (req,res,next)=>req.body.operationId?transactionSubmission(req,res,next):next(), (req, res) => {
  try {
    const {
      drugId,
      quantityRequested,
      reason,
      requestedById,
      requestedByName,
      requestedByRole,
      hospitalId,
      hospitalName,
      locationId,
      locationName,
    } = req.body;

    if (!drugId || !Number.isSafeInteger(quantityRequested) || quantityRequested<=0 || quantityRequested>1000000) {
      return res.status(400).json({
        message: "Drug and quantity requested are required",
      });
    }

    if (!hospitalId || !locationId) {
      return res.status(400).json({
        message: "Device hospital and location are required before sending pharmacy request",
      });
    }

    if (!requestedById || !requestedByName || !requestedByRole) {
      return res.status(400).json({
        message: "Verified authorised staff is required",
      });
    }

    if (!isAuthorisedRequester(requestedByRole)) {
      return res.status(403).json({
        message:
          "Only ODP, anaesthetic practitioner, theatre practitioner or nurse can request controlled drug pharmacy supply.",
      });
    }

    const drug = db
      .prepare(
        "SELECT id, name, size, concentration, quantity FROM drugs WHERE id = ?"
      )
      .get(drugId);

    if (!drug) {
      return res.status(404).json({
        message: "Drug not found",
      });
    }

    if(!hasLocationAccess(req.user,hospitalId,locationId))return res.status(403).json({message:'This clinical area is not assigned to your account.'});
    let checker=null;
    if(req.body.requestCheckerId){
      checker=db.prepare('SELECT * FROM users WHERE id=?').get(Number(req.body.requestCheckerId));
      if(!checker||checker.id===Number(requestedById)||!isAuthorisedRequester(checker.role))return res.status(400).json({message:'Use a different authorised stock staff member as request checker.'});
    }
    const createRequest=db.transaction(()=>{
    const requisitionNumber = makeRequisitionNumber();

    const insert = db.prepare(`
      INSERT INTO pharmacy_requests (
        requisitionNumber,
        drugId,
        drugName,
        quantityRequested,
        reason,
        requestedById,
        requestedByName,
        requestedByRole,
        hospitalId,
        hospitalName,
        locationId,
        locationName,
        status,
        createdAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const info = insert.run(
      requisitionNumber,
      drug.id,
      drug.name,
      Number(quantityRequested),
      reason || "Routine top up",
      requestedById,
      requestedByName,
      requestedByRole,
      hospitalId || null,
      hospitalName || "",
      locationId || null,
      locationName || "",
      "REQUESTED"
    );

    const request = db
      .prepare("SELECT * FROM pharmacy_requests WHERE id = ?")
      .get(info.lastInsertRowid);

    if(checker){db.prepare('UPDATE pharmacy_requests SET requestCheckerId=?,requestCheckerName=? WHERE id=?').run(checker.id,checker.fullName||checker.username,request.id);request.requestCheckerId=checker.id;request.requestCheckerName=checker.fullName||checker.username;}
    const timestamp=new Date().toISOString();const record={request,timestamp};
    db.prepare('INSERT INTO audit(action,username,role) VALUES(?,?,?)').run(JSON.stringify({type:'pharmacy.request',record,requestedSignature:createSignatureHash({record,userId:Number(requestedById),timestamp}),...(checker?{checkedSignature:createSignatureHash({record,userId:checker.id,timestamp})}:{})}),req.user.username,req.user.role);
    const response={message:'Pharmacy request created',request};if(req.submission)rememberTransaction(req,response);return response;
    });
    return res.status(201).json(createRequest());
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
});

router.get("/", (req, res) => {
  try {
    const { hospitalId, locationId, status } = req.query;
    const params = [];
    let sql = `
      SELECT *
      FROM pharmacy_requests
      WHERE 1 = 1
    `;

    if (hospitalId) {
      sql += " AND (hospitalId = ? OR hospitalId IS NULL OR hospitalId = '')";
      params.push(Number(hospitalId));
    }

    if (locationId) {
      sql += " AND (locationId = ? OR locationId IS NULL OR locationId = '')";
      params.push(Number(locationId));
    }

    if (status && status !== "ALL") {
      sql += " AND upper(status) = ?";
      params.push(String(status).toUpperCase());
    }

    sql += " ORDER BY createdAt DESC";

    const requests = db.prepare(sql).all(...params);

    return res.json(requests.filter(r=>hasLocationAccess(req.user,r.hospitalId,r.locationId)));
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
});

router.get("/pending", (req, res) => {
  try {
    const requests = db
      .prepare(`
        SELECT *
        FROM pharmacy_requests
        WHERE status = 'REQUESTED'
        ORDER BY createdAt ASC
      `)
      .all();

    return res.json(requests.filter(r=>hasLocationAccess(req.user,r.hospitalId,r.locationId)));
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
});

for(const [action,expected,nextStatus] of [['approve','REQUESTED','APPROVED'],['dispatch','APPROVED','DISPATCHED'],['reject','REQUESTED','REJECTED']]){
 router.put(`/:id/${action}`,(req,res)=>{
  if(!canManagePharmacyRequests(req.user?.role))return res.status(403).json({message:'Only pharmacy staff can manage requests.'});
  const request=db.prepare('SELECT * FROM pharmacy_requests WHERE id=?').get(Number(req.params.id));
  if(!request)return res.status(404).json({message:'Pharmacy request not found.'});
  if(!hasLocationAccess(req.user,request.hospitalId,request.locationId))return res.status(403).json({message:'This clinical area is not assigned to your account.'});
  if(request.status!==expected)return res.status(409).json({message:`Request changed. Refresh before ${action}. Current status: ${request.status}`});
  const note=String(req.body?.reason||req.body?.reference||'').trim();
  if(action==='reject'&&!note)return res.status(400).json({message:'Enter a rejection reason.'});
  if(note.length>200)return res.status(400).json({message:'Keep the reference or reason under 200 characters.'});
  const save=db.transaction(()=>{
   const change=action==='approve'?db.prepare("UPDATE pharmacy_requests SET status='APPROVED',approvedAt=datetime('now'),approvedBy=? WHERE id=? AND status=?").run(req.user.fullName||req.user.username,request.id,expected):action==='dispatch'?db.prepare("UPDATE pharmacy_requests SET status='DISPATCHED',dispatchedAt=datetime('now'),dispatchedBy=?,dispatchReference=? WHERE id=? AND status=?").run(req.user.fullName||req.user.username,note,request.id,expected):db.prepare("UPDATE pharmacy_requests SET status='REJECTED',rejectionReason=? WHERE id=? AND status=?").run(note,request.id,expected);
   if(change.changes!==1)throw new Error('Request changed. Refresh before retrying.');
   db.prepare('INSERT INTO audit(action,username,role) VALUES(?,?,?)').run(JSON.stringify({type:`pharmacy.${action}`,requestId:request.id,from:expected,to:nextStatus,note}),req.user.username,req.user.role);
   return db.prepare('SELECT * FROM pharmacy_requests WHERE id=?').get(request.id);
  });
  try{return res.json({message:`Request ${nextStatus.toLowerCase()}`,request:save()});}catch(e){return res.status(409).json({message:e.message});}
 });
}

router.post("/verify-requisition", (req, res) => {
  try {
    const { requisitionNumber, drugId, quantityReceived, hospitalId, locationId } = req.body;

    if (!requisitionNumber) {
      return res.status(400).json({
        message: "Requisition number is required",
      });
    }

    if (!drugId) {
      return res.status(400).json({
        message: "Drug ID is required",
      });
    }

    if (!quantityReceived || Number(quantityReceived) <= 0) {
      return res.status(400).json({
        message: "Quantity received is required",
      });
    }

    const request = db
      .prepare("SELECT * FROM pharmacy_requests WHERE requisitionNumber = ?")
      .get(requisitionNumber);

    if (!request) {
      return res.status(404).json({
        message: "Requisition number not found",
      });
    }

    if (!request.hospitalId || !request.locationId) {
      return res.status(400).json({
        message:
          "Requisition cannot be received because hospital/location was not captured. Create a new pharmacy request from the correct location.",
      });
    }

    if (Number(request.drugId) !== Number(drugId)) {
      return res.status(400).json({
        message: "Requisition number does not match this drug",
      });
    }

    if (
      hospitalId &&
      request.hospitalId &&
      Number(request.hospitalId) !== Number(hospitalId)
    ) {
      return res.status(400).json({
        message: "Requisition number does not match this hospital",
      });
    }

    if (
      locationId &&
      request.locationId &&
      Number(request.locationId) !== Number(locationId)
    ) {
      return res.status(400).json({
        message: "Requisition number does not match this location",
      });
    }

    if (request.status !== "DISPATCHED") {
      return res.status(400).json({
        message: `Requisition cannot be received until Pharmacy marks it dispatched. Current status: ${request.status}`,
      });
    }

    if (!Number.isSafeInteger(Number(quantityReceived)) || Number(quantityReceived)<=0 || Number(quantityReceived)>Number(request.quantityRequested)-Number(request.quantityReceived||0)) {
      return res.status(400).json({
        message: `Quantity exceeds outstanding stock: ${Number(request.quantityRequested)-Number(request.quantityReceived||0)} remaining.`,
      });
    }

    return res.status(200).json({
      message: "Requisition verified",
      request,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
});

router.put("/:id/complete", (req, res) => {
  try {
    const { id } = req.params;

    const request = db
      .prepare("SELECT * FROM pharmacy_requests WHERE id = ?")
      .get(id);

    if (!request) {
      return res.status(404).json({
        message: "Pharmacy request not found",
      });
    }

    if(request.status!=='COMPLETED')return res.status(409).json({message:'Complete the signed stock receipt to close this requisition.'});
    return res.json({message:'Pharmacy request completed',request});

  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
});

export default router;
