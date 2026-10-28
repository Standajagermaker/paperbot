
export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return res.status(503).json({
      ok: false,
      error: "Missing Supabase environment variables"
    });
  }

  try {
    const response = await fetch(
      `${url}/rest/v1/paperbot_accounts?select=id&limit=1`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`
        }
      }
    );

    if (!response.ok) {
      return res.status(502).json({
        ok: false,
        error: "Supabase connection failed",
        status: response.status
      });
    }

    return res.status(200).json({
      ok: true,
      database: "Supabase FREE",
      connection: "successful"
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "Connection error"
    });
  }
}
