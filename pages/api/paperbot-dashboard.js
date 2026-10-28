import {readTable} from '../../lib/paperbot-db';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({ok:false});
 try{
  const a=(await readTable('paperbot_accounts','select=id,initial_balance,cash_balance,auto_enabled,fee_rate,allocation_pct,take_profit_eur,stop_loss_eur&name=eq.main&limit=1'))[0];
  if(!a)return res.status(404).json({ok:false,error:'Paper account not found'});
  const id=encodeURIComponent(a.id);
  const [positions,history,signals]=await Promise.all([
   readTable('paperbot_positions','select=*&account_id=eq.'+id+'&closed_at=is.null&order=opened_at.desc&limit=5'),
   readTable('paperbot_positions','select=*&account_id=eq.'+id+'&closed_at=not.is.null&order=closed_at.desc&limit=30'),
   readTable('paperbot_signals','select=created_at,symbol,action,reason,metadata&account_id=eq.'+id+'&order=created_at.desc&limit=12')
  ]);
  res.status(200).json({ok:true,mode:'PAPER',account:a,positions,history,signals,updated:new Date().toISOString()});
 }catch(e){res.status(502).json({ok:false,error:'Server paper account unavailable'});}
}
