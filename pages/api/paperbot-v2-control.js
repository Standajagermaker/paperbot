import {randomUUID} from 'node:crypto';
import {isAdmin,sameOrigin} from '../../lib/paperbot-admin';
import {v2State,v2Rpc,marketQuote} from '../../lib/paperbot-v2';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({ok:false});
 if(!isAdmin(req)||!sameOrigin(req))return res.status(403).json({ok:false,error:'Administrator login required'});
 try{
 const {account,positions}=await v2State();
 const action=req.body?.action;
 if(action==='toggle_auto'){
  if(typeof req.body?.enabled!=='boolean')return res.status(400).json({ok:false,error:'Invalid enabled value'});
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url=new URL('/rest/v1/paperbot_v2_accounts?id=eq.main',process.env.SUPABASE_URL);
  const r=await fetch(url,{method:'PATCH',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({auto_enabled:req.body.enabled}),cache:'no-store'});
  if(!r.ok)return res.status(502).json({ok:false,error:'Auto switch migration missing or DB error: '+r.status});
  const data=await r.json();
  return res.status(200).json({ok:true,auto_enabled:data[0]?.auto_enabled});
 }
 if(action==='open'){
  if(req.body?.symbol!=='XBTEUR'||!['LONG','SHORT'].includes(req.body?.side))return res.status(400).json({ok:false,error:'Only BTC PAPER trading supported'});
  const q=await marketQuote('XBTEUR');
  const exposure=positions.filter(p=>!p.closed_at).reduce((n,p)=>n+Number(p.margin_eur),0);
  const margin=Math.min(Number(account.max_position_eur),Number(account.max_exposure_eur)-exposure,Number(account.cash_balance)/(1+Number(account.fee_rate)));
  if(margin<10)return res.status(409).json({ok:false,error:'Insufficient free exposure/cash'});
  const price=req.body.side==='LONG'?q.ask:q.bid;
  const result=await v2Rpc('paperbot_v2_open',{p_key:'manual:'+randomUUID(),p_symbol:'XBTEUR',p_side:req.body.side,p_price:price,p_margin:Math.floor(margin*100)/100});
  return res.status(result.ok?200:409).json({ok:result.ok,result,price});
 }
 if(action==='close'){
  const id=String(req.body?.position_id||'');
  if(!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({ok:false,error:'Invalid position ID'});
  const p=positions.find(x=>x.id===id&&!x.closed_at);
  if(!p)return res.status(409).json({ok:false,error:'Position not open'});
  const q=await marketQuote(p.symbol);
  const price=p.side==='LONG'?q.bid:q.ask;
  const result=await v2Rpc('paperbot_v2_close',{p_id:p.id,p_price:price,p_reason:'manual_close'});
  return res.status(result.ok?200:409).json({ok:result.ok,result,price});
 }
 return res.status(400).json({ok:false,error:'Unknown action'});
 }catch(e){return res.status(502).json({ok:false,error:String(e.message||e)})}
}
