export const supplyStages=['REQUESTED','APPROVED','DISPATCHED','COMPLETED'];
export const supplyLabel=s=>({REQUESTED:'Requested',APPROVED:'Approved',DISPATCHED:'Dispatched',COMPLETED:'Received',REJECTED:'Rejected'}[String(s).toUpperCase()]||s);
export function SupplyProgress({status}){const n=supplyStages.indexOf(String(status).toUpperCase());return <ol className="supply-progress" aria-label="Supply progress">{supplyStages.map((s,i)=><li key={s} className={n>=i?'done':''} aria-current={n===i?'step':undefined}><span>{i+1}</span>{supplyLabel(s)}</li>)}</ol>}
