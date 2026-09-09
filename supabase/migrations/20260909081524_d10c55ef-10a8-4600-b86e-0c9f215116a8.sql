-- =========================================================
-- SQs EXCHANGE — schema, ledger de dupla entrada, matching engine
-- Aditivo: nenhuma tabela ou função existente é alterada.
-- =========================================================

-- ---------- Mercados ----------
create table public.exchange_markets (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    name text not null,
    environment text not null default 'PAPER' check (environment in ('PAPER','LIVE')),
    status text not null default 'CLOSED' check (status in ('PRE_OPEN','OPEN','PAUSED','CLOSED')),
    timezone text not null default 'Africa/Maputo',
    opens_at time not null default '09:00',
    closes_at time not null default '15:00',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
grant select on public.exchange_markets to anon, authenticated;
grant all on public.exchange_markets to service_role;
alter table public.exchange_markets enable row level security;
create policy "markets public read" on public.exchange_markets for select using (true);

create table public.market_sessions (
    id uuid primary key default gen_random_uuid(),
    market_id uuid not null references public.exchange_markets(id) on delete cascade,
    status text not null check (status in ('PRE_OPEN','OPEN','PAUSED','CLOSED')),
    note text,
    changed_by uuid references auth.users(id),
    created_at timestamptz not null default now()
);
create index market_sessions_market_idx on public.market_sessions (market_id, created_at desc);
grant select on public.market_sessions to authenticated;
grant all on public.market_sessions to service_role;
alter table public.market_sessions enable row level security;
create policy "sessions admin read" on public.market_sessions for select to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- ---------- Ativos ----------
create table public.exchange_assets (
    id uuid primary key default gen_random_uuid(),
    market_id uuid not null references public.exchange_markets(id),
    company_id uuid references public.companies(id),
    symbol text not null unique,
    name text not null,
    asset_type text not null default 'EQUITY'
        check (asset_type in ('EQUITY','BOND','TREASURY_BOND','COMMERCIAL_PAPER','FUND','OTHER')),
    country text not null default 'MZ',
    currency text not null default 'MZN',
    status text not null default 'ACTIVE' check (status in ('ACTIVE','SUSPENDED','DELISTED')),
    tick_size numeric(18,4) not null default 0.01 check (tick_size > 0),
    lot_size integer not null default 1 check (lot_size > 0),
    logo_url text,
    description text,
    issuer_info text,
    is_demo boolean not null default true,
    environment text not null default 'PAPER' check (environment in ('PAPER','LIVE')),
    created_by uuid references auth.users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index exchange_assets_market_idx on public.exchange_assets (market_id, status);
grant select on public.exchange_assets to anon, authenticated;
grant all on public.exchange_assets to service_role;
alter table public.exchange_assets enable row level security;
create policy "assets public read" on public.exchange_assets for select using (true);

create table public.market_data (
    asset_id uuid primary key references public.exchange_assets(id) on delete cascade,
    last_price numeric(18,4),
    prev_close numeric(18,4),
    day_high numeric(18,4),
    day_low numeric(18,4),
    volume numeric(18,2) not null default 0,
    trades_count integer not null default 0,
    updated_at timestamptz not null default now()
);
grant select on public.market_data to anon, authenticated;
grant all on public.market_data to service_role;
alter table public.market_data enable row level security;
create policy "market data public read" on public.market_data for select using (true);

-- ---------- Contas de investimento ----------
create table public.investment_accounts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    environment text not null default 'PAPER' check (environment in ('PAPER','LIVE')),
    account_type text not null default 'PAPER_INVESTMENT_ACCOUNT',
    status text not null default 'active' check (status in ('active','suspended','closed')),
    currency text not null default 'MZN',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, environment)
);
grant select on public.investment_accounts to authenticated;
grant all on public.investment_accounts to service_role;
alter table public.investment_accounts enable row level security;
create policy "accounts owner read" on public.investment_accounts for select to authenticated
using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

-- ---------- Ledger de dupla entrada ----------
create table public.ledger_accounts (
    id uuid primary key default gen_random_uuid(),
    account_id uuid references public.investment_accounts(id) on delete cascade,
    user_id uuid references auth.users(id) on delete cascade,
    code text not null,
    kind text not null check (kind in ('CASH','RESERVED_CASH','SECURITIES','FEES','EXTERNAL','PNL')),
    currency text not null default 'MZN',
    created_at timestamptz not null default now()
);
create unique index ledger_accounts_code_idx on public.ledger_accounts (code);
create index ledger_accounts_account_idx on public.ledger_accounts (account_id, kind);
grant select on public.ledger_accounts to authenticated;
grant all on public.ledger_accounts to service_role;
alter table public.ledger_accounts enable row level security;
create policy "ledger accounts owner read" on public.ledger_accounts for select to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create table public.ledger_transactions (
    id uuid primary key default gen_random_uuid(),
    reference text not null unique,
    reference_type text not null,
    reference_id uuid,
    description text,
    created_at timestamptz not null default now()
);
grant select on public.ledger_transactions to authenticated;
grant all on public.ledger_transactions to service_role;
alter table public.ledger_transactions enable row level security;

create table public.ledger_entries (
    id uuid primary key default gen_random_uuid(),
    transaction_id uuid not null references public.ledger_transactions(id) on delete cascade,
    ledger_account_id uuid not null references public.ledger_accounts(id),
    debit numeric(18,4) not null default 0 check (debit >= 0),
    credit numeric(18,4) not null default 0 check (credit >= 0),
    currency text not null default 'MZN',
    created_at timestamptz not null default now(),
    check (debit = 0 or credit = 0),
    check (debit > 0 or credit > 0)
);
create index ledger_entries_tx_idx on public.ledger_entries (transaction_id);
create index ledger_entries_account_idx on public.ledger_entries (ledger_account_id, created_at desc);
grant select on public.ledger_entries to authenticated;
grant all on public.ledger_entries to service_role;
alter table public.ledger_entries enable row level security;
create policy "ledger entries read own" on public.ledger_entries for select to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or exists (
    select 1 from public.ledger_accounts a
     where a.id = ledger_entries.ledger_account_id and a.user_id = auth.uid()
  )
);

