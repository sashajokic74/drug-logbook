import {useEffect,useState} from 'react';
import {API_URL} from '../apiConfig';
export default function SafetyOverview({device,user}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[deadline,setDeadline]=useState('20:00');
 async function refresh(){
  const query=new URLSearchParams({hospitalId:device.hospitalId,locationId:device.locationId});
  const response=await fetch(`${API_URL}/safety-overview?${query}`,{headers:{Authorization:`Bearer ${localStorage.getItem('token')}`},cache:'no-store'});
  const result=await response.json();if(!response.ok)throw new Error(result.message||'Safety overview unavailable');return result;
 }
 useEffect(()=>{let active=true;async function load(){try{const result=await refresh();if(active){setData(result);setDeadline(result.dueTime);setError('');}}catch(e){if(active)setError(e.message);}}if(device?.hospitalId&&device?.locationId)load();const timer=setInterval(load,30000);return()=>{active=false;clearInterval(timer);};},[device?.hospitalId,device?.locationId]);
 async function save(event){event.preventDefault();try{const response=await fetch(`${API_URL}/check-policy`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('token')}`},body:JSON.stringify({hospitalId:device.hospitalId,locationId:device.locationId,dueTime:deadline})});const result=await response.json();if(!response.ok)throw new Error(result.message);setData(await refresh());setError('');}catch(e){setError(e.message);}}
 if(error)return <p role="status">Safety overview unavailable: {error}</p>;
 if(!data)return null;
 return <section className="stock-check-signoff" aria-label="Safety overview"><h3>Daily check: {data.status==='completed'?'completed':data.status==='overdue'?'overdue':'due today'}</h3><p>Deadline {data.dueTime} UK time · {data.missing.length} medicines awaiting a check · {data.discrepancies.length} latest checks with discrepancies</p>{data.discrepancies.length>0&&<details><summary>Review latest discrepancies</summary><ul>{data.discrepancies.map(d=><li key={d.id}>{d.medicine}: {d.difference} · check #{d.id}</li>)}</ul><p>A later matched check does not document an investigation or resolution.</p></details>}<small>Checked {new Date(data.checkedAt).toLocaleTimeString('en-GB',{timeZone:'Europe/London'})} · Refreshes every 30 seconds</small>{user?.role==='admin'&&<form onSubmit={save}><label>Daily deadline (UK time)<input type="time" required value={deadline} onChange={e=>setDeadline(e.target.value)}/></label><button>Save deadline</button></form>}</section>;
}
