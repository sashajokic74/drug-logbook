import express from 'express';
import {randomUUID} from 'node:crypto';
import db from '../database.js';
import {verifyUser,hasLocationAccess} from '../auth.js';
import {clinicalCredentials} from '../clinicalCredentials.js';
import {transactionSubmission,rememberTransaction} from '../submissionKeys.js';
import {createSignatureHash} from '../signature.js';
import {batchStock,batchToday,stockSigner} from '../stockBatches.js';
const router=express.Router();
const fail=(status,message)=>Object.assign(new Error(message),{status});
const pharmacy=u=>['pharmacy','pharmacist'].includes(String(u?.role).toLowerCase());
const text=(body,key,title,{required=true,max=200}={})=>{if(typeof(body[key]??'')!=='string')throw fail(400,`${title} must be text.`);const value=(body[key]??'').trim();if((required&&!value)||value.length>max)throw fail(400,`${title} is required and must be no longer than ${max} characters.`);return value;};
const caseRow=id=>db.prepare('SELECT * FROM stock_custody WHERE id=?').get(id);
const visible=row=>({...row,events:db.prepare('SELECT * FROM stock_custody_events WHERE caseId=? ORDER BY sequence').all(row.id).map(e=>({...e,record:JSON.parse(e.record)}))});
function checkScope(req,row){if(!hasLocationAccess(req.user,row.hospitalId,row.locationId))throw fail(403,'This clinical area is not assigned to your account.');}
function invariant(batch){const held=db.prepare("SELECT COALESCE(SUM(quantity),0) n FROM stock_custody WHERE batchId=? AND status='HELD'").get(batch.id).n;const current=db.prepare('SELECT * FROM stock_batches WHERE id=?').get(batch.id);if(current.heldQuantity!==held||current.quantity<held||held<0)throw fail(409,'Stock hold balances do not reconcile. No changes saved.');}
function movement(req,row,batch,first,second,type,before,after,eventId){
 const time=new Date().toISOString(),record={caseId:row.id,eventId,batchNumber:batch.batchNumber,expiryDate:batch.expiryDate,quantity:row.quantity,stockBalanceBefore:before,stockBalanceAfter:after,type};
 db.prepare(`INSERT INTO drug_transactions(transactionType,hospitalId,hospitalName,locationId,locationName,drugId,drugName,ampoulesSupplied,ampoulesUsed,stockBalanceBefore,stockBalanceAfter,administeredById,administeredByName,administeredSignature,administeredRole,administeredSignedAt,administeredSignatureHash,witnessId,witnessName,witnessSignature,witnessRole,witnessSignedAt,witnessSignatureHash,createdByUserId,createdByUsername,notes,batchId,batchNumber,expiryDate,custodyCaseId) VALUES(?,?,?,?,?,?,?,0,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(type,row.hospitalId,row.hospitalName,row.locationId,row.locationName,row.drugId,row.drugName,row.quantity,before,after,first.id,first.fullName||first.username,first.username,first.role,time,createSignatureHash({record,userId:first.id,timestamp:time}),second.id,second.fullName||second.username,second.username,second.role,time,createSignatureHash({record,userId:second.id,timestamp:time}),req.user.id,req.user.username,`${type==='STOCK_RETURN'?'Returned to pharmacy':'Completed destruction recorded'} · ${row.reference} · ${row.id}`,batch.id,batch.batchNumber,batch.expiryDate,row.id);
}
router.use(verifyUser);
router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
router.get('/',(req,res)=>{
 try{const rows=db.prepare('SELECT * FROM stock_custody ORDER BY createdAt DESC,id DESC').all().filter(r=>hasLocationAccess(req.user,r.hospitalId,r.locationId)&&(!req.query.hospitalId||r.hospitalId===Number(req.query.hospitalId))&&(!req.query.locationId||r.locationId===Number(req.query.locationId))&&(!req.query.drugId||r.drugId===Number(req.query.drugId)));res.json({cases:rows.map(visible)});}catch(e){res.status(e.status||500).json({message:e.message});}
});
router.post('/',clinicalCredentials([['administeredById','administeredCredentials'],['witnessId','witnessCredentials']]),transactionSubmission,(req,res)=>{
 try{
  const b=req.body,action=b.action;if(!['hold','release','dispatch','receive','destroy','note','investigate','resolve'].includes(action))throw fail(400,'Choose an available stock custody action.');
  let row=action==='hold'?null:caseRow(String(b.caseId||''));if(action!=='hold'&&!row)throw fail(404,'Stock custody record not found.');
  const scope=row||{hospitalId:Number(b.hospitalId),locationId:Number(b.locationId),drugId:Number(b.drugId)};
  if(![scope.hospitalId,scope.locationId,scope.drugId].every(n=>Number.isSafeInteger(n)&&n>0))throw fail(400,'Select the clinical area and medicine.');
  if(row&&(Number(b.hospitalId)!==row.hospitalId||Number(b.locationId)!==row.locationId||Number(b.drugId)!==row.drugId))throw fail(403,'The signing area must match this custody record.');
  checkScope(req,scope);
  const first=db.prepare('SELECT * FROM users WHERE id=?').get(Number(b.administeredById)),second=db.prepare('SELECT * FROM users WHERE id=?').get(Number(b.witnessId));
  if(!first||!second||first.id===second.id)throw fail(400,'Two different staff must sign this event.');
  const pharmacyAction=['receive','destroy','investigate','resolve'].includes(action)||(action==='note'&&pharmacy(req.user)),allowed=pharmacyAction?pharmacy:u=>stockSigner(u.role);
  if(![req.user,first,second].every(allowed))throw fail(403,pharmacyAction?'Two pharmacy staff and a pharmacy session are required.':'Two authorised stock staff and a clinical session are required.');
  if(b.confirmed!==true)throw fail(400,'Confirm both staff checked the physical stock and event details.');
  const reason=text(b,'reason','Reason'),reference=text(b,'reference','Storage, handover or evidence reference'),note=text(b,'note','Note',{required:false,max:500});
  if(action==='note'&&!note)throw fail(400,'Enter the signed addendum or corrected information.');
  const evidence=action==='dispatch'?{destination:text(b,'destination','Receiving pharmacy / destination'),carrier:text(b,'carrier','Person / service taking custody'),seal:text(b,'seal','Package seal reference')}:action==='destroy'?{authorisationReference:text(b,'authorisationReference','Destruction authorisation reference'),witnessCapacity:text(b,'witnessCapacity','Witness authority / capacity'),method:text(b,'method','Destruction method'),completedAt:text(b,'completedAt','Date and time destruction was completed')}:{ };
  if(action==='destroy'&&(b.authorityConfirmed!==true||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(evidence.completedAt)||!Number.isFinite(Date.parse(evidence.completedAt))||Date.parse(evidence.completedAt)>Date.now()+60000||new Date(evidence.completedAt.slice(0,10)+'T00:00:00Z').toISOString().slice(0,10)!==evidence.completedAt.slice(0,10)))throw fail(400,'Record the actual completed time with timezone and confirm the witness authority was checked under local policy.');
  const investigationAction=['investigate','resolve'].includes(action);
  let investigationEvidence={};
  if(investigationAction){
   const incidentReference=text(b,'incidentReference','Incident / investigation reference');
   const findings=text(b,'findings','Investigation findings and evidence',{max:2000});
   investigationEvidence={incidentReference,findings};
   if(action==='investigate'){
    const ownerUsername=text(b,'ownerUsername','Investigation owner username');
    const owner=db.prepare('SELECT * FROM users WHERE username=?').get(ownerUsername);
    if(!owner||!pharmacy(owner)||Number(owner.active)!==1||!hasLocationAccess(owner,scope.hospitalId,scope.locationId)||
       (owner.staffType!=='Permanent'&&owner.expiryDate&&owner.expiryDate<batchToday()))throw fail(400,'Choose an active pharmacy investigation owner assigned to this area.');
    const dueDate=text(b,'dueDate','Next review date');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)||!Number.isFinite(Date.parse(dueDate+'T00:00:00Z'))||new Date(dueDate+'T00:00:00Z').toISOString().slice(0,10)!==dueDate||dueDate<batchToday())throw fail(400,'Choose a valid next review date, today or later.');
    investigationEvidence={...investigationEvidence,ownerId:owner.id,ownerUsername:owner.username,ownerName:owner.fullName||owner.username,dueDate};
   }else{
    if(b.reconciledConfirmed!==true||!Number.isSafeInteger(b.receivedQuantity)||b.receivedQuantity!==row.quantity)throw fail(400,'The independently confirmed pharmacy quantity must match the full handover quantity. Unaccounted stock must remain under investigation.');
    investigationEvidence={...investigationEvidence,reconciledConfirmed:true,receivedQuantity:b.receivedQuantity};
   }
  }
  const result=db.transaction(()=>{
   if(row){row=caseRow(row.id);if(row.version!==b.expectedCaseVersion)throw fail(409,'Custody record changed. Refresh before signing.');}
   const batch=db.prepare('SELECT * FROM stock_batches WHERE id=? AND hospitalId=? AND locationId=? AND drugId=?').get(row?.batchId||String(b.batchId||''),scope.hospitalId,scope.locationId,scope.drugId);
   if(!batch)throw fail(400,'Select a recorded stock batch. Check its packaging first if needed.');
   const stock=batchStock(scope.hospitalId,scope.locationId,scope.drugId),changesStock=action==='dispatch'||(action==='destroy'&&row?.status==='HELD'),needsBatch=['hold','release','dispatch'].includes(action)||(action==='destroy'&&row?.status==='HELD');
   if(needsBatch&&(b.expectedBatchVersion!==batch.version||b.expectedBalance!==stock.total))throw fail(409,'Stock changed. Refresh before signing.');
   let target;
   if(action==='hold'){
    if(!Number.isSafeInteger(b.quantity)||b.quantity<=0||b.quantity>batch.quantity-batch.heldQuantity)throw fail(400,'Enter a positive whole quantity no greater than the available batch stock.');
    const drug=db.prepare('SELECT name FROM drugs WHERE id=?').get(scope.drugId),location=db.prepare('SELECT hospitalName,locationName FROM location_drug_stock WHERE hospitalId=? AND locationId=? AND drugId=?').get(scope.hospitalId,scope.locationId,scope.drugId);
    const id=randomUUID();db.prepare("INSERT INTO stock_custody(id,hospitalId,hospitalName,locationId,locationName,drugId,drugName,batchId,batchNumber,expiryDate,quantity,status,reason,reference) VALUES(?,?,?,?,?,?,?,?,?,?,?,'HELD',?,?)").run(id,scope.hospitalId,location.hospitalName,scope.locationId,location.locationName,scope.drugId,drug.name,batch.id,batch.batchNumber,batch.expiryDate,b.quantity,reason,reference);
    db.prepare('UPDATE stock_batches SET heldQuantity=heldQuantity+?,version=version+1 WHERE id=?').run(b.quantity,batch.id);row=caseRow(id);target='HELD';
   }else{
    const expected={release:['HELD'],dispatch:['HELD'],receive:['IN_TRANSIT'],destroy:['HELD','PHARMACY_RECEIVED'],investigate:['RECEIPT_DISCREPANCY'],resolve:['RECEIPT_DISCREPANCY'],note:[row.status]}[action];
    if(!expected.includes(row.status))throw fail(409,'This custody action is no longer available. Refresh the record.');
    if(action==='resolve'&&!db.prepare("SELECT id FROM stock_custody_events WHERE caseId=? AND action='investigate'").get(row.id))throw fail(409,'Record the investigation owner, evidence and reference before resolving this discrepancy.');
    if(action==='release'&&batch.expiryDate<batchToday())throw fail(400,'Expired stock cannot be released for administration.');
    if(action==='receive'&&(!Number.isSafeInteger(b.receivedQuantity)||b.receivedQuantity<0||b.receivedQuantity>1000000))throw fail(400,'Enter the actual quantity counted by pharmacy, including zero.');
    if(action==='receive'&&b.receivedQuantity!==row.quantity&&!note)throw fail(400,'Explain the pharmacy receipt discrepancy.');
    target={investigate:row.status,resolve:'PHARMACY_RECEIVED',note:row.status,release:'RELEASED',dispatch:'IN_TRANSIT',receive:b.receivedQuantity===row.quantity?'PHARMACY_RECEIVED':'RECEIPT_DISCREPANCY',destroy:'DESTROYED'}[action];
    if(row.status==='HELD'&&action!=='note')db.prepare('UPDATE stock_batches SET heldQuantity=heldQuantity-?,quantity=quantity-?,version=version+1 WHERE id=? AND heldQuantity>=?').run(row.quantity,changesStock?row.quantity:0,batch.id,row.quantity);
    if(changesStock){if(stock.total<row.quantity)throw fail(409,'Physical stock is insufficient. No changes saved.');db.prepare('UPDATE location_drug_stock SET quantity=quantity-?,updatedAt=CURRENT_TIMESTAMP WHERE hospitalId=? AND locationId=? AND drugId=?').run(row.quantity,scope.hospitalId,scope.locationId,scope.drugId);}
    db.prepare('UPDATE stock_custody SET status=?,version=version+1,reference=?,receivedQuantity=CASE WHEN ? IN (\'receive\',\'resolve\') THEN ? ELSE receivedQuantity END,updatedAt=CURRENT_TIMESTAMP WHERE id=?').run(target,action==='note'?row.reference:reference,action,['receive','resolve'].includes(action)?b.receivedQuantity:null,row.id);
   }
   if(action==='destroy'){
    const lastPhysical=db.prepare("SELECT createdAt FROM stock_custody_events WHERE caseId=? AND action IN ('hold','receive','resolve') ORDER BY sequence DESC LIMIT 1").get(row.id);
    if(lastPhysical&&Date.parse(evidence.completedAt)<Math.floor(Date.parse(lastPhysical.createdAt)/60000)*60000)throw fail(400,'The completed destruction time cannot be before this stock was held or received by pharmacy.');
   }
   invariant(batch);
   const current=caseRow(row.id),id=randomUUID(),timestamp=new Date().toISOString(),record={caseId:row.id,hospitalId:row.hospitalId,hospitalName:row.hospitalName,locationId:row.locationId,locationName:row.locationName,drugId:row.drugId,drugName:row.drugName,batchId:batch.id,firstId:first.id,firstName:first.fullName||first.username,firstRole:first.role,secondId:second.id,secondName:second.fullName||second.username,secondRole:second.role,action,from:action==='hold'?null:row.status,to:target,quantity:row.quantity,batchNumber:batch.batchNumber,expiryDate:batch.expiryDate,reason,reference,note,...evidence,...investigationEvidence,...(action==='receive'?{receivedQuantity:b.receivedQuantity}:{}),stockBalanceBefore:stock.total,stockBalanceAfter:changesStock?stock.total-row.quantity:stock.total};
   db.prepare('INSERT INTO stock_custody_events(id,caseId,action,firstId,firstName,secondId,secondName,record,firstHash,secondHash,createdAt) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,row.id,action,first.id,first.fullName||first.username,second.id,second.fullName||second.username,JSON.stringify(record),createSignatureHash({record,userId:first.id,timestamp}),createSignatureHash({record,userId:second.id,timestamp}),timestamp);
   if(changesStock)movement(req,current,batch,first,second,action==='dispatch'?'STOCK_RETURN':'STOCK_DESTRUCTION',stock.total,stock.total-row.quantity,id);
   db.prepare('INSERT INTO audit(action,username,role) VALUES(?,?,?)').run(JSON.stringify({type:`stock-custody.${action}`,eventId:id,caseId:row.id,record}),req.user.username,req.user.role);
   const response={case:visible(current),stock:batchStock(scope.hospitalId,scope.locationId,scope.drugId)};rememberTransaction(req,response);return response;
  })();return res.status(201).json(result);
 }catch(e){return res.status(e.status||500).json({message:e.message});}
});
export default router;
