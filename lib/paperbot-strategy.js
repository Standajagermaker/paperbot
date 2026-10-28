// Pure, deterministic strategy functions. No broker connection or order submission.
export const STRATEGY = Object.freeze({
  minMovePct: 0.12,
  takeProfitPct: 1.2,
  stopLossPct: -0.8,
  maxQuoteAgeMs: 60000
});

export function evaluateEntry(previous, current, now = Date.now()) {
  if (!previous || !current) return {action:'HOLD', reason:'missing_quote'};
  if (!Number.isFinite(previous.last) || !Number.isFinite(current.last) ||
      previous.last <= 0 || current.last <= 0) return {action:'HOLD', reason:'invalid_price'};
  const quoteTime = Date.parse(current.timestamp || '');
  if (!Number.isFinite(quoteTime) || now - quoteTime > STRATEGY.maxQuoteAgeMs ||
      quoteTime > now + 5000) return {action:'HOLD', reason:'stale_quote'};
  const movePct = (current.last / previous.last - 1) * 100;
  if (Math.abs(movePct) < STRATEGY.minMovePct) return {action:'HOLD', reason:'below_threshold', movePct};
  return {action:movePct > 0 ? 'BUY' : 'SELL', reason:'momentum', movePct};
}

export function evaluateExit(position, quote, feeRate = 0.0025, limits = {}) {
  if (!position || !quote) return {action:'HOLD', reason:'missing_position_or_quote'};
  const price = position.side === 'LONG' ? quote.bid : quote.ask;
  const entry = Number(position.entry_price);
  const qty = Number(position.quantity);
  const margin = Number(position.margin_eur);
  const entryFee = Number(position.entry_fee_eur);
  if (![price,entry,qty,margin,entryFee].every(Number.isFinite) ||
      price <= 0 || entry <= 0 || qty <= 0 || margin <= 0) {
    return {action:'HOLD', reason:'invalid_position_or_quote'};
  }
  const gross = (position.side === 'LONG' ? price - entry : entry - price) * qty;
  const net = gross - entryFee - price * qty * feeRate;
  const pnlPct = net / margin * 100;
  const takeProfitEur = Number(limits.takeProfitEur ?? 2);
  const stopLossEur = Number(limits.stopLossEur ?? 10);
  if (!(takeProfitEur > 0 && stopLossEur > 0)) return {action:'HOLD', reason:'invalid_limits'};
  if (net >= takeProfitEur) return {action:'CLOSE', reason:'take_profit', pnlPct, net, price};
  if (net <= -stopLossEur) return {action:'CLOSE', reason:'stop_loss', pnlPct, net, price};
  return {action:'HOLD', reason:'within_limits', pnlPct, net};
}

 
// Multi-indicator entry filter. Uses completed OHLC candles only.
function ema(values, period) {
  if(values.length<period)return NaN;
  const k=2/(period+1);let e=values.slice(0,period).reduce((a,b)=>a+b,0)/period;
  for(let i=period;i<values.length;i++)e=values[i]*k+e*(1-k);
  return e;
}
function rsi(values, period=14) {
  if(values.length<period+2)return NaN;
  let gains=0,losses=0;
  for(let i=1;i<=period;i++){const d=values[i]-values[i-1];gains+=Math.max(0,d);losses+=Math.max(0,-d);}
  gains/=period;losses/=period;
  for(let i=period+1;i<values.length;i++){const d=values[i]-values[i-1];gains=(gains*(period-1)+Math.max(0,d))/period;losses=(losses*(period-1)+Math.max(0,-d))/period;}
  if(gains===0&&losses===0)return 50;
  if(losses===0)return 100;
  return 100-100/(1+gains/losses);
}
function atr(candles, period=14) {
  if(candles.length<period+1)return NaN;
  const tr=[];
  for(let i=1;i<candles.length;i++){
    const c=candles[i],p=candles[i-1];
    tr.push(Math.max(c.high-c.low,Math.abs(c.high-p.close),Math.abs(c.low-p.close)));
  }
  let a=tr.slice(0,period).reduce((x,y)=>x+y,0)/period;
  for(let i=period;i<tr.length;i++)a=(a*(period-1)+tr[i])/period;
  return a;
}
export function evaluateIndicatorEntry(candles, now=Date.now()) {
  if(!Array.isArray(candles)||candles.length<35)return {action:'HOLD',reason:'insufficient_candles'};
  if(candles.some(c=>![c.open,c.high,c.low,c.close,c.time].every(Number.isFinite)||c.low<=0||c.high<c.low))return {action:'HOLD',reason:'invalid_candles'};
  const last=candles[candles.length-1];
  const age=now-(last.time+60)*1000;
  if(age< -5000||age>6*60*1000)return {action:'HOLD',reason:'stale_candle',ageMs:age};
  const closes=candles.map(c=>c.close),fast=ema(closes,9),slow=ema(closes,21),strength=rsi(closes,14),volatility=atr(candles,14);
  const atrPct=volatility/last.close*100;
  const movePct=(last.close/closes[closes.length-2]-1)*100;
  const metrics={ema9:fast,ema21:slow,rsi14:strength,atr14:volatility,atrPct,movePct};
  if(!Object.values(metrics).every(Number.isFinite))return {action:'HOLD',reason:'invalid_indicators'};
  if(atrPct<0.04||atrPct>1.5)return {action:'HOLD',reason:'volatility_filter',...metrics};
  if(fast>slow&&strength>=52&&strength<=70&&movePct>=0.04)return {action:'BUY',reason:'ema_rsi_atr_long',...metrics};
  if(fast<slow&&strength<=48&&strength>=30&&movePct<=-0.04)return {action:'SELL',reason:'ema_rsi_atr_short',...metrics};
  return {action:'HOLD',reason:'indicators_not_aligned',...metrics};
}
