import {readTable} from '../../lib/paperbot-db';
import {evaluateIndicatorEntry} from '../../lib/paperbot-strategy';
const API='https://api.kraken.com/0/public/';
async function kraken(path){
 const r=await fetch(API+path,{cache:'no-store',signal:AbortSignal.timeout(9000)});
 if(!r.ok)throw Error('Kraken HTTP '+r.status);
 const j=await r.json();if(j.error?.length)throw Error('Kraken error');
 const data=Object.entries(j.result||{}).find(([k])=>k!=='last')?.[1];
 if(!data)throw Error('Missing market data');return data;
}
export async function marketQuote(symbol){
 if(symbol!=='XBTEUR')throw Error('No executable quote for '+symbol);
 const t=await kraken('Ticker?pair=XBTEUR');
 const bid=Number(t.b[0]),ask=Number(t.a[0]);
 if(!(bid>0&&ask>=bid))throw Error('Invalid quote');
 return {bid,ask};
}
export async function btcSignal(){
 const data=await kraken('OHLC?pair=XBTEUR&interval=1');
 const candles=data.slice(0,-1).map(x=>({time:Number(x[0]),open:Number(x[1]),high:Number(x[2]),low:Number(x[3]),close:Number(x[4])}));
 const signal=evaluateIndicatorEntry(candles);
 const last=candles[candles.length-1];
 return {...signal,candleClose:new Date((last.time+60)*1000).toISOString()};
}
export async function v2Rpc(name,body){
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY,url=process.env.SUPABASE_URL;
 if(!key||!url)throw Error('Missing DB configuration');
 const r=await fetch(new URL('/rest/v1/rpc/'+name,url),{
 method:'POST',cache:'no-store',
 headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},
 body:JSON.stringify(body)});
 if(!r.ok)throw Error('V2 RPC '+name+' failed '+r.status+': '+(await r.text()).slice(0,300));
 return r.json();
}
export async function v2State(){
 const [accounts,positions]=await Promise.all([
 readTable('paperbot_v2_accounts','select=*&id=eq.main&limit=1'),
 readTable('paperbot_v2_positions','select=*&order=opened_at.desc&limit=200')]);
 if(!accounts[0])throw Error('V2 SQL migration not installed');
 return {account:accounts[0],positions};
}
