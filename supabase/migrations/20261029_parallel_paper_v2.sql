-- PaperBot V2: parallel fractional PAPER positions.
-- This is a new isolated simulation ledger. Existing PaperBot tables remain unchanged.
create table if not exists public.paperbot_v2_accounts (
 id text primary key default 'main' check(id='main'),
 initial_balance numeric not null default 1000,
 cash_balance numeric not null default 1000,
 max_exposure_eur numeric not null default 500,
 max_position_eur numeric not null default 50,
 fee_rate numeric not null default 0.0025,
 created_at timestamptz not null default now(),
 check(cash_balance>=0),check(max_exposure_eur>0),check(max_position_eur>0)
);
insert into public.paperbot_v2_accounts(id) values('main') on conflict do nothing;
create table if not exists public.paperbot_v2_positions (
 id uuid primary key default gen_random_uuid(),
 symbol text not null check(symbol in ('XBTEUR','WTI','GAS','DAX')),
 side text not null check(side in ('LONG','SHORT')),
 entry_price numeric not null check(entry_price>0),
 quantity numeric not null check(quantity>0),
 margin_eur numeric not null check(margin_eur>0),
 entry_fee_eur numeric not null check(entry_fee_eur>=0),
 opened_at timestamptz not null default now(),
 closed_at timestamptz,
 exit_price numeric,
 exit_fee_eur numeric,
 realized_pnl_eur numeric,
 close_reason text,
 run_key text not null unique
);
create index if not exists paperbot_v2_open_idx on public.paperbot_v2_positions(symbol,opened_at) where closed_at is null;
create or replace function public.paperbot_v2_open(
 p_key text,p_symbol text,p_side text,p_price numeric,p_margin numeric
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare a public.paperbot_v2_accounts%rowtype; exposure numeric; fee numeric; pos_id uuid;
begin
 select * into a from public.paperbot_v2_accounts where id='main' for update;
 if not found then raise exception 'Account missing';end if;
 if p_symbol not in ('XBTEUR','WTI','GAS','DAX') or p_side not in ('LONG','SHORT') or p_price<=0 or p_margin<=0 then raise exception 'Invalid order';end if;
 if exists(select 1 from public.paperbot_v2_positions where run_key=p_key) then return jsonb_build_object('ok',true,'status','duplicate');end if;
 select coalesce(sum(margin_eur),0) into exposure from public.paperbot_v2_positions where closed_at is null;
 fee:=round(p_margin*a.fee_rate,8);
 if p_margin>a.max_position_eur or exposure+p_margin>a.max_exposure_eur or a.cash_balance<p_margin+fee then
   return jsonb_build_object('ok',false,'reason','allocation_limit');
 end if;
 update public.paperbot_v2_accounts set cash_balance=cash_balance-p_margin-fee where id='main';
 insert into public.paperbot_v2_positions(symbol,side,entry_price,quantity,margin_eur,entry_fee_eur,run_key)
 values(p_symbol,p_side,p_price,p_margin/p_price,p_margin,fee,p_key) returning id into pos_id;
 return jsonb_build_object('ok',true,'status','opened','id',pos_id);
end $$;
create or replace function public.paperbot_v2_close(
 p_id uuid,p_price numeric,p_reason text
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare a public.paperbot_v2_accounts%rowtype; p public.paperbot_v2_positions%rowtype; gross numeric; fee numeric; net numeric;
begin
 select * into a from public.paperbot_v2_accounts where id='main' for update;
 select * into p from public.paperbot_v2_positions where id=p_id for update;
 if not found or p.closed_at is not null then return jsonb_build_object('ok',false,'reason','not_open');end if;
 if p_price<=0 then raise exception 'Invalid exit price';end if;
 gross:=(case when p.side='LONG' then p_price-p.entry_price else p.entry_price-p_price end)*p.quantity;
 fee:=round(p_price*p.quantity*a.fee_rate,8);
 net:=gross-p.entry_fee_eur-fee;
 update public.paperbot_v2_positions set closed_at=now(),exit_price=p_price,exit_fee_eur=fee,realized_pnl_eur=net,close_reason=p_reason where id=p_id;
 update public.paperbot_v2_accounts set cash_balance=cash_balance+p.margin_eur+gross-fee where id='main';
 return jsonb_build_object('ok',true,'status','closed','net',net);
end $$;
revoke all on public.paperbot_v2_accounts,public.paperbot_v2_positions from anon,authenticated;
revoke all on function public.paperbot_v2_open(text,text,text,numeric,numeric),public.paperbot_v2_close(uuid,numeric,text) from public,anon,authenticated;
grant all on public.paperbot_v2_accounts,public.paperbot_v2_positions to service_role;
grant execute on function public.paperbot_v2_open(text,text,text,numeric,numeric),public.paperbot_v2_close(uuid,numeric,text) to service_role;
