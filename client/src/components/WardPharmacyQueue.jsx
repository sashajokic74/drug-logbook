import {useEffect,useState,useRef} from 'react';
import {SupplyProgress} from './PharmacyWorkflow';
import {API_URL} from '../apiConfig';

export default function WardPharmacyQueue(){
  const [search,setSearch]=useState(''),[status,setStatus]=useState('ALL'),[rejecting,setRejecting]=useState(null),[reason,setReason]=useState('');const rejectDialog=useRef(null);
  useEffect(()=>{if(rejecting){rejectDialog.current?.showModal();return()=>rejectDialog.current?.close();}},[rejecting]);
  const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function api(path='',body){
    const response=await fetch(`${API_URL}/ward-pharmacy${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${localStorage.getItem('token')}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    const result=await response.json();if(!response.ok)throw new Error(result.message||'Ward requests unavailable.');return result;
  }
  async function load(){setBusy(true);setError('');try{setData(await api());}catch(e){setData(null);setError(e.message);}finally{setBusy(false);}}
  useEffect(()=>{load();const id=setInterval(()=>{if(!rejecting)load();},30000);return()=>clearInterval(id);},[rejecting]);
  async function act(id,type){
    const note=type==='reject'?reason:'';
    if(note===null)return;
    if(type==='reject'&&!note.trim()){setError('Enter a rejection reason.');return;}
    setBusy(true);setError('');
    try{await api(`/${encodeURIComponent(id)}`,{type,note,revision:data.revision});setData(await api());setRejecting(null);setReason('');}
    catch(e){setError(e.message);setData(null);}finally{setBusy(false);}
  }
  return <section className="pharmacy-dashboard ward-queue">
    <div className="pharmacy-dashboard-header"><h2>Ward requests</h2><button type="button" disabled={busy} onClick={load}>Refresh requests</button></div>
    {error&&<p role="alert" className="form-error">{error}</p>}
    {busy&&<p role="status">Loading...</p>}
    {data&&!data.configured&&<p>Ward connection not configured.</p>}
    {data?.configured&&!data.requests.length&&<p>No ward requests.</p>}
    {data?.configured&&<><div className="pharmacy-status-grid">{['Requested','Approved','Dispatched','Received','Rejected'].map(s=><button key={s} className={status===s?'selected':''} onClick={()=>setStatus(status===s?'ALL':s)}><strong>{data.requests.filter(r=>r.status===s||(s==='Dispatched'&&r.status==='Partially received')).length}</strong><span>{s}</span></button>)}</div><div className="pharmacy-search-row"><label>Find a ward request<input placeholder="Medicine, hospital or ward" value={search} onChange={e=>setSearch(e.target.value)}/></label><label>Stage<select value={status} onChange={e=>setStatus(e.target.value)}><option value="ALL">All stages</option>{['Requested','Approved','Dispatched','Partially received','Received','Rejected','Cancelled'].map(s=><option key={s}>{s}</option>)}</select></label></div></>}
    <div className="pharmacy-request-list">{data?.requests.filter(r=>(status==='ALL'||r.status===status||(status==='Dispatched'&&r.status==='Partially received'))&&`${r.medicineName} ${r.hospitalName} ${r.ward}`.toLowerCase().includes(search.toLowerCase())).map(r=><article className="pharmacy-request-card" key={r.id}>
      <div><div className="supply-card-title"><span className="pharmacy-requisition">Ward · {r.id}</span><span className={`supply-badge ${r.status.toLowerCase()}`}>{r.status}</span></div><h3>{r.medicineName}</h3><p>{r.detail}</p>{r.status!=='Rejected'&&<SupplyProgress status={r.status==='Received'?'COMPLETED':r.status==='Partially received'?'DISPATCHED':r.status.toUpperCase()}/>}</div>
      <dl><div><dt>Hospital</dt><dd>{r.hospitalName}</dd></div><div><dt>Clinical area</dt><dd>{r.ward}</dd></div><div><dt>Quantity requested</dt><dd>{r.quantity} {r.unit}</dd></div><div><dt>Received / outstanding</dt><dd>{r.status==='Received'?r.quantity:Number(r.receivedQuantity||0)} / {r.status==='Received'?0:Math.max(0,Number(r.quantity)-Number(r.receivedQuantity||0))} {r.unit}</dd></div></dl>
      <div className="pharmacy-card-actions">
        {r.status==='Requested'&&<><button disabled={busy} onClick={()=>act(r.id,'approve')}>Approve</button><button className="reject-action" disabled={busy} onClick={()=>{setReason('');setRejecting(r);}}>Reject</button></>}
        {r.status==='Approved'&&<button disabled={busy} onClick={()=>act(r.id,'dispatch')}>Mark dispatched</button>}
      </div>
    </article>)}</div>
    {rejecting&&<dialog ref={rejectDialog} className="pharmacy-action-dialog" onCancel={e=>{if(busy)e.preventDefault();else setRejecting(null);}}><form onSubmit={e=>{e.preventDefault();act(rejecting.id,'reject');}}><h2>Reject ward request</h2><p>{rejecting.medicineName} · {rejecting.ward}</p><label>Reason for rejection<input required value={reason} maxLength={200} onChange={e=>setReason(e.target.value)}/></label>{error&&<p className="supply-error" role="alert">{error}</p>}<div><button type="button" disabled={busy} onClick={()=>setRejecting(null)}>Cancel</button><button disabled={busy}>Confirm rejection</button></div></form></dialog>}
  </section>;
}
