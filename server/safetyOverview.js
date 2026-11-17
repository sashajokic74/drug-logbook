import db from './database.js';
import {verifyUser,requireLocationAccess,adminOnly} from './auth.js';
db.exec(`CREATE TABLE IF NOT EXISTS stock_check_policies(hospitalId INTEGER NOT NULL,locationId INTEGER NOT NULL,dueTime TEXT NOT NULL,PRIMARY KEY(hospitalId,locationId));`);
const localDate=date=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export function attachSafetyOverview(app){
 app.get('/safety-overview',verifyUser,requireLocationAccess,(req,res)=>{
  const hospitalId=Number(req.query.hospitalId),locationId=Number(req.query.locationId);
  if(!hospitalId||!locationId)return res.status(400).json({message:'Select a hospital and location.'});
  const now=new Date(),today=localDate(now),clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
  const dueTime=db.prepare('SELECT dueTime FROM stock_check_policies WHERE hospitalId=? AND locationId=?').get(hospitalId,locationId)?.dueTime||'20:00';
  const latest=db.prepare('SELECT * FROM cd_stock_checks WHERE hospitalId=? AND locationId=? ORDER BY id DESC').all(hospitalId,locationId);
  const drugs=db.prepare('SELECT id,name FROM drugs').all();
  const missing=drugs.filter(d=>!latest.some(c=>c.drugId===d.id&&localDate(new Date(c.staffTwoSignedAt||c.createdAt+'Z'))===today));
  const discrepancies=drugs.flatMap(d=>{const check=latest.find(c=>c.drugId===d.id);return check&&check.difference!==0?[{id:check.id,medicine:d.name,difference:check.difference,at:check.staffTwoSignedAt||check.createdAt}]:[];});
  res.set('Cache-Control','no-store');
  res.json({today,dueTime,status:missing.length===0&&drugs.length>0?'completed':clock>=dueTime?'overdue':'due-today',missing:missing.map(d=>d.name),discrepancies,checkedAt:now.toISOString()});
 });
 app.put('/check-policy',verifyUser,adminOnly,requireLocationAccess,(req,res)=>{
  const {hospitalId,locationId,dueTime}=req.body;
  if(!Number.isSafeInteger(Number(hospitalId))||!Number.isSafeInteger(Number(locationId))||typeof dueTime!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(dueTime))return res.status(400).json({message:'Select a location and a valid UK daily deadline.'});
  db.transaction(()=>{
   db.prepare('INSERT INTO stock_check_policies VALUES(?,?,?) ON CONFLICT(hospitalId,locationId) DO UPDATE SET dueTime=excluded.dueTime').run(Number(hospitalId),Number(locationId),dueTime);
   db.prepare('INSERT INTO audit(action,username,role) VALUES(?,?,?)').run(`Daily check deadline ${hospitalId}/${locationId}: ${dueTime} UK`,req.user.username,req.user.role);
  })();res.json({dueTime});
 });
}
