import { readTable } from '../../lib/paperbot-db';
import { evaluateEntry, evaluateExit } from '../../lib/paperbot-strategy';

// Only BTC has an executable bid/ask feed. WTI, GAS and DAX are reference-only until a licensed feed is configured.
const PAIRS = ['XBTEUR'];
const API = 'https://api.kraken.com/0/public/';

async function kraken(path) {
  const r = await fetch(API + path, { cache: 'no-store', signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error('Market HTTP error');
  const j = await r.json();
  if (j.error?.length) throw new Error('Market API error');
  const data = Object.entries(j.result || {}).find(([key]) => key !== 'last')?.[1];
  if (!data) throw new Error('Missing Kraken market data');
  return data;
}

async function quote(pair) {
  const t = await kraken('Ticker?pair=' + encodeURIComponent(pair));
  const bid = Number(t.b[0]), ask = Number(t.a[0]);
  if (!(bid > 0 && ask >= bid)) throw new Error('Invalid market quote');
  return { bid, ask };
}

async function entrySignal(pair) {
  const data = await kraken('OHLC?pair=' + encodeURIComponent(pair) + '&interval=1');
  if (!Array.isArray(data) || data.length < 3) return null;
  const previous = data[data.length - 3], current = data[data.length - 2];
  const candleClose = new Date((Number(current[0]) + 60) * 1000).toISOString();
  return { ...evaluateEntry({last:Number(previous[4])}, {
    last:Number(current[4]), timestamp:candleClose
  }), candleClose };
}

async function rpc(name, payload) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing database configuration');
  const r = await fetch(new URL('/rest/v1/rpc/' + name, url), {
    method:'POST',
    headers:{ apikey:key, Authorization:'Bearer ' + key,
      'Content-Type':'application/json' },
    body:JSON.stringify(payload), cache:'no-store'
  });
  if (!r.ok) throw new Error('Database RPC failed (' + r.status + ')');
  const result = await r.json();
  if (!result || result.ok !== true) throw new Error('Database RPC rejected operation');
  return result;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ok:false});
  const secret = process.env.PAPERBOT_RUN_SECRET;
  if (!secret || req.headers.authorization !== 'Bearer ' + secret)
    return res.status(401).json({ok:false,error:'Unauthorized'});
  try {
    const accounts = await readTable('paperbot_accounts', 'select=*&name=eq.main&limit=1');
    const account = accounts[0];
    if (!account) return res.status(404).json({ok:false,error:'Account main not found'});
    if (!account.auto_enabled)
      return res.status(200).json({ok:true,mode:'PAPER',status:'paused',reason:'auto_enabled_false'});
    const positions = await readTable('paperbot_positions',
      'select=*&account_id=eq.' + encodeURIComponent(account.id) + '&closed_at=is.null&limit=1');
    const position = positions[0];
    if (position) {
      if (!PAIRS.includes(position.symbol)) throw new Error('Unknown position symbol');
      const q = await quote(position.symbol);
      const exit = evaluateExit(position, q, Number(account.fee_rate), { takeProfitEur: Number(account.take_profit_eur ?? 2), stopLossEur: Number(account.stop_loss_eur ?? 10) });
      if (exit.action !== 'CLOSE')
        return res.status(200).json({ok:true,mode:'PAPER',status:'hold',reason:exit.reason});
      const result = await rpc('paperbot_close_position', {
        p_account_id:account.id,
        p_run_key:'close:' + position.id,
        p_position_id:position.id,
        p_exit_price:exit.price,
        p_reason:exit.reason
      });
      return res.status(200).json({ok:true,mode:'PAPER',status:'close',result});
    }
    const signals = await Promise.all(PAIRS.map(async pair => ({
      pair, signal: await entrySignal(pair)
    })));
    const buy = signals.filter(x => x.signal?.action === 'BUY');
    const sell = signals.filter(x => x.signal?.action === 'SELL');
    const direction = buy.length >= 1 ? 'BUY' : sell.length >= 1 ? 'SELL' : null;
    if (!direction) return res.status(200).json({
      ok:true, mode:'PAPER', status:'no_consensus',
      buy_signals:buy.length, sell_signals:sell.length,
      signals:signals.map(x=>({symbol:x.pair,action:x.signal?.action||'NONE',reason:x.signal?.reason||'no_signal',move_pct:x.signal?.movePct??null,candle_close:x.signal?.candleClose||null}))
    });
    const candidates = direction === 'BUY' ? buy : sell;
    candidates.sort((a,b) => Math.abs(b.signal.movePct) - Math.abs(a.signal.movePct));
    const chosen = candidates[0];
    const q = await quote(chosen.pair);
    const side = direction === 'BUY' ? 'LONG' : 'SHORT';
    const result = await rpc('paperbot_open_position', {
      p_account_id:account.id,
      p_run_key:'open:' + chosen.pair + ':' + chosen.signal.candleClose,
      p_symbol:chosen.pair,
      p_side:side,
      p_price:side === 'LONG' ? q.ask : q.bid
    });
    return res.status(200).json({
      ok:true, mode:'PAPER', status:'open_attempt',
      direction, consensus:candidates.length, symbol:chosen.pair, result
    });
  } catch (e) {
    console.error('PaperBot cycle error:',e);
    return res.status(502).json({ok:false,error:'Paper trading cycle failed',detail:String(e.message||e)});
  }
}
