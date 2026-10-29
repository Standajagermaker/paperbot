-- Run once in Supabase SQL Editor. Adds persistent automatic trading switch.
alter table public.paperbot_v2_accounts add column if not exists auto_enabled boolean not null default false;
update public.paperbot_v2_accounts set auto_enabled=false where id='main';
