# Connect PaperBot to the existing FREE Supabase project

1. In Supabase FREE open Project Settings > API (or API Keys).
2. Copy the Project URL and the **secret server-side** service_role key.
3. In Vercel > paperbot > Settings > Environment Variables add:
   - SUPABASE_URL = project URL
   - SUPABASE_SERVICE_ROLE_KEY = secret service_role key
4. Apply to Production, then redeploy the latest deployment.
5. Visit https://paperbot-delta.vercel.app/api/paperbot-health

Expected response: `{"ok":true,"status":"connected","accounts_found":1}` (count can be 0 if seed not present).

Do not paste the secret key into chat, GitHub, or client-side code. This endpoint checks connectivity only. The existing browser-only trading engine is NOT yet connected to the database. Before implementing writes, verify exact table columns, RLS and atomic transaction/locking behavior to avoid duplicate trades. Never use service_role in NEXT_PUBLIC_ variables.