create trigger ledger_entries_immutable
before update or delete on public.ledger_entries
for each row execute function public.reject_ledger_mutation();

create policy "ledger tx read own" on public.ledger_transactions for select to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or exists (
    select 1 from public.ledger_entries e
      join public.ledger_accounts a on a.id = e.ledger_account_id
     where e.transaction_id = ledger_transactions.id and a.user_id = auth.uid()
  )
);

create trigger ledger_transactions_immutable
before update or delete on public.ledger_transactions
for each row execute function public.reject_ledger_mutation();

-- ---------- Ordens ----------
create table public.exchange_orders (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    account_id uuid not null references public.investment_accounts(id) on delete cascade,
    asset_id uuid not null references public.exchange_assets(id),
    environment text not null default 'PAPER' check (environment in ('PAPER','LIVE')),
    side text not null check (side in ('BUY','SELL')),
    order_type text not null check (order_type in ('MARKET','LIMIT')),
    quantity numeric(18,4) not null check (quantity > 0),
    filled_quantity numeric(18,4) not null default 0 check (filled_quantity >= 0),
    remaining_quantity numeric(18,4) not null check (remaining_quantity >= 0),
    limit_price numeric(18,4) check (limit_price is null or limit_price > 0),
    avg_fill_price numeric(18,4),
    status text not null default 'PENDING'
        check (status in ('PENDING','OPEN','PARTIALLY_FILLED','FILLED','CANCELLED','REJECTED','EXPIRED')),
    reserved_amount numeric(18,4) not null default 0 check (reserved_amount >= 0),
    reserved_quantity numeric(18,4) not null default 0 check (reserved_quantity >= 0),
    idempotency_key text not null unique,
    reject_reason text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    cancelled_at timestamptz
);
create index exchange_orders_book_idx
    on public.exchange_orders (asset_id, side, status, limit_price, created_at);
create index exchange_orders_user_idx on public.exchange_orders (user_id, created_at desc);
grant select on public.exchange_orders to authenticated;
grant all on public.exchange_orders to service_role;
alter table public.exchange_orders enable row level security;
create policy "orders owner read" on public.exchange_orders for select to authenticated
using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create table public.order_events (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.exchange_orders(id) on delete cascade,
    from_status text,
    to_status text not null,
    note text,
    metadata jsonb not null default '{}',
    created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);
grant select on public.order_events to authenticated;
grant all on public.order_events to service_role;
alter table public.order_events enable row level security;
create policy "order events owner read" on public.order_events for select to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or exists (select 1 from public.exchange_orders o where o.id = order_events.order_id and o.user_id = auth.uid())
);
create trigger order_events_immutable
before update or delete on public.order_events
for each row execute function public.reject_ledger_mutation();

-- ---------- Negócios ----------
create table public.trades (
    id uuid primary key default gen_random_uuid(),
    asset_id uuid not null references public.exchange_assets(id),
    environment text not null default 'PAPER',
    buy_order_id uuid not null references public.exchange_orders(id),
    sell_order_id uuid not null references public.exchange_orders(id),
    buyer_account_id uuid not null references public.investment_accounts(id),
    seller_account_id uuid not null references public.investment_accounts(id),
    buyer_id uuid not null references auth.users(id),
    seller_id uuid not null references auth.users(id),
    price numeric(18,4) not null check (price > 0),
    quantity numeric(18,4) not null check (quantity > 0),
    gross_value numeric(18,4) not null,
    buyer_fee numeric(18,4) not null default 0,
    seller_fee numeric(18,4) not null default 0,
    net_buyer_value numeric(18,4) not null,
    net_seller_value numeric(18,4) not null,
    settlement_status text not null default 'SETTLED'
        check (settlement_status in ('PENDING','SETTLED','FAILED')),
    reference text not null unique,
    executed_at timestamptz not null default now()
);
create index trades_asset_idx on public.trades (asset_id, executed_at desc);
create index trades_buyer_idx on public.trades (buyer_id, executed_at desc);
create index trades_seller_idx on public.trades (seller_id, executed_at desc);
grant select on public.trades to anon, authenticated;
grant all on public.trades to service_role;
alter table public.trades enable row level security;
-- fita pública: preço/quantidade são informação de mercado
create policy "trades public read" on public.trades for select using (true);

