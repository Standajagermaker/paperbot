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
