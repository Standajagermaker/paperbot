import {v2State,marketQuote,v2Rpc} from '../../lib/paperbot-v2';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({ok:false});
 if(!process.env.PAPERBOT_RUN_SECRET||req.headers.authorization!=='Bearer '+process.env.PAPERBOT_RUN_SECRET)
 return res.status(401).json({ok:false,error:'Unauthorized'});
 try{
 const id=String(req.body?.position_id||'');
 if(!/^[a-f0-9-]{36}$/i.test(id))return res.status(400).json({ok:false,error:'Invalid position ID'});
 const {positions}=await v2State();
 const p=positions.find(x=>x.id===id&&!x.closed_at);
 if(!p)return res.status(409).json({ok:false,error:'Position not open'});
 const q=await marketQuote(p.symbol);
 const price=p.side==='LONG'?q.bid:q.ask;
 const result=await v2Rpc('paperbot_v2_close',{p_id:id,p_price:price,p_reason:'manual_close'});
 return res.status(result.ok?200:409).json({ok:result.ok,result,price});
 }catch(e){return res.status(502).json({ok:false,error:String(e.message||e)})}
}
