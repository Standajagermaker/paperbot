import {v2State} from '../../lib/paperbot-v2';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({ok:false});
 try{
 const {account,positions}=await v2State();
 const open=positions.filter(p=>!p.closed_at);
 const history=positions.filter(p=>p.closed_at);
 const exposure=open.reduce((n,p)=>n+Number(p.margin_eur),0);
 return res.status(200).json({ok:true,mode:'PAPER_V2',account,positions:open,history,
 exposure_eur:exposure,available_exposure_eur:Math.max(0,Number(account.max_exposure_eur)-exposure),
 markets:{XBTEUR:'paper-tradable',WTI:'reference-only',GAS:'reference-only',DAX:'reference-only'},
 updated:new Date().toISOString()});
 }catch(e){return res.status(503).json({ok:false,error:String(e.message||e),setup_required:true})}
}
