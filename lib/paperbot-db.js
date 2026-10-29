const allowed = new Set(['paperbot_accounts', 'paperbot_positions', 'paperbot_signals', 'paperbot_runs', 'paperbot_equity_snapshots', 'paperbot_v2_accounts', 'paperbot_v2_positions']);
export async function readTable(table, query = '') {
  if (!allowed.has(table)) throw new Error('Invalid table');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing database configuration');
  const endpoint = new URL('/rest/v1/' + table, url);
  endpoint.search = query;
  const response = await fetch(endpoint, {
    headers: { apikey: key, Authorization: 'Bearer ' + key },
    cache: 'no-store'
  });
  if (!response.ok) throw new Error('Database request failed: ' + response.status);
  return response.json();
}
