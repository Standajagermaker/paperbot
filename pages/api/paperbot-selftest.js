import { readTable } from '../../lib/paperbot-db';

async function rpc(name, payload) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error('Database configuration missing');
  const response = await fetch(new URL('/rest/v1/rpc/' + name, base), {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store'
  });
  if (!response.ok) throw new Error('Database operation failed: HTTP ' + response.status);
  return response.json();
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ok:false, error:'POST required'});
  const secret = process.env.PAPERBOT_RUN_SECRET;
  if (!secret || req.headers.authorization !== 'Bearer ' + secret)
    return res.status(401).json({ok:false, error:'Unauthorized'});

  try {
    const accounts = await readTable('paperbot_accounts', 'select=id,auto_enabled&name=eq.main&limit=1');
    const account = accounts[0];
    if (!account || account.auto_enabled)
      return res.status(409).json({ok:false,error:'Account missing or automation enabled'});
    const positions = await readTable('paperbot_positions',
      'select=id&account_id=eq.' + encodeURIComponent(account.id) + '&closed_at=is.null&limit=1');
    if (positions.length)
      return res.status(409).json({ok:false,error:'An open position already exists'});

    // Test a complete lifecycle in one request. Uses a unique run key to avoid replay.
    // No broker orders are ever placed.
    const run = crypto.randomUUID();
    const opened = await rpc('paperbot_open_position', {
      p_account_id: account.id,
      p_run_key: 'selftest:open:' + run,
      p_symbol: 'XBTEUR',
      p_side: 'LONG',
      p_price: 100000
    });
    if (!opened.ok)
      return res.status(409).json({ok:false,phase:'open',result:opened});
    const closed = await rpc('paperbot_close_position', {
      p_account_id: account.id,
      p_run_key: 'selftest:close:' + run,
      p_position_id: opened.position_id,
      p_exit_price: 100000,
      p_reason: 'selftest'
    });
    if (!closed.ok)
      return res.status(502).json({ok:false,phase:'close',result:closed,position_id:opened.position_id});
    return res.status(200).json({
      ok:true,mode:'PAPER',test:'open_and_close',
      symbol:'XBTEUR',opened,closed,
      note:'Test uses a fixed synthetic price and incurs simulated fees.'
    });
  } catch {
    return res.status(502).json({ok:false,error:'PaperBot self-test failed; inspect database logs'});
  }
}
