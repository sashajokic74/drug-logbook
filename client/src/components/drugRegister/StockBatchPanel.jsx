import {useRef,useState} from 'react';
import {API_URL} from '../../apiConfig';
export default function StockBatchPanel({drug,device,data,onRefresh}){
 const [form,setForm]=useState({batchNumber:'',expiryDate:'',quantity:'',firstUsername:'',firstPassword:'',secondUsername:'',secondPassword:'',packagingChecked:false});
 const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const pending=useRef(false);const operation=useRef(crypto.randomUUID());
 const today=data.today||new Date().toISOString().slice(0,10);const soon=new Date(Date.parse(today)+30*86400000).toISOString().slice(0,10);
 const active=data.batches.filter(b=>b.quantity>0),expired=active.filter(b=>b.expiryDate<today),near=active.filter(b=>b.expiryDate>=today&&b.expiryDate<=soon);
 const update=e=>setForm({...form,[e.target.name]:e.target.type==='checkbox'?e.target.checked:e.target.value});
 async function save(e){e.preventDefault();if(pending.current)return;pending.current=true;setBusy(true);setMessage('');
  const headers={'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('token')}`};
  const scope={hospitalId:device.hospitalId,locationId:device.locationId,drugId:drug.id};
  async function post(path,body){const r=await fetch(`${API_URL}${path}`,{method:'POST',headers,body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.message||'Could not save');return d;}
  try{
   const first={username:form.firstUsername,password:form.firstPassword},second={username:form.secondUsername,password:form.secondPassword};
   const a=await post('/checker/verify',{...scope,...first});const b=await post('/checker/verify',{...scope,...second,currentUserId:a.id});
   await post('/stock-batches',{...scope,operationId:operation.current,batchNumber:form.batchNumber,expiryDate:form.expiryDate,quantity:Number(form.quantity),packagingChecked:form.packagingChecked,expectedBalance:data.total,expectedUnallocated:data.unallocated,administeredById:a.id,witnessId:b.id,administeredCredentials:first,witnessCredentials:second});
   operation.current=crypto.randomUUID();setForm({...form,batchNumber:'',expiryDate:'',quantity:'',firstPassword:'',secondPassword:'',packagingChecked:false});await onRefresh();setMessage('Packaging checked and batch recorded. Total stock is unchanged.');
  }catch(error){setMessage(error.message);}finally{pending.current=false;setBusy(false);}
 }
 return <section className="ipad-entry-panel cd-batch-panel"><h3>Batch &amp; expiry</h3>
  {expired.length>0&&<p role="alert">Expired: {expired.map(b=>`${b.batchNumber} (${b.quantity})`).join(', ')}. Remove from available stock under your local procedure.</p>}
  {near.length>0&&<p>Expiring within 30 days: {near.map(b=>`${b.batchNumber} · ${b.expiryDate}`).join(', ')}</p>}
  {data.unallocated>0&&<p role="status">{data.unallocated} stock units need a batch and expiry packaging check before administration.</p>}
  {active.length>0&&<div className="cd-batch-list">{active.map(b=><div key={b.id}><strong>{b.batchNumber}</strong><span>Expires {b.expiryDate}{b.expiryDate<today?' · EXPIRED':''}</span><span>{b.quantity} physical · {b.availableQuantity??b.quantity} available{b.heldQuantity?` · ${b.heldQuantity} held`:""}</span></div>)}</div>}
  {data.unallocated>0&&<details><summary>Record packaging details for existing stock</summary><form onSubmit={save}>
   <p>This assigns existing stock to a batch without adding stock. Two authorised staff must check the physical packaging. Record expired stock accurately; it will remain blocked from administration.</p>
   <div className="ipad-field-grid two-column"><label>Batch number<input name="batchNumber" value={form.batchNumber} onChange={update} required maxLength={100}/></label><label>Expiry date<input type="date" name="expiryDate" value={form.expiryDate} onChange={update} required/></label><label>Existing stock quantity<input type="number" min="1" step="1" max={data.unallocated} name="quantity" value={form.quantity} onChange={update} required/></label></div>
   <div className="ipad-field-grid two-column"><fieldset><legend>First packaging checker</legend><label>Username<input name="firstUsername" autoComplete="off" value={form.firstUsername} onChange={update} required/></label><label>Password<input type="password" name="firstPassword" autoComplete="new-password" value={form.firstPassword} onChange={update} required/></label></fieldset><fieldset><legend>Second packaging checker</legend><label>Username<input name="secondUsername" autoComplete="off" value={form.secondUsername} onChange={update} required/></label><label>Password<input type="password" name="secondPassword" autoComplete="new-password" value={form.secondPassword} onChange={update} required/></label></fieldset></div>
   <label><input type="checkbox" name="packagingChecked" checked={form.packagingChecked} onChange={update} required/> We checked the physical batch, expiry and quantity.</label><button disabled={busy}>{busy?'Signing…':'Verify and record batch'}</button>
  </form></details>}{message&&<p role="status">{message}</p>}
 </section>;
}
