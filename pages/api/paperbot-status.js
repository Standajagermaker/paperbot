import { readTable } from '../../lib/paperbot-db';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ok:false});
  try {
    const accounts = await readTable('paperbot_accounts', 'select=id,auto_enabled&name=eq.main&limit=1');
    const account = accounts[0];
    if (!account) return res.status(200).json({
      ok:false, mode:'PAPER', database:'connected',
      account_main_found:false, ready_for_test:false
    });
    const positions = await readTable('paperbot_positions',
      'select=id&account_id=eq.' + encodeURIComponent(account.id) + '&closed_at=is.null&limit=2');
    return res.status(200).json({
      ok:true, mode:'PAPER', live_orders_enabled:false,
      database:'connected', account_main_found:true,
      auto_enabled:account.auto_enabled,
      open_positions:positions.length,
      run_secret_configured:Boolean(process.env.PAPERBOT_RUN_SECRET),
      ready_for_test:Boolean(process.env.PAPERBOT_RUN_SECRET) && !account.auto_enabled && positions.length === 0
    });
  } catch {
    return res.status(502).json({ok:false,error:'Database status unavailable'});
  }
}