-- ---------- Posições ----------
create table public.positions (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references public.investment_accounts(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    asset_id uuid not null references public.exchange_assets(id),
    quantity numeric(18,4) not null default 0 check (quantity >= 0),
    reserved_quantity numeric(18,4) not null default 0 check (reserved_quantity >= 0),
    avg_price numeric(18,4) not null default 0 check (avg_price >= 0),
    realized_pnl numeric(18,4) not null default 0,
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    unique (account_id, asset_id),
    check (reserved_quantity <= quantity)
);
grant select on public.positions to authenticated;
grant all on public.positions to service_role;
alter table public.positions enable row level security;
create policy "positions owner read" on public.positions for select to authenticated
using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

-- ---------- Transferências entre carteira e conta de mercado ----------
create table public.exchange_transfers (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    account_id uuid not null references public.investment_accounts(id) on delete cascade,
    direction text not null check (direction in ('IN','OUT')),
    source text not null check (source in ('INVESTMENT_WALLET','PAPER_GRANT')),
    amount numeric(18,4) not null check (amount > 0),
    status text not null default 'COMPLETED'
        check (status in ('PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED')),
    reference text not null unique,
    idempotency_key text not null unique,
    failure_reason text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index exchange_transfers_user_idx on public.exchange_transfers (user_id, created_at desc);
grant select on public.exchange_transfers to authenticated;
grant all on public.exchange_transfers to service_role;
alter table public.exchange_transfers enable row level security;
create policy "transfers owner read" on public.exchange_transfers for select to authenticated
using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

-- ---------- Taxas, risco, watchlist, auditoria ----------
create table public.fee_configs (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    name text not null,
    percent numeric(8,5) not null default 0 check (percent >= 0 and percent < 1),
    fixed numeric(18,4) not null default 0 check (fixed >= 0),
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
grant select on public.fee_configs to anon, authenticated;
grant all on public.fee_configs to service_role;
alter table public.fee_configs enable row level security;
create policy "fees public read" on public.fee_configs for select using (true);

create table public.risk_limits (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    max_order_value numeric(18,2) not null default 500000,
    max_position_value numeric(18,2) not null default 2000000,
    max_daily_volume numeric(18,2) not null default 2000000,
    max_open_orders integer not null default 50,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create unique index risk_limits_global_idx on public.risk_limits ((user_id is null)) where user_id is null;
create unique index risk_limits_user_idx on public.risk_limits (user_id) where user_id is not null;
grant select on public.risk_limits to authenticated;
grant all on public.risk_limits to service_role;
alter table public.risk_limits enable row level security;
create policy "risk limits read" on public.risk_limits for select to authenticated
using (user_id is null or user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create table public.risk_alerts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    kind text not null check (kind in ('HIGH_RISK','LIMIT_EXCEEDED','SUSPICIOUS_ACTIVITY')),
    message text not null,
    metadata jsonb not null default '{}',
    created_at timestamptz not null default now()
);
create index risk_alerts_created_idx on public.risk_alerts (created_at desc);
grant select on public.risk_alerts to authenticated;
grant all on public.risk_alerts to service_role;
alter table public.risk_alerts enable row level security;
create policy "risk alerts read" on public.risk_alerts for select to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create table public.watchlists (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    asset_id uuid not null references public.exchange_assets(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (user_id, asset_id)
);
grant select, insert, delete on public.watchlists to authenticated;
grant all on public.watchlists to service_role;
alter table public.watchlists enable row level security;
create policy "watchlist owner read" on public.watchlists for select to authenticated
using (auth.uid() = user_id);
create policy "watchlist owner insert" on public.watchlists for insert to authenticated
with check (auth.uid() = user_id);
create policy "watchlist owner delete" on public.watchlists for delete to authenticated
using (auth.uid() = user_id);

create table public.audit_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete set null,
    action text not null,
    entity text,
    entity_id uuid,
    metadata jsonb not null default '{}',
    created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "audit admin read" on public.audit_logs for select to authenticated
using (public.has_role(auth.uid(), 'admin'));
create trigger audit_logs_immutable
before update or delete on public.audit_logs
for each row execute function public.reject_ledger_mutation();

create trigger exchange_markets_updated before update on public.exchange_markets
for each row execute function public.set_updated_at();
create trigger exchange_assets_updated before update on public.exchange_assets
for each row execute function public.set_updated_at();
create trigger exchange_orders_updated before update on public.exchange_orders
for each row execute function public.set_updated_at();
create trigger positions_updated before update on public.positions
for each row execute function public.set_updated_at();
create trigger exchange_transfers_updated before update on public.exchange_transfers
for each row execute function public.set_updated_at();
create trigger fee_configs_updated before update on public.fee_configs
for each row execute function public.set_updated_at();
create trigger risk_limits_updated before update on public.risk_limits
for each row execute function public.set_updated_at();

-- =========================================================
-- FUNÇÕES
-- =========================================================

create or replace function public.exchange_audit(
    _user_id uuid, _action text, _entity text, _entity_id uuid, _metadata jsonb default '{}'
) returns void language plpgsql security definer set search_path = public as $fn$
begin
    insert into public.audit_logs (user_id, action, entity, entity_id, metadata)
    values (_user_id, _action, _entity, _entity_id, coalesce(_metadata, '{}'));
end;
$fn$;

create or replace function public.exchange_platform_account(_kind text)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare _id uuid; _code text := 'PLATFORM:' || _kind;
begin
    select id into _id from public.ledger_accounts where code = _code;
    if _id is null then
        insert into public.ledger_accounts (code, kind) values (_code, _kind)
        on conflict (code) do nothing;
        select id into _id from public.ledger_accounts where code = _code;
    end if;
    return _id;
end;
$fn$;

create or replace function public.exchange_ensure_account(_user_id uuid, _env text default 'PAPER')
returns uuid language plpgsql security definer set search_path = public as $fn$
declare _id uuid; _k text;
begin
    select id into _id from public.investment_accounts
     where user_id = _user_id and environment = _env;
    if _id is null then
        insert into public.investment_accounts (user_id, environment, account_type)
        values (_user_id, _env, _env || '_INVESTMENT_ACCOUNT')
        on conflict (user_id, environment) do nothing;
        select id into _id from public.investment_accounts
         where user_id = _user_id and environment = _env;
    end if;

    foreach _k in array array['CASH','RESERVED_CASH','SECURITIES','PNL'] loop
        insert into public.ledger_accounts (account_id, user_id, code, kind)
        values (_id, _user_id, _k || ':' || _id::text, _k)
        on conflict (code) do nothing;
    end loop;

    return _id;
end;
$fn$;

create or replace function public.exchange_ledger_account(_account_id uuid, _kind text)
returns uuid language sql stable security definer set search_path = public as $fn$
    select id from public.ledger_accounts where code = _kind || ':' || _account_id::text
$fn$;

-- Lançamento atómico de dupla entrada. Idempotente por reference.
create or replace function public.exchange_ledger_post(
    _reference text, _reference_type text, _reference_id uuid, _entries jsonb, _description text default null
) returns uuid language plpgsql security definer set search_path = public as $fn$
declare
    _tx uuid;
    _item jsonb;
    _debits numeric(18,4) := 0;
    _credits numeric(18,4) := 0;
begin
    select id into _tx from public.ledger_transactions where reference = _reference;
    if found then return _tx; end if;

    for _item in select * from jsonb_array_elements(_entries) loop
        _debits := _debits + coalesce((_item->>'debit')::numeric, 0);
        _credits := _credits + coalesce((_item->>'credit')::numeric, 0);
    end loop;
    if round(_debits, 4) <> round(_credits, 4) then
        raise exception 'ledger desequilibrado: debitos % creditos %', _debits, _credits;
    end if;

    insert into public.ledger_transactions (reference, reference_type, reference_id, description)
    values (_reference, _reference_type, _reference_id, _description)
    returning id into _tx;

    for _item in select * from jsonb_array_elements(_entries) loop
        insert into public.ledger_entries (transaction_id, ledger_account_id, debit, credit)
        values (_tx, (_item->>'account')::uuid,
                coalesce((_item->>'debit')::numeric, 0),
                coalesce((_item->>'credit')::numeric, 0));
    end loop;

    return _tx;
end;
$fn$;

create or replace function public.exchange_balance(_ledger_account_id uuid)
returns numeric language sql stable security definer set search_path = public as $fn$
    select coalesce(round(sum(debit - credit), 4), 0)
      from public.ledger_entries where ledger_account_id = _ledger_account_id
$fn$;

-- Saldo derivado do ledger (nunca guardado como campo mutável)
create or replace function public.exchange_cash(_account_id uuid)
returns table(available numeric, reserved numeric, securities numeric)
language sql stable security definer set search_path = public as $fn$
    select public.exchange_balance(public.exchange_ledger_account(_account_id, 'CASH')),
           public.exchange_balance(public.exchange_ledger_account(_account_id, 'RESERVED_CASH')),
           public.exchange_balance(public.exchange_ledger_account(_account_id, 'SECURITIES'))
$fn$;

-- Livro de ordens agregado (as ordens em si permanecem privadas)
create or replace function public.exchange_order_book(_asset_id uuid, _depth integer default 10)
returns table(side text, price numeric, quantity numeric, orders integer)
language sql stable security definer set search_path = public as $fn$
    (select o.side, o.limit_price as price, sum(o.remaining_quantity) as quantity, count(*)::int as orders
       from public.exchange_orders o
      where o.asset_id = _asset_id and o.side = 'BUY'
        and o.status in ('OPEN','PARTIALLY_FILLED') and o.limit_price is not null
      group by o.side, o.limit_price order by o.limit_price desc limit _depth)
    union all
    (select o.side, o.limit_price as price, sum(o.remaining_quantity) as quantity, count(*)::int as orders
       from public.exchange_orders o
      where o.asset_id = _asset_id and o.side = 'SELL'
        and o.status in ('OPEN','PARTIALLY_FILLED') and o.limit_price is not null
      group by o.side, o.limit_price order by o.limit_price asc limit _depth)
$fn$;
grant execute on function public.exchange_order_book(uuid, integer) to anon, authenticated;

-- Financiar conta de simulação (dinheiro fictício, nunca real)
create or replace function public.exchange_grant_paper_cash(
    _user_id uuid, _amount numeric, _idempotency_key text
) returns exchange_transfers language plpgsql security definer set search_path = public as $fn$
declare _row public.exchange_transfers; _acc uuid; _ref text;
begin
    select * into _row from public.exchange_transfers where idempotency_key = _idempotency_key;
    if found then return _row; end if;
    if _amount is null or _amount <= 0 or _amount > 1000000 then
        raise exception 'montante de simulacao invalido';
    end if;

    _acc := public.exchange_ensure_account(_user_id, 'PAPER');
    _ref := 'xpaper:' || gen_random_uuid()::text;

    insert into public.exchange_transfers (user_id, account_id, direction, source, amount, reference, idempotency_key)
    values (_user_id, _acc, 'IN', 'PAPER_GRANT', _amount, _ref, _idempotency_key)
    returning * into _row;

    perform public.exchange_ledger_post(
        _ref, 'PAPER_GRANT', _row.id,
        jsonb_build_array(
            jsonb_build_object('account', public.exchange_ledger_account(_acc, 'CASH'), 'debit', _amount),
            jsonb_build_object('account', public.exchange_platform_account('EXTERNAL'), 'credit', _amount)
        ),
        'Crédito de simulação (paper trading)'
    );

    perform public.exchange_audit(_user_id, 'paper_cash_granted', 'exchange_transfers', _row.id,
        jsonb_build_object('amount', _amount));
    return _row;
end;
$fn$;

-- Transferência real: carteira de investimentos <-> conta LIVE do mercado
create or replace function public.exchange_transfer_wallet(
    _user_id uuid, _direction text, _amount numeric, _idempotency_key text
) returns exchange_transfers language plpgsql security definer set search_path = public as $fn$
declare _row public.exchange_transfers; _acc uuid; _wallet uuid; _ref text; _cash numeric;
begin
    select * into _row from public.exchange_transfers where idempotency_key = _idempotency_key;
    if found then return _row; end if;
    if _direction not in ('IN','OUT') then raise exception 'direcao invalida'; end if;
    if _amount is null or _amount <= 0 then raise exception 'montante invalido'; end if;

    _acc := public.exchange_ensure_account(_user_id, 'LIVE');
    _wallet := public.ensure_wallet(_user_id, 'investment');
    _ref := 'xtransfer:' || gen_random_uuid()::text;

    insert into public.exchange_transfers (user_id, account_id, direction, source, amount, reference, idempotency_key)
    values (_user_id, _acc, _direction, 'INVESTMENT_WALLET', _amount, _ref, _idempotency_key)
    returning * into _row;

    if _direction = 'IN' then
        perform public.wallet_apply(_wallet, 'transfer_out', -_amount, _ref || ':w', null, null,
            jsonb_build_object('to', 'exchange'));
        perform public.exchange_ledger_post(_ref, 'EXCHANGE_DEPOSIT', _row.id,
            jsonb_build_array(
                jsonb_build_object('account', public.exchange_ledger_account(_acc, 'CASH'), 'debit', _amount),
                jsonb_build_object('account', public.exchange_platform_account('EXTERNAL'), 'credit', _amount)));
    else
        select available into _cash from public.exchange_cash(_acc);
        if _cash < _amount then raise exception 'saldo disponivel insuficiente na conta de mercado'; end if;
        perform public.exchange_ledger_post(_ref, 'EXCHANGE_WITHDRAWAL', _row.id,
            jsonb_build_array(
                jsonb_build_object('account', public.exchange_platform_account('EXTERNAL'), 'debit', _amount),
                jsonb_build_object('account', public.exchange_ledger_account(_acc, 'CASH'), 'credit', _amount)));
        perform public.wallet_apply(_wallet, 'transfer_in', _amount, _ref || ':w', null, null,
            jsonb_build_object('from', 'exchange'));
    end if;

    perform public.exchange_audit(_user_id,
        case when _direction = 'IN' then 'exchange_deposit' else 'exchange_withdrawal' end,
        'exchange_transfers', _row.id, jsonb_build_object('amount', _amount));
    return _row;
end;
$fn$;

-- Execução de um negócio entre duas ordens (chamado apenas pelo matching engine)
create or replace function public.exchange_execute_trade(
    _buy_id uuid, _sell_id uuid, _price numeric, _quantity numeric
) returns trades language plpgsql security definer set search_path = public as $fn$
declare
    _buy public.exchange_orders; _sell public.exchange_orders;
    _asset public.exchange_assets;
    _fee_pct numeric := 0; _gross numeric; _bfee numeric; _sfee numeric;
    _trade public.trades; _ref text := 'xtrade:' || gen_random_uuid()::text;
    _entries jsonb; _release numeric := 0; _reserved_per_unit numeric;
    _pos public.positions; _cost numeric;
begin
    select * into _buy from public.exchange_orders where id = _buy_id;
    select * into _sell from public.exchange_orders where id = _sell_id;
    select * into _asset from public.exchange_assets where id = _buy.asset_id;

    select coalesce(percent, 0) into _fee_pct from public.fee_configs
     where code = 'TRADING' and active = true;
    _fee_pct := coalesce(_fee_pct, 0);

    _gross := round(_price * _quantity, 4);
    _bfee := round(_gross * _fee_pct, 4);
    _sfee := round(_gross * _fee_pct, 4);

    insert into public.trades (
        asset_id, environment, buy_order_id, sell_order_id, buyer_account_id, seller_account_id,
        buyer_id, seller_id, price, quantity, gross_value, buyer_fee, seller_fee,
        net_buyer_value, net_seller_value, reference
    ) values (
        _buy.asset_id, _buy.environment, _buy_id, _sell_id, _buy.account_id, _sell.account_id,
        _buy.user_id, _sell.user_id, _price, _quantity, _gross, _bfee, _sfee,
        _gross + _bfee, _gross - _sfee, _ref
    ) returning * into _trade;

    -- Comprador: reserva -> títulos + taxa
    _entries := jsonb_build_array(
        jsonb_build_object('account', public.exchange_ledger_account(_buy.account_id, 'SECURITIES'), 'debit', _gross),
        jsonb_build_object('account', public.exchange_platform_account('FEES'), 'debit', _bfee),
        jsonb_build_object('account', public.exchange_ledger_account(_buy.account_id, 'RESERVED_CASH'), 'credit', _gross + _bfee)
    );
    perform public.exchange_ledger_post(_ref || ':buy', 'TRADE_BUY', _trade.id, _entries, 'Compra executada');

    -- Vendedor: títulos -> caixa - taxa
    _entries := jsonb_build_array(
        jsonb_build_object('account', public.exchange_ledger_account(_sell.account_id, 'CASH'), 'debit', _gross - _sfee),
        jsonb_build_object('account', public.exchange_platform_account('FEES'), 'debit', _sfee),
        jsonb_build_object('account', public.exchange_ledger_account(_sell.account_id, 'SECURITIES'), 'credit', _gross)
    );
    perform public.exchange_ledger_post(_ref || ':sell', 'TRADE_SELL', _trade.id, _entries, 'Venda executada');

    -- Libertar excesso de reserva do comprador (limite acima do preço executado)
    _reserved_per_unit := case when _buy.quantity > 0 then round(_buy.reserved_amount / _buy.quantity, 6) else 0 end;
    _release := round(_reserved_per_unit * _quantity - (_gross + _bfee), 4);
    if _release > 0 then
        perform public.exchange_ledger_post(_ref || ':rel', 'RESERVE_RELEASE', _trade.id,
            jsonb_build_array(
                jsonb_build_object('account', public.exchange_ledger_account(_buy.account_id, 'CASH'), 'debit', _release),
                jsonb_build_object('account', public.exchange_ledger_account(_buy.account_id, 'RESERVED_CASH'), 'credit', _release)));
    else
        _release := 0;
    end if;

    -- Ordens
    update public.exchange_orders set
        filled_quantity = filled_quantity + _quantity,
        remaining_quantity = remaining_quantity - _quantity,
        reserved_amount = greatest(0, reserved_amount - (_gross + _bfee) - _release),
        avg_fill_price = round(((coalesce(avg_fill_price,0) * filled_quantity) + _price * _quantity)
                               / (filled_quantity + _quantity), 4),
        status = case when remaining_quantity - _quantity <= 0 then 'FILLED' else 'PARTIALLY_FILLED' end
     where id = _buy_id;

    update public.exchange_orders set
        filled_quantity = filled_quantity + _quantity,
        remaining_quantity = remaining_quantity - _quantity,
        reserved_quantity = greatest(0, reserved_quantity - _quantity),
        avg_fill_price = round(((coalesce(avg_fill_price,0) * filled_quantity) + _price * _quantity)
                               / (filled_quantity + _quantity), 4),
        status = case when remaining_quantity - _quantity <= 0 then 'FILLED' else 'PARTIALLY_FILLED' end
     where id = _sell_id;

    insert into public.order_events (order_id, from_status, to_status, note, metadata)
    values (_buy_id, _buy.status, 'FILL', 'execução', jsonb_build_object('trade_id', _trade.id, 'quantity', _quantity, 'price', _price)),
           (_sell_id, _sell.status, 'FILL', 'execução', jsonb_build_object('trade_id', _trade.id, 'quantity', _quantity, 'price', _price));

    -- Posição do comprador
    select * into _pos from public.positions
     where account_id = _buy.account_id and asset_id = _buy.asset_id for update;
    if not found then
        insert into public.positions (account_id, user_id, asset_id, quantity, avg_price)
        values (_buy.account_id, _buy.user_id, _buy.asset_id, _quantity, round((_gross + _bfee)/_quantity, 4));
    else
        update public.positions set
            quantity = _pos.quantity + _quantity,
            avg_price = round(((_pos.avg_price * _pos.quantity) + _gross + _bfee) / (_pos.quantity + _quantity), 4)
         where id = _pos.id;
    end if;

    -- Posição do vendedor
    select * into _pos from public.positions
     where account_id = _sell.account_id and asset_id = _sell.asset_id for update;
    if found then
        _cost := round(_pos.avg_price * _quantity, 4);
        update public.positions set
            quantity = greatest(0, _pos.quantity - _quantity),
            reserved_quantity = greatest(0, _pos.reserved_quantity - _quantity),
            realized_pnl = _pos.realized_pnl + ((_gross - _sfee) - _cost)
         where id = _pos.id;
    end if;

    -- Cotação: só preços de negócios reais da plataforma
    insert into public.market_data (asset_id, last_price, prev_close, day_high, day_low, volume, trades_count, updated_at)
    values (_buy.asset_id, _price, _price, _price, _price, _quantity, 1, now())
    on conflict (asset_id) do update set
        prev_close = coalesce(public.market_data.prev_close, public.market_data.last_price),
        last_price = _price,
        day_high = greatest(coalesce(public.market_data.day_high, _price), _price),
        day_low = least(coalesce(public.market_data.day_low, _price), _price),
        volume = public.market_data.volume + _quantity,
        trades_count = public.market_data.trades_count + 1,
        updated_at = now();

    insert into public.notifications (user_id, category, title, body, metadata)
    values (_buy.user_id, 'exchange', 'Compra executada',
            _quantity || ' ' || _asset.symbol || ' a ' || _price || ' MZN',
            jsonb_build_object('trade_id', _trade.id)),
           (_sell.user_id, 'exchange', 'Venda executada',
            _quantity || ' ' || _asset.symbol || ' a ' || _price || ' MZN',
            jsonb_build_object('trade_id', _trade.id));

    perform public.exchange_audit(_buy.user_id, 'trade_executed', 'trades', _trade.id,
        jsonb_build_object('price', _price, 'quantity', _quantity));

    return _trade;
end;
$fn$;

-- Criação de ordem: validação + reserva + matching, tudo atómico
create or replace function public.exchange_create_order(
    _user_id uuid, _asset_id uuid, _side text, _order_type text,
    _quantity numeric, _limit_price numeric, _idempotency_key text, _env text default 'PAPER'
) returns exchange_orders language plpgsql security definer set search_path = public as $fn$
declare
    _order public.exchange_orders;
    _asset public.exchange_assets;
    _market public.exchange_markets;
    _acc uuid; _acc_row public.investment_accounts;
    _limits public.risk_limits;
    _open integer; _avail numeric; _pos public.positions;
    _ref_price numeric; _reserve numeric; _fee_pct numeric := 0;
    _maker public.exchange_orders; _qty numeric; _price numeric;
    _remaining numeric; _released numeric;
begin
    select * into _order from public.exchange_orders where idempotency_key = _idempotency_key;
    if found then return _order; end if;

    if _side not in ('BUY','SELL') then raise exception 'lado invalido'; end if;
    if _order_type not in ('MARKET','LIMIT') then raise exception 'tipo de ordem invalido'; end if;

    select * into _asset from public.exchange_assets where id = _asset_id for update;
    if not found then raise exception 'ativo inexistente'; end if;
    if _asset.status <> 'ACTIVE' then raise exception 'ativo nao negociavel'; end if;
    if _asset.environment <> _env then raise exception 'ambiente do ativo nao corresponde'; end if;

    select * into _market from public.exchange_markets where id = _asset.market_id;
    if _market.status <> 'OPEN' then raise exception 'mercado fechado'; end if;

    if _quantity is null or _quantity <= 0 then raise exception 'quantidade invalida'; end if;
    if (_quantity)::numeric % _asset.lot_size <> 0 then
        raise exception 'quantidade deve ser multiplo de %', _asset.lot_size;
    end if;
    if _order_type = 'LIMIT' then
        if _limit_price is null or _limit_price <= 0 then raise exception 'preco limite invalido'; end if;
        if round(_limit_price / _asset.tick_size) * _asset.tick_size <> round(_limit_price, 4) then
            raise exception 'preco deve ser multiplo de %', _asset.tick_size;
        end if;
    end if;

    _acc := public.exchange_ensure_account(_user_id, _env);
    select * into _acc_row from public.investment_accounts where id = _acc for update;
    if _acc_row.status <> 'active' then raise exception 'conta suspensa'; end if;

    if _env = 'LIVE' then
        if not exists (select 1 from public.kyc_profiles where user_id = _user_id and status = 'approved') then
            raise exception 'verificacao de identidade (KYC) nao aprovada';
        end if;
    end if;

    select * into _limits from public.risk_limits where user_id = _user_id and active = true;
    if not found then
        select * into _limits from public.risk_limits where user_id is null and active = true;
    end if;

    select count(*) into _open from public.exchange_orders
     where user_id = _user_id and status in ('OPEN','PARTIALLY_FILLED');
    if _limits.max_open_orders is not null and _open >= _limits.max_open_orders then
        insert into public.risk_alerts (user_id, kind, message)
        values (_user_id, 'LIMIT_EXCEEDED', 'Limite de ordens abertas atingido');
        raise exception 'limite de ordens abertas atingido';
    end if;

    select coalesce(percent, 0) into _fee_pct from public.fee_configs where code = 'TRADING' and active = true;
    _fee_pct := coalesce(_fee_pct, 0);

    -- preço de referência para MARKET / validação de risco
    if _order_type = 'LIMIT' then
        _ref_price := _limit_price;
    else
        if _side = 'BUY' then
            select min(limit_price) into _ref_price from public.exchange_orders
             where asset_id = _asset_id and side = 'SELL' and status in ('OPEN','PARTIALLY_FILLED');
        else
            select max(limit_price) into _ref_price from public.exchange_orders
             where asset_id = _asset_id and side = 'BUY' and status in ('OPEN','PARTIALLY_FILLED');
        end if;
        if _ref_price is null then
            raise exception 'sem liquidez no livro para ordem a mercado';
        end if;
    end if;

    if _limits.max_order_value is not null and round(_ref_price * _quantity, 2) > _limits.max_order_value then
        insert into public.risk_alerts (user_id, kind, message, metadata)
        values (_user_id, 'LIMIT_EXCEEDED', 'Valor da ordem acima do limite',
                jsonb_build_object('value', round(_ref_price * _quantity, 2)));
        raise exception 'valor da ordem acima do limite permitido';
    end if;

    if _side = 'BUY' then
        _reserve := round(_ref_price * _quantity * (1 + _fee_pct), 4);
        select available into _avail from public.exchange_cash(_acc);
        if coalesce(_avail, 0) < _reserve then
            raise exception 'saldo disponivel insuficiente (necessario % MZN)', _reserve;
        end if;
    else
        select * into _pos from public.positions
         where account_id = _acc and asset_id = _asset_id for update;
        if not found or (_pos.quantity - _pos.reserved_quantity) < _quantity then
            raise exception 'posicao insuficiente para venda';
        end if;
        _reserve := 0;
    end if;

    insert into public.exchange_orders (
        user_id, account_id, asset_id, environment, side, order_type,
        quantity, remaining_quantity, limit_price, status,
        reserved_amount, reserved_quantity, idempotency_key
    ) values (
        _user_id, _acc, _asset_id, _env, _side, _order_type,
        _quantity, _quantity, _limit_price, 'OPEN',
        _reserve, case when _side = 'SELL' then _quantity else 0 end, _idempotency_key
    ) returning * into _order;

    insert into public.order_events (order_id, from_status, to_status, note)
    values (_order.id, 'PENDING', 'OPEN', 'ordem aceite');

    if _side = 'BUY' then
        perform public.exchange_ledger_post(
            'xres:' || _order.id::text, 'ORDER_RESERVE', _order.id,
            jsonb_build_array(
                jsonb_build_object('account', public.exchange_ledger_account(_acc, 'RESERVED_CASH'), 'debit', _reserve),
                jsonb_build_object('account', public.exchange_ledger_account(_acc, 'CASH'), 'credit', _reserve)),
            'Reserva de fundos para ordem de compra');
    else
        update public.positions set reserved_quantity = reserved_quantity + _quantity
         where account_id = _acc and asset_id = _asset_id;
    end if;

    perform public.exchange_audit(_user_id, 'order_created', 'exchange_orders', _order.id,
        jsonb_build_object('side', _side, 'type', _order_type, 'quantity', _quantity, 'price', _limit_price));

    -- ================= MATCHING ENGINE =================
    loop
        select * into _order from public.exchange_orders where id = _order.id for update;
        exit when _order.remaining_quantity <= 0;

        if _side = 'BUY' then
            select * into _maker from public.exchange_orders
             where asset_id = _asset_id and side = 'SELL'
               and status in ('OPEN','PARTIALLY_FILLED')
               and remaining_quantity > 0
               and limit_price is not null
               and (_order_type = 'MARKET' or limit_price <= _order.limit_price)
               and user_id <> _user_id
             order by limit_price asc, created_at asc
             limit 1 for update skip locked;
        else
            select * into _maker from public.exchange_orders
             where asset_id = _asset_id and side = 'BUY'
               and status in ('OPEN','PARTIALLY_FILLED')
               and remaining_quantity > 0
               and limit_price is not null
               and (_order_type = 'MARKET' or limit_price >= _order.limit_price)
               and user_id <> _user_id
             order by limit_price desc, created_at asc
             limit 1 for update skip locked;
        end if;

        exit when not found;

        _qty := least(_order.remaining_quantity, _maker.remaining_quantity);
        _price := _maker.limit_price;

        if _side = 'BUY' then
            perform public.exchange_execute_trade(_order.id, _maker.id, _price, _qty);
        else
            perform public.exchange_execute_trade(_maker.id, _order.id, _price, _qty);
        end if;
    end loop;

    select * into _order from public.exchange_orders where id = _order.id;

    -- Ordem a mercado não fica no livro: expira o resto e liberta reservas
    if _order_type = 'MARKET' and _order.remaining_quantity > 0 then
        _released := _order.reserved_amount;
        update public.exchange_orders
           set status = case when filled_quantity > 0 then 'PARTIALLY_FILLED' else 'EXPIRED' end,
               remaining_quantity = 0, reserved_amount = 0,
               reserved_quantity = 0,
               cancelled_at = now()
         where id = _order.id returning * into _order;

        if _side = 'BUY' and _released > 0 then
            perform public.exchange_ledger_post('xrel:' || _order.id::text, 'RESERVE_RELEASE', _order.id,
                jsonb_build_array(
                    jsonb_build_object('account', public.exchange_ledger_account(_acc, 'CASH'), 'debit', _released),
                    jsonb_build_object('account', public.exchange_ledger_account(_acc, 'RESERVED_CASH'), 'credit', _released)));
        elsif _side = 'SELL' then
            update public.positions
               set reserved_quantity = greatest(0, reserved_quantity - (_order.quantity - _order.filled_quantity))
             where account_id = _acc and asset_id = _asset_id;
        end if;

        insert into public.order_events (order_id, from_status, to_status, note)
        values (_order.id, 'OPEN', _order.status, 'ordem a mercado sem liquidez restante');
    end if;

    return _order;
end;
$fn$;

create or replace function public.exchange_cancel_order(
    _user_id uuid, _order_id uuid, _admin boolean default false
) returns exchange_orders language plpgsql security definer set search_path = public as $fn$
declare _order public.exchange_orders; _release numeric;
begin
    select * into _order from public.exchange_orders where id = _order_id for update;
    if not found then raise exception 'ordem inexistente'; end if;
    if not _admin and _order.user_id <> _user_id then raise exception 'ordem nao pertence ao utilizador'; end if;
    if _order.status not in ('OPEN','PARTIALLY_FILLED') then return _order; end if;

    _release := _order.reserved_amount;

    update public.exchange_orders
       set status = 'CANCELLED', cancelled_at = now(),
           reserved_amount = 0, reserved_quantity = 0, remaining_quantity = 0
     where id = _order_id returning * into _order;

    if _order.side = 'BUY' and _release > 0 then
        perform public.exchange_ledger_post('xcancel:' || _order.id::text, 'RESERVE_RELEASE', _order.id,
            jsonb_build_array(
                jsonb_build_object('account', public.exchange_ledger_account(_order.account_id, 'CASH'), 'debit', _release),
                jsonb_build_object('account', public.exchange_ledger_account(_order.account_id, 'RESERVED_CASH'), 'credit', _release)));
    elsif _order.side = 'SELL' then
        update public.positions
           set reserved_quantity = greatest(0, reserved_quantity - (_order.quantity - _order.filled_quantity))
         where account_id = _order.account_id and asset_id = _order.asset_id;
    end if;

    insert into public.order_events (order_id, from_status, to_status, note)
    values (_order.id, 'OPEN', 'CANCELLED', case when _admin then 'cancelada por administração' else 'cancelada pelo utilizador' end);

    perform public.exchange_audit(coalesce(_user_id, _order.user_id),
        case when _admin then 'admin_order_cancelled' else 'order_cancelled' end,
        'exchange_orders', _order.id, '{}');

    return _order;
end;
$fn$;

create or replace function public.exchange_set_market_status(
    _admin_id uuid, _market_id uuid, _status text, _note text default null
) returns exchange_markets language plpgsql security definer set search_path = public as $fn$
declare _m public.exchange_markets;
begin
    if not public.has_role(_admin_id, 'admin') then raise exception 'acesso restrito'; end if;
    if _status not in ('PRE_OPEN','OPEN','PAUSED','CLOSED') then raise exception 'estado invalido'; end if;

    update public.exchange_markets set status = _status where id = _market_id returning * into _m;
    insert into public.market_sessions (market_id, status, note, changed_by)
    values (_market_id, _status, _note, _admin_id);
    perform public.exchange_audit(_admin_id, 'market_status_changed', 'exchange_markets', _market_id,
        jsonb_build_object('status', _status));
    return _m;
end;
$fn$;

revoke all on function public.exchange_create_order(uuid, uuid, text, text, numeric, numeric, text, text) from public, anon, authenticated;
revoke all on function public.exchange_cancel_order(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.exchange_execute_trade(uuid, uuid, numeric, numeric) from public, anon, authenticated;
revoke all on function public.exchange_ledger_post(text, text, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.exchange_grant_paper_cash(uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.exchange_transfer_wallet(uuid, text, numeric, text) from public, anon, authenticated;
revoke all on function public.exchange_set_market_status(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.exchange_cash(uuid) to authenticated;

-- ---------- Seed: mercado de simulação, taxas, limites, ativos DEMO ----------
insert into public.exchange_markets (code, name, environment, status)
values ('SQSX-PAPER', 'SQs Exchange — Mercado de Simulação', 'PAPER', 'OPEN');

insert into public.fee_configs (code, name, percent, fixed) values
  ('TRADING', 'Comissão de negociação', 0.00250, 0),
  ('DEPOSIT', 'Comissão de depósito', 0, 0),
  ('WITHDRAWAL', 'Comissão de levantamento', 0, 0),
  ('SETTLEMENT', 'Comissão de liquidação', 0, 0);

insert into public.risk_limits (user_id) values (null);

insert into public.exchange_assets (market_id, symbol, name, asset_type, description, is_demo, environment, tick_size, lot_size)
select m.id, v.symbol, v.name, v.asset_type, v.description, true, 'PAPER', 0.01, 1
  from public.exchange_markets m,
       (values
        ('HCB', 'Hidroeléctrica de Cahora Bassa', 'EQUITY', 'Instrumento de demonstração (paper trading).'),
        ('CMH', 'Companhia Moçambicana de Hidrocarbonetos', 'EQUITY', 'Instrumento de demonstração (paper trading).'),
        ('CDM', 'Cervejas de Moçambique', 'EQUITY', 'Instrumento de demonstração (paper trading).'),
        ('EMOSE', 'EMOSE — Seguros', 'EQUITY', 'Instrumento de demonstração (paper trading).'),
        ('REVIMO', 'Revimo', 'EQUITY', 'Instrumento de demonstração (paper trading).'),
        ('ARCO', 'Arco Investimentos', 'COMMERCIAL_PAPER', 'Instrumento de demonstração (paper trading).'),
        ('ARKO', 'Arko', 'COMMERCIAL_PAPER', 'Instrumento de demonstração (paper trading).'),
        ('TROPIGALIA', 'Tropigália', 'EQUITY', 'Instrumento de demonstração (paper trading).'),
        ('TRASSUS', 'Trassus', 'BOND', 'Instrumento de demonstração (paper trading).'),
        ('ZERO', 'Zero Investimentos', 'FUND', 'Instrumento de demonstração (paper trading).'),
        ('TOUCH', 'Touch', 'EQUITY', 'Instrumento de demonstração (paper trading).')
       ) as v(symbol, name, asset_type, description)
 where m.code = 'SQSX-PAPER';