import {v2State,v2Rpc,marketQuote,btcSignal} from '../../lib/paperbot-v2';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({ok:false});
 if(!process.env.PAPERBOT_RUN_SECRET||req.headers.authorization!=='Bearer '+process.env.PAPERBOT_RUN_SECRET)
 return res.status(401).json({ok:false,error:'Unauthorized'});
 try{
 const {account,positions}=await v2State();
 const open=positions.filter(p=>!p.closed_at);
 const q=await marketQuote('XBTEUR');
 const actions=[];
 for(const p of open.filter(p=>p.symbol==='XBTEUR')){
  const price=p.side==='LONG'?q.bid:q.ask;
  const gross=(p.side==='LONG'?price-p.entry_price:p.entry_price-price)*p.quantity;
  const net=gross-Number(p.entry_fee_eur)-price*p.quantity*Number(account.fee_rate);
  const age=Date.now()-Date.parse(p.opened_at);
  const target=Math.max(0.30,Number(p.margin_eur)*0.008);
  const stop=Math.max(0.75,Number(p.margin_eur)*0.025);
  if(net>=target||net<=-stop||age>24*3600000){
   const result=await v2Rpc('paperbot_v2_close',{p_id:p.id,p_price:price,p_reason:net>=target?'take_profit':net<=-stop?'stop_loss':'time_limit'});
   actions.push({action:'close',symbol:p.symbol,id:p.id,result});
  }
 }
 const signal=await btcSignal();
 const active=open.filter(p=>!actions.some(a=>a.id===p.id));
 const exposure=active.reduce((n,p)=>n+Number(p.margin_eur),0);
 const margin=Math.min(Number(account.max_position_eur),Number(account.max_exposure_eur)-exposure,Number(account.cash_balance)-1);
 if((signal.action==='BUY'||signal.action==='SELL')&&margin>=10){
  const side=signal.action==='BUY'?'LONG':'SHORT';
  const price=side==='LONG'?q.ask:q.bid;
  const spreadPct=(q.ask-q.bid)/price*100;
  const feePct=Number(account.fee_rate)*200;
  // No profit prediction: require volatility adequate for fees and target.
  const requiredPct=feePct+spreadPct+0.8;
  const estimatedPct=signal.atrPct*Math.sqrt(30);
  if(estimatedPct>=requiredPct){
   const key='v2:XBTEUR:'+side+':'+signal.candleClose;
   const result=await v2Rpc('paperbot_v2_open',{p_key:key,p_symbol:'XBTEUR',p_side:side,p_price:price,p_margin:margin});
   actions.push({action:'open',symbol:'XBTEUR',side,result});
  }else actions.push({action:'skip',reason:'cost_filter',estimatedPct,requiredPct});
 }else actions.push({action:'skip',reason:margin<10?'exposure_limit':signal.reason});
 return res.status(200).json({ok:true,mode:'PAPER_V2',actions,signal:{action:signal.action,reason:signal.reason},open_before:open.length,
 reference_only:['WTI','GAS','DAX']});
 }catch(e){return res.status(502).json({ok:false,error:String(e.message||e),hint:'Run V2 SQL migration first; V2 will not run without it'})}
}
