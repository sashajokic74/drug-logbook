import {createHmac} from 'node:crypto';
import {config} from './config.js';
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])])):value;
// New records use a versioned HMAC over both signer and clinical record.
// Historical hashes remain unchanged. Production config requires a JWT secret,
// which also provides a secure fallback signing key with a separate domain.
export function createSignatureHash(payload){
 const key=process.env.SIGNATURE_SECRET||config.jwtSecret;
 return 'v2:'+createHmac('sha256',key).update('controlled-drug-record-v2\0').update(JSON.stringify(canonical(payload))).digest('hex');
}
