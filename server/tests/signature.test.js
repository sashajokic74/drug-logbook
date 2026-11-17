import {test} from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV='test';process.env.JWT_SECRET='isolated-signature-test-key';process.env.DEFAULT_ADMIN_PASSWORD='isolated-admin-password';
const {createSignatureHash}=await import('../signature.js');
test('versioned record signatures bind patient and quantities with canonical field order',()=>{
 const payload={userId:1,timestamp:'2026-11-17T12:00:00Z',record:{patient:'Dummy',dose:5,waste:5}};
 const original=createSignatureHash(payload);
 assert.ok(original.startsWith('v2:'));
 assert.equal(original,createSignatureHash({...payload,record:{waste:5,dose:5,patient:'Dummy'}}));
 assert.notEqual(original,createSignatureHash({...payload,record:{...payload.record,patient:'Other'}}));
 assert.notEqual(original,createSignatureHash({...payload,record:{...payload.record,dose:6}}));
});
