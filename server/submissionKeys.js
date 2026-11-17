import {createHash} from 'node:crypto';
import db from './database.js';
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
db.exec(`CREATE TABLE IF NOT EXISTS clinical_submissions(actorId INTEGER NOT NULL,operationId TEXT NOT NULL,fingerprint TEXT NOT NULL,response TEXT NOT NULL,PRIMARY KEY(actorId,operationId));`);
export function transactionSubmission(req,res,next){
 const id=req.body.operationId;
 if(typeof id!=='string'||!/^[-a-zA-Z0-9]{16,100}$/.test(id))return res.status(400).json({message:'Refresh the form before saving this entry.'});
 const fingerprint=createHash('sha256').update(JSON.stringify(canonical(req.body))).digest('hex');
 const previous=db.prepare('SELECT * FROM clinical_submissions WHERE actorId=? AND operationId=?').get(req.user.id,id);
 if(previous){
  if(previous.fingerprint!==fingerprint)return res.status(409).json({message:'This submission already saved different details. Refresh the register before creating another entry.'});
  return res.json({...JSON.parse(previous.response),alreadySaved:true});
 }
 req.submission={id,fingerprint};next();
}
export function rememberTransaction(req,response){
 db.prepare('INSERT INTO clinical_submissions VALUES(?,?,?,?)').run(req.user.id,req.submission.id,req.submission.fingerprint,JSON.stringify(response));
}
