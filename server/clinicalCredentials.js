import bcrypt from 'bcrypt';
import db from './database.js';
import {accountUnavailable,hasLocationAccess} from './auth.js';

const attempts=new Map();
// Recheck the actual passwords on the final write. The earlier UI verification
// is advisory and must never turn a client-supplied staff ID into a signature.
export function clinicalCredentials(pairs){
  return (req,res,next)=>{
    const now=Date.now(), key=`${req.ip}:${req.user.id}`;
    for(const [k,times] of attempts)if(!times.some(t=>t>now-60000))attempts.delete(k);
    const recent=(attempts.get(key)||[]).filter(t=>t>now-60000);
    if(recent.length>=10)return res.status(429).json({message:'Too many signing attempts. Wait one minute.'});
    for(const [idField,credentialField] of pairs){
      const credentials=req.body?.[credentialField];
      const staff=db.prepare('SELECT * FROM users WHERE id=?').get(Number(req.body?.[idField]));
      if(!credentials||typeof credentials.username!=='string'||typeof credentials.password!=='string'||credentials.password.length>256||
          accountUnavailable(staff)||credentials.username!==staff.username||!bcrypt.compareSync(credentials.password,staff.password)){
        attempts.set(key,[...recent,now]);
        return res.status(403).json({message:'Both signers must verify their credentials again before saving.'});
      }
      if(req.body.hospitalId&&req.body.locationId&&!hasLocationAccess(staff,req.body.hospitalId,req.body.locationId))return res.status(403).json({message:'A signer is not assigned to this clinical area.'});
      if(idField==='requestedById'){req.body.requestedByName=staff.fullName||staff.username;req.body.requestedByRole=staff.role;}
      // No password is passed onward to persistence, audit or signature hashing.
      delete req.body[credentialField];
    }
    next();
  };
}
