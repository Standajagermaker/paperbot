import { readTable } from '../../lib/paperbot-db';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok: false });
  try {
    const accounts = await readTable('paperbot_accounts', 'select=*&limit=1');
    return res.status(200).json({
      ok: true,
      mode: 'PAPER',
      live_orders_enabled: false,
      accounts_found: accounts.length,
      database: 'connected'
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: 'Database status unavailable' });
  }
}
