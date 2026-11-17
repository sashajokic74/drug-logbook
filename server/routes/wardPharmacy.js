import express from 'express';

// The ward database remains the source of truth. Never copy balances into the CD database.
export function wardPharmacyRoutes({hasLocationAccess,baseUrl=process.env.WARD_REGISTER_URL,token=process.env.PHARMACY_BRIDGE_TOKEN,mapping=process.env.WARD_PHARMACY_AREAS,fetchImpl=fetch}={}) {
  const router=express.Router();
  let areas={};
  if(mapping)areas=typeof mapping==='string'?JSON.parse(mapping):mapping;
  if(!areas||Array.isArray(areas)||typeof areas!=='object'||Object.values(areas).some(a=>!a||!Number.isSafeInteger(a.hospitalId)||a.hospitalId<1||!Number.isSafeInteger(a.locationId)||a.locationId<1))throw new Error('Ward mappings require existing numeric hospitalId and locationId values.');
  const configured=Boolean(baseUrl&&token&&token.length>=48&&Object.keys(areas).length);
  if(baseUrl){
    const url=new URL(baseUrl);
    if(url.username||url.password||url.search||url.hash||!(url.protocol==='https:'||(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname))))throw new Error('Ward bridge requires HTTPS or loopback HTTP.');
  }
  const permitted=(user,ward)=>Object.hasOwn(areas,ward)&&hasLocationAccess(user,areas[ward].hospitalId,areas[ward].locationId);
  async function remote(path='',body){
    const response=await fetchImpl(`${baseUrl.replace(/\/$/,'')}/integration/pharmacy${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000),redirect:'error'});
    if(!response.ok){const error=new Error(response.status===409?'Ward register changed. Refresh and try again.':'Ward service could not complete this request.');error.status=response.status===409?409:502;throw error;}
    const data=await response.json();
    if(!Array.isArray(data.requests)||!Number.isSafeInteger(data.revision))throw new Error('Invalid ward response.');
    return data;
  }
  router.use((req,res,next)=>{
    if(!['pharmacy','pharmacist'].includes(String(req.user?.role).toLowerCase()))return res.status(403).json({message:'Pharmacy access required.'});
    res.set('Cache-Control','no-store');
    next();
  });
  router.get('/',async(req,res)=>{
    if(!configured)return res.json({configured:false,requests:[]});
    try{const data=await remote();res.json({...data,configured:true,requests:data.requests.filter(r=>permitted(req.user,r.ward)).map(r=>({...r,hospitalName:areas[r.ward].hospitalName}))});}
    catch{res.status(502).json({message:'Ward register unavailable. Theatre requests are unaffected.'});}
  });
  router.post('/:id',async(req,res)=>{
    if(!configured)return res.status(503).json({message:'Ward connection is not configured.'});
    const {type,revision,note=''}=req.body||{};
    if(!['approve','reject','dispatch'].includes(type)||!Number.isSafeInteger(revision)||typeof note!=='string'||note.length>160)return res.status(400).json({message:'Invalid ward action.'});
    try{
      const data=await remote(),request=data.requests.find(r=>r.id===req.params.id);
      if(!request||!permitted(req.user,request.ward))return res.status(403).json({message:'This ward is not assigned to your account.'});
      if(data.revision!==revision)return res.status(409).json({message:'Ward register changed. Refresh and try again.'});
      await remote(`/${encodeURIComponent(request.id)}`,{type,revision,note,actor:{id:String(req.user.id),username:req.user.username}});
      res.json({ok:true});
    }catch(error){res.status(error.status||502).json({message:error.status===409?error.message:'Ward action failed. Refresh to check its status before retrying.'});}
  });
  return router;
}
