import db from '../database.js';

const ids=value=>String(value||'').split(',').map(x=>x.trim()).filter(Boolean);
export function wardLocationAccess(user,hospitalId,locationId){
  const location=db.prepare('SELECT hospitalId FROM locations WHERE id=? AND active=1').get(locationId);
  if(!location||Number(location.hospitalId)!==Number(hospitalId))return false;
  const scope=String(user.accessScope||'').toUpperCase();
  if(scope==='ALL')return true;
  if(scope==='HOSPITAL')return ids(user.accessHospitalIds).includes(String(hospitalId));
  if(scope==='LOCATIONS')return ids(user.accessLocationIds).includes(String(locationId));
  return false;
}
export function currentWardPharmacist(req,res,next){
  const user=db.prepare('SELECT * FROM users WHERE id=?').get(req.user?.id);
  const today=new Date().toISOString().slice(0,10);
  if(!user||user.active!==1||!['pharmacy','pharmacist'].includes(String(user.role).toLowerCase())||
    (user.staffType!=='Permanent'&&user.expiryDate&&user.expiryDate<today)||
    (user.accessExpiryDate&&user.accessExpiryDate<today))return res.status(403).json({message:'Active pharmacy account required.'});
  req.user=user;
  next();
}
