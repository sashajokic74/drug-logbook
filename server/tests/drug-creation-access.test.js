import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';
process.env.NODE_ENV='test';
process.env.JWT_SECRET='drug-create-test-only';
process.env.DRUGLOG_DB_PATH=path.join(os.tmpdir(),`drug-create-${process.pid}.db`);
const {default:app}=await import('../server.js');
const {default:db}=await import('../database.js');
test('medicine creation requires an assigned active pharmacist, including direct requests',async()=>{
 const hospital=db.prepare('INSERT INTO hospitals (name) VALUES (?)').run('Fictional access hospital').lastInsertRowid;
 const location=db.prepare("INSERT INTO locations (hospitalId,hospitalName,name,active) VALUES (?,'Fictional access hospital',?,1)").run(hospital,'Test area').lastInsertRowid;
 const server=app.listen(0,'127.0.0.1'); await new Promise(resolve=>server.once('listening',resolve));
 try {
  for(const [role,scope,ids,active,expected] of [['nurse','ALL','',1,403],['admin','ALL','',1,403],['pharmacy','ALL','',1,201],['pharmacy','LOCATIONS','999999',1,403],['pharmacist','LOCATIONS','999999',1,403],['pharmacist','LOCATIONS',String(location),0,401],['pharmacist','LOCATIONS',String(location),1,201]]){
   const id=db.prepare("INSERT INTO users (username,password,role,fullName,staffType,active,accessScope,accessLocationIds) VALUES (?,?,?,?,'Permanent',?,?,?)").run(crypto.randomUUID(),'unused',role,'Test pharmacist',active,scope,ids).lastInsertRowid;
   const token=jwt.sign({id:Number(id)},process.env.JWT_SECRET);
   const before=db.prepare('SELECT count(*) AS n FROM drugs').get().n;
   const response=await fetch(`http://127.0.0.1:${server.address().port}/drugs`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({name:'Fictional access medicine',quantity:0,hospitalId:Number(hospital),locationId:Number(location)})});
   assert.equal(response.status,expected,`${role}/${scope}/${active}: ${await response.text()}`);
   assert.equal(db.prepare('SELECT count(*) AS n FROM drugs').get().n,before+(expected===201?1:0));
  }
 } finally { await new Promise(resolve=>server.close(resolve)); db.close(); }
});
