import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {wardPharmacyRoutes} from '../routes/wardPharmacy.js';

test('ward queue enforces pharmacy role, mapped clinical areas and stale-action protection',async t=>{
  const writes=[];
  const app=express();app.use(express.json());
  app.use((req,res,next)=>{req.user={id:9,username:'pharmacy-user',role:req.get('x-test-role')||'pharmacy'};next();});
  app.use(wardPharmacyRoutes({baseUrl:'http://127.0.0.1:5189',token:'x'.repeat(64),mapping:{Oncology:{hospitalId:1,locationId:2}},hasLocationAccess:(_u,h,l)=>h===1&&l===2,fetchImpl:async(_url,options)=>{
    if(options.method==='POST')writes.push(JSON.parse(options.body));
    return new Response(JSON.stringify({revision:4,requests:[{id:'WR-0001',ward:'Oncology'},{id:'WR-0002',ward:'Renal'}]}),{status:200});
  }}));
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(url,{headers:{'x-test-role':'nurse'}})).status,403);
  assert.equal((await (await fetch(url)).json()).requests.length,1);
  const post=(id,revision)=>fetch(`${url}/${id}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'approve',revision,actor:{username:'spoofed'}})});
  assert.equal((await post('WR-0002',4)).status,403);
  assert.equal((await post('WR-0001',3)).status,409);
  assert.equal((await post('WR-0001',4)).status,200);
  assert.equal(writes.length,1);assert.deepEqual(writes[0].actor,{id:'9',username:'pharmacy-user'});
});
