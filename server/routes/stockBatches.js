import express from 'express';
import db from '../database.js';
import {verifyUser,hasLocationAccess} from '../auth.js';
import {clinicalCredentials} from '../clinicalCredentials.js';
import {transactionSubmission,rememberTransaction} from '../submissionKeys.js';
import {createSignatureHash} from '../signature.js';
import {batchStock,batchMetadata,insertBatch,stockSigner} from '../stockBatches.js';
const router=express.Router();
router.use(verifyUser);
router.get('/',(req,res)=>{
 const {hospitalId,locationId,drugId}=req.query;
 if(![hospitalId,locationId,drugId].every(v=>Number.isSafeInteger(Number(v))&&Number(v)>0))return res.status(400).json({message:'Select the hospital, location and drug.'});
 if(!hasLocationAccess(req.user,hospitalId,locationId))return res.status(403).json({message:'This clinical area is not assigned to your account.'});
 return res.json(batchStock(hospitalId,locationId,drugId));
});
router.post('/',clinicalCredentials([['administeredById','administeredCredentials'],['witnessId','witnessCredentials']]),transactionSubmission,(req,res)=>{
 try{
  const b=req.body;
  if(!hasLocationAccess(req.user,b.hospitalId,b.locationId)||!stockSigner(req.user.role))return res.status(403).json({message:'An authorised stock nurse or practitioner assigned to this clinical area is required.'});
  const first=db.prepare('SELECT * FROM users WHERE id=?').get(Number(b.administeredById)),second=db.prepare('SELECT * FROM users WHERE id=?').get(Number(b.witnessId));
  if(!first||!second||first.id===second.id||![first,second].every(u=>stockSigner(u.role)))return res.status(400).json({message:'Two different authorised stock staff must verify the packaging details.'});
  if(!Number.isSafeInteger(b.quantity)||b.quantity<=0||b.quantity>1000000||b.packagingChecked!==true)return res.status(400).json({message:'Check the packaging and enter a positive whole stock quantity.'});
  const details=batchMetadata(b.batchNumber,b.expiryDate);
  const result=db.transaction(()=>{
   const stock=batchStock(b.hospitalId,b.locationId,b.drugId);
   if(stock.total!==b.expectedBalance||stock.unallocated!==b.expectedUnallocated||b.quantity>stock.unallocated)throw Object.assign(new Error('Existing stock changed or this quantity is already assigned. Refresh before checking.'),{status:409});
   const batch=insertBatch({hospitalId:b.hospitalId,locationId:b.locationId,drugId:b.drugId,quantity:b.quantity,...details,source:'existing-stock',firstId:first.id,secondId:second.id});
   const signedAt=new Date().toISOString(),record={...batch,balanceUnchanged:stock.total};
   db.prepare('INSERT INTO audit(action,username,role) VALUES(?,?,?)').run(JSON.stringify({type:'batch.packaging-check',record,firstHash:createSignatureHash({record,userId:first.id,timestamp:signedAt}),secondHash:createSignatureHash({record,userId:second.id,timestamp:signedAt})}),req.user.username,req.user.role);
   const response={batch,...batchStock(b.hospitalId,b.locationId,b.drugId)};rememberTransaction(req,response);return response;
  })();res.status(201).json(result);
 }catch(e){res.status(e.status||500).json({message:e.message});}
});
export default router;
