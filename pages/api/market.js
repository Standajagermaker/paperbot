// Market reference prices only. Yahoo Finance chart feed is unofficial and may be delayed or unavailable.
const YAHOO = [
  {pair:'WTI',symbol:'CL=F',name:'WTI crude oil',currency:'USD',unit:'USD/barrel'},
  {pair:'GAS',symbol:'NG=F',name:'Henry Hub natural gas',currency:'USD',unit:'USD/MMBtu'},
  {pair:'DAX',symbol:'^GDAXI',name:'DAX 40',currency:'EUR',unit:'index points'}
];
async function yahoo(item) {
  let lastError='No market data';
  for (const host of ['query1.finance.yahoo.com','query2.finance.yahoo.com']) {
    try {
      const url='https://'+host+'/v8/finance/chart/'+encodeURIComponent(item.symbol)+'?interval=5m&range=5d';
      const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(7000),headers:{Accept:'application/json','User-Agent':'Mozilla/5.0'}});
      if(!r.ok)throw Error('HTTP '+r.status);
      const j=await r.json(),chart=j.chart?.result?.[0];
      const times=chart?.timestamp||[],closes=chart?.indicators?.quote?.[0]?.close||[];
      let i=closes.length-1;while(i>=0&&!(Number(closes[i])>0))i--;
      if(i<0||!times[i])throw Error('No valid quote');
      const ageMs=Date.now()-times[i]*1000;
      return {...item,last:Number(closes[i]),bid:null,ask:null,timestamp:new Date(times[i]*1000).toISOString(),ageSeconds:Math.round(ageMs/1000),stale:ageMs>180000||ageMs< -60000,source:'Yahoo Finance (unofficial; may be delayed)',tradable:false};
    }catch(e){lastError=host+': '+String(e.message||e);}
  }
  throw Error(lastError);
}
async function bitcoin(){
  const r=await fetch('https://api.kraken.com/0/public/Ticker?pair=XBTEUR',{cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw Error('Kraken HTTP '+r.status);
  const j=await r.json();if(j.error?.length)throw Error('Kraken error');
  const t=Object.values(j.result||{})[0];if(!t)throw Error('Missing BTC quote');
  return {pair:'XBTEUR',name:'Bitcoin',currency:'EUR',unit:'EUR/BTC',bid:Number(t.b[0]),ask:Number(t.a[0]),last:Number(t.c[0]),timestamp:new Date().toISOString(),ageSeconds:0,stale:false,source:'Kraken',tradable:true};
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  const result=await Promise.allSettled([bitcoin(),...YAHOO.map(yahoo)]);
  const data=result.map((x,i)=>x.status==='fulfilled'?x.value:{pair:i===0?'XBTEUR':YAHOO[i-1].pair,name:i===0?'Bitcoin':YAHOO[i-1].name,currency:i===0?'EUR':YAHOO[i-1].currency,last:null,stale:true,tradable:false,source:i===0?'Kraken':'Yahoo Finance (unofficial)',error:x.reason?.message||'Price unavailable'});
  return res.status(200).json({timestamp:new Date().toISOString(),data});
}
