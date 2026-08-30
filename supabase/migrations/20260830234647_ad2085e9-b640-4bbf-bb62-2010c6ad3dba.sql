-- ============ extensões ============
create extension if not exists pgcrypto with schema extensions;

-- ============ perfis ============
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text,
    phone text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
for select to authenticated using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ============ papéis ============
create type public.app_role as enum ('player', 'admin');

create table public.user_roles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    role public.app_role not null,
    created_at timestamptz not null default now(),
    unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create policy "user_roles_select_own" on public.user_roles
for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

create policy "user_roles_admin_read" on public.user_roles
for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ============ carteiras ============
create table public.wallets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    kind text not null default 'betting' check (kind in ('betting', 'investment')),
    balance numeric(18,2) not null default 0 check (balance >= 0),
    reserved numeric(18,2) not null default 0 check (reserved >= 0),
    currency text not null default 'MZN',
    status text not null default 'active' check (status in ('active', 'frozen', 'closed')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, kind)
);

grant select on public.wallets to authenticated;
grant all on public.wallets to service_role;
alter table public.wallets enable row level security;

create policy "wallets_select_own" on public.wallets
for select to authenticated using (auth.uid() = user_id);
create policy "wallets_admin_read" on public.wallets
for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ============ ledger imutável ============
create table public.wallet_transactions (
    id uuid primary key default gen_random_uuid(),
    wallet_id uuid not null references public.wallets(id),
    type text not null check (type in ('deposit','withdrawal','bet','win','refund','adjustment')),
    amount numeric(18,2) not null,
    balance_before numeric(18,2) not null,
    balance_after numeric(18,2) not null,
    reference text not null unique,
    provider text,
    provider_transaction_id text,
    status text not null default 'completed'
        check (status in ('pending','processing','completed','failed','cancelled')),
    metadata jsonb not null default '{}',
    created_at timestamptz not null default now()
);

create index wallet_transactions_wallet_idx
    on public.wallet_transactions (wallet_id, created_at desc);
create unique index wallet_transactions_provider_idx
    on public.wallet_transactions (provider, provider_transaction_id)
    where provider_transaction_id is not null;

grant select on public.wallet_transactions to authenticated;
grant all on public.wallet_transactions to service_role;
alter table public.wallet_transactions enable row level security;

create policy "wallet_tx_select_own" on public.wallet_transactions
for select to authenticated using (
    exists (select 1 from public.wallets w
            where w.id = wallet_transactions.wallet_id and w.user_id = auth.uid())
);
create policy "wallet_tx_admin_read" on public.wallet_transactions
for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ledger append-only
create or replace function public.reject_ledger_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    raise exception 'wallet_transactions e append-only';
end;
$$;

create trigger wallet_transactions_immutable
before update or delete on public.wallet_transactions
for each row execute function public.reject_ledger_mutation();

-- ============ movimento atómico ============
create or replace function public.wallet_apply(
    _wallet_id uuid,
    _type text,
    _amount numeric,
    _reference text,
    _provider text default null,
    _provider_transaction_id text default null,
    _metadata jsonb default '{}'
)
returns public.wallet_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
    _existing public.wallet_transactions;
    _before numeric(18,2);
    _after numeric(18,2);
    _row public.wallet_transactions;
begin
    select * into _existing from public.wallet_transactions where reference = _reference;
    if found then
        return _existing;
    end if;

    select balance into _before from public.wallets where id = _wallet_id for update;
    if not found then
        raise exception 'carteira inexistente';
    end if;

    _after := _before + _amount;
    if _after < 0 then
        raise exception 'saldo insuficiente';
    end if;

    update public.wallets set balance = _after, updated_at = now() where id = _wallet_id;

    insert into public.wallet_transactions (
        wallet_id, type, amount, balance_before, balance_after,
        reference, provider, provider_transaction_id, metadata
    ) values (
        _wallet_id, _type, _amount, _before, _after,
        _reference, _provider, _provider_transaction_id, coalesce(_metadata, '{}')
    ) returning * into _row;

    return _row;
end;
$$;

revoke all on function public.wallet_apply(uuid, text, numeric, text, text, text, jsonb) from public;
revoke all on function public.wallet_apply(uuid, text, numeric, text, text, text, jsonb) from anon;
revoke all on function public.wallet_apply(uuid, text, numeric, text, text, text, jsonb) from authenticated;
grant execute on function public.wallet_apply(uuid, text, numeric, text, text, text, jsonb) to service_role;

-- ============ provisionamento de novos utilizadores ============
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, display_name, phone)
    values (
        new.id,
        coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
        new.raw_user_meta_data ->> 'phone'
    )
    on conflict (id) do nothing;

    insert into public.user_roles (user_id, role)
    values (new.id, 'player')
    on conflict (user_id, role) do nothing;

    insert into public.wallets (user_id, kind)
    values (new.id, 'betting')
    on conflict (user_id, kind) do nothing;

    return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();