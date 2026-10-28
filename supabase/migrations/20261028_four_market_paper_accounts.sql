-- PaperBot four-market PAPER allocation. Run once in Supabase SQL Editor.
-- Safe guard: do not rebalance a main account with existing trades.
begin;
do $$
begin
 if exists(select 1 from public.paperbot_positions p join public.paperbot_accounts a on a.id=p.account_id where a.name='main') then
   raise exception 'Main account already has trade history; manual migration required';
 end if;
 if not exists(select 1 from public.paperbot_accounts where name='main' and initial_balance=1000 and cash_balance=1000) then
   raise exception 'Expected untouched main account with 1000 EUR';
 end if;
end $$;
update public.paperbot_accounts
set initial_balance=250,cash_balance=250,allocation_pct=50,take_profit_eur=5,stop_loss_eur=5
where name='main';
insert into public.paperbot_accounts
(name,initial_balance,cash_balance,currency,auto_enabled,fee_rate,allocation_pct,take_profit_eur,stop_loss_eur)
select x.name,250,250,'EUR',true,0.0025,50,5,5
from (values ('wti'),('gas'),('dax')) as x(name)
where not exists(select 1 from public.paperbot_accounts a where a.name=x.name);
commit;
-- Each of four independent accounts reserves at most 125 EUR at 50% allocation.
-- Existing per-account single-open-position RPC remains valid.
