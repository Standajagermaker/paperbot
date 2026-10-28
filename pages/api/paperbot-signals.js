import { evaluateEntry, STRATEGY } from '../../lib/paperbot-strategy';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok: false });
  try {
    const pairs = ['XBTEUR', 'ETHEUR', 'SOLEUR'];
    const data = await Promise.all(pairs.map(async pair => {
      const response = await fetch('https://api.kraken.com/0/public/OHLC?pair=' + pair + '&interval=1', { cache: 'no-store' });
      if (!response.ok) throw new Error('Market data unavailable');
      const json = await response.json();
      if (json.error?.length) throw new Error('Market data unavailable');
      const rows = Object.entries(json.result).find(([key]) => key !== 'last')?.[1];
      if (!Array.isArray(rows) || rows.length < 2) return { pair, action: 'HOLD', reason: 'insufficient_candles' };
      // Use two completed one-minute candles, never the currently forming candle.
      const prev = rows[rows.length - 3];
      const curr = rows[rows.length - 2];
      if (!prev || !curr) return { pair, action: 'HOLD', reason: 'insufficient_completed_candles' };
      const previous = { last: Number(prev[4]) };
      const current = { last: Number(curr[4]), timestamp: new Date(Number(curr[0]) * 1000).toISOString() };
      const result = evaluateEntry(previous, current);
      return { pair, ...result, candle_time: current.timestamp };
    }));
    return res.status(200).json({
      ok: true, mode: 'PAPER', execution: 'DISABLED',
      source: 'Kraken OHLC', interval_minutes: 1,
      threshold_percent: STRATEGY.minMovePct, signals: data
    });
  } catch {
    return res.status(502).json({ ok: false, error: 'Signal calculation unavailable' });
  }
}
