import {randomUUID} from 'node:crypto';
import db from './database.js';
const fail=(status,message)=>Object.assign(new Error(message),{status});
export const batchToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function batchMetadata(batchNumber,expiryDate,{incoming=false}={}){
 if(typeof batchNumber!=='string'||!batchNumber.trim()||batchNumber.length>100||typeof expiryDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)||!Number.isFinite(Date.parse(expiryDate))||new Date(expiryDate).toISOString().slice(0,10)!==expiryDate)throw fail(400,'Enter the batch number and valid expiry date from the packaging.');
 if(incoming&&expiryDate<batchToday())throw fail(400,'Expired stock cannot be received as a new pharmacy supply.');
 return {batchNumber:batchNumber.trim(),expiryDate};
}
export function batchStock(hospitalId,locationId,drugId){
 const batches=db.prepare('SELECT * FROM stock_batches WHERE hospitalId=? AND locationId=? AND drugId=? ORDER BY expiryDate,id').all(Number(hospitalId),Number(locationId),Number(drugId));
 const total=Number(db.prepare('SELECT quantity FROM location_drug_stock WHERE hospitalId=? AND locationId=? AND drugId=?').get(Number(hospitalId),Number(locationId),Number(drugId))?.quantity||0);
 return {batches:batches.map(b=>({...b,availableQuantity:b.quantity-b.heldQuantity})),held:batches.reduce((n,b)=>n+b.heldQuantity,0),total,unallocated:total-batches.reduce((n,b)=>n+b.quantity,0),today:batchToday()};
}
export function insertBatch({id=randomUUID(),hospitalId,locationId,drugId,batchNumber,expiryDate,quantity,source,firstId,secondId,transactionId=null}){
 db.prepare('INSERT INTO stock_batches(id,hospitalId,locationId,drugId,batchNumber,expiryDate,quantity,originalQuantity,source,firstId,secondId,transactionId) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,Number(hospitalId),Number(locationId),Number(drugId),batchNumber,expiryDate,quantity,quantity,source,Number(firstId),Number(secondId),transactionId);
 return db.prepare('SELECT * FROM stock_batches WHERE id=?').get(id);
}
export function patientBatch(body,used){
 const batch=db.prepare('SELECT * FROM stock_batches WHERE id=? AND hospitalId=? AND locationId=? AND drugId=?').get(String(body.batchId||''),Number(body.hospitalId),Number(body.locationId),Number(body.drugId));
 if(!batch)throw fail(400,'Select the physical batch used. Record existing stock batch and expiry details first if needed.');
 if(batch.expiryDate<batchToday())throw fail(400,'This batch is expired and cannot be administered.');
 if(batch.quantity-batch.heldQuantity<used)throw fail(400,'Insufficient available stock in this batch. Held stock cannot be administered.');
 if(body.expectedBatchVersion!==batch.version)throw fail(409,'Batch stock changed. Refresh the register before signing.');
 return batch;
}
export function consumeBatch(batch,used){
 if(batch.expiryDate<batchToday())throw fail(409,'The selected batch has expired. No entry was saved.');
 const changed=db.prepare('UPDATE stock_batches SET quantity=quantity-?,version=version+1 WHERE id=? AND version=? AND quantity-heldQuantity>=?').run(used,batch.id,batch.version,used);
 if(changed.changes!==1)throw fail(409,'Batch stock changed. Refresh before signing.');
}
export function reverseBatch(original,adjustment,after){
 if(original.batchId){
  const batch=db.prepare('SELECT * FROM stock_batches WHERE id=?').get(original.batchId);
  if(!batch||batch.quantity+adjustment<batch.heldQuantity)throw fail(409,'The original receipt batch has already been used or held. It cannot be reversed using other batches.');
  db.prepare('UPDATE stock_batches SET quantity=quantity+?,version=version+1 WHERE id=?').run(adjustment,batch.id);
 }
 const assigned=Number(db.prepare('SELECT COALESCE(SUM(quantity),0) AS quantity FROM stock_batches WHERE hospitalId=? AND locationId=? AND drugId=?').get(original.hospitalId,original.locationId,original.drugId).quantity);
 if(assigned>after)throw fail(409,'This legacy reversal would conflict with recorded batch stock. Review the original batch details.');
}
export const stockSigner=role=>{
 const r=String(role||'').toLowerCase();return r!=='admin'&&!r.includes('doctor')&&!r.includes('surgeon')&&!r.includes('anaesthetist')&&/odp|anaesthetic|theatre|nurse/.test(r);
};
