import {readTable} from '../../lib/paperbot-db';

// Manual PAPER close; never submits real orders.
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method not allowed'});
  const secret=process.env.PAPERBOT_RUN_SECRET;
  if(!secret||req.headers.authorization!=='Bearer '+secret)
    return res.status(401).json({ok:false,error:'Invalid control token'});
  try {
    const id=String(req.body?.position_id||'');
    if(!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(id))
      return res.status(400).json({ok:false,error:'Invalid position ID'});
    const positions=await readTable('paperbot_positions','select=*&id=eq.'+encodeURIComponent(id)+'&closed_at=is.null&limit=1');
    const p=positions[0];
    if(!p)return res.status(409).json({ok:false,error:'Position already closed or missing'});
    if(p.symbol!=='XBTEUR')
      return res.status(422).json({ok:false,error:'Manual close not yet supported for this reference-only market'});
    const kr=await fetch('https://api.kraken.com/0/public/Ticker?pair=XBTEUR',{cache:'no-store',signal:AbortSignal.timeout(9000)});
    if(!kr.ok)throw new Error('Market quote unavailable');
    const j=await kr.json();
    if(j.error?.length)throw new Error('Kraken quote error');
    const t=Object.values(j.result||{})[0];
    const price=Number(p.side==='LONG'?t?.b?.[0]:t?.a?.[0]);
    if(!(price>0))throw new Error('Invalid executable quote');
    const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url=process.env.SUPABASE_URL;
    if(!key||!url)throw new Error('Database not configured');
    const r=await fetch(new URL('/rest/v1/rpc/paperbot_close_position',url),{
      method:'POST',cache:'no-store',
      headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},
      body:JSON.stringify({p_account_id:p.account_id,p_run_key:'manual-close:'+p.id,
        p_position_id:p.id,p_exit_price:price,p_reason:'manual_close'})
    });
    if(!r.ok)throw new Error('Database close failed ('+r.status+')');
    const result=await r.json();
    if(result?.ok!==true)return res.status(409).json({ok:false,error:'Close rejected',result});
    return res.status(200).json({ok:true,mode:'PAPER',status:'closed',position_id:p.id,price,result});
  }catch(e){return res.status(502).json({ok:false,error:String(e.message||e)})}
}
