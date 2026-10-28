export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const rawUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!rawUrl || !key) return res.status(503).json({ok:false,error:'Missing environment variables'});
  let url;
  try {
    url = new URL(rawUrl.trim());
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) throw new Error('Invalid Supabase URL');
  } catch {
    return res.status(503).json({ok:false,error:'Invalid SUPABASE_URL format',hint:'Use https://PROJECT.supabase.co'});
  }
  try {
    const response = await fetch(new URL('/rest/v1/paperbot_accounts?select=id&limit=1',url),{
      headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(8000),cache:'no-store'
    });
    if(!response.ok)return res.status(502).json({ok:false,error:'Supabase HTTP error',status:response.status});
    const data=await response.json();
    return res.status(200).json({ok:true,database:'Supabase FREE',connection:'successful',accounts_found:data.length});
  } catch(e) {
    return res.status(502).json({ok:false,error:'Connection error',type:e?.name==='TimeoutError'?'timeout':'network_or_runtime'});
  }
}
