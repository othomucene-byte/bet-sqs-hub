-- BETFCOM SQs — Wallet + Ledger imutável
-- Pronto a aplicar como migração assim que o Lovable Cloud estiver ativo.
-- Regra: o saldo NUNCA é alterado sem uma linha correspondente no ledger.

create table if not exists public.wallets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null unique references auth.users(id) on delete cascade,
    -- kind separa contabilisticamente as carteiras (apostas vs investimentos)
    kind text not null default 'betting' check (kind in ('betting', 'investment')),
    balance numeric(18, 2) not null default 0 check (balance >= 0),
    -- valor reservado para levantamentos em curso (não gastável)
    reserved numeric(18, 2) not null default 0 check (reserved >= 0),
    currency text not null default 'MZN',
    status text not null default 'active' check (status in ('active', 'frozen', 'closed')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

grant select on public.wallets to authenticated;
grant all on public.wallets to service_role;
alter table public.wallets enable row level security;

create policy "users read own wallet"
on public.wallets for select to authenticated
using (auth.uid() = user_id);
-- Escrita apenas via service_role / funções security definer no servidor.

create table if not exists public.wallet_transactions (
    id uuid primary key default gen_random_uuid(),
    wallet_id uuid not null references public.wallets(id),
    type text not null check (
        type in ('deposit', 'withdrawal', 'bet', 'win', 'refund', 'adjustment')
    ),
    amount numeric(18, 2) not null,
    balance_before numeric(18, 2) not null,
    balance_after numeric(18, 2) not null,
    -- chave de idempotência: repetição de webhook/cash-out não duplica dinheiro
    reference text not null unique,
    provider text,
    provider_transaction_id text,
    status text not null default 'completed'
        check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    metadata jsonb not null default '{}',
    created_at timestamptz not null default now()
);

create index if not exists wallet_transactions_wallet_idx
    on public.wallet_transactions (wallet_id, created_at desc);
create unique index if not exists wallet_transactions_provider_idx
    on public.wallet_transactions (provider, provider_transaction_id)
    where provider_transaction_id is not null;

grant select on public.wallet_transactions to authenticated;
grant all on public.wallet_transactions to service_role;
alter table public.wallet_transactions enable row level security;

create policy "users read own transactions"
on public.wallet_transactions for select to authenticated
using (
    exists (
        select 1 from public.wallets w
        where w.id = wallet_transactions.wallet_id
          and w.user_id = auth.uid()
    )
);

-- Imutabilidade do ledger: sem UPDATE nem DELETE, mesmo para service_role.
create or replace function public.reject_ledger_mutation()
returns trigger language plpgsql as $$
begin
    raise exception 'wallet_transactions é append-only';
end;
$$;

drop trigger if exists wallet_transactions_immutable on public.wallet_transactions;
create trigger wallet_transactions_immutable
before update or delete on public.wallet_transactions
for each row execute function public.reject_ledger_mutation();

-- Movimento atómico de saldo. Devolve a transação criada.
-- Idempotente: se a reference já existir, devolve a linha existente.
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
    _before numeric(18, 2);
    _after numeric(18, 2);
    _row public.wallet_transactions;
begin
    select * into _existing from wallet_transactions where reference = _reference;
    if found then
        return _existing;
    end if;

    -- lock pessimista na carteira: serializa apostas/cash-outs concorrentes
    select balance into _before from wallets where id = _wallet_id for update;
    if not found then
        raise exception 'carteira inexistente';
    end if;

    _after := _before + _amount;
    if _after < 0 then
        raise exception 'saldo insuficiente';
    end if;

    update wallets
       set balance = _after, updated_at = now()
     where id = _wallet_id;

    insert into wallet_transactions (
        wallet_id, type, amount, balance_before, balance_after,
        reference, provider, provider_transaction_id, metadata
    ) values (
        _wallet_id, _type, _amount, _before, _after,
        _reference, _provider, _provider_transaction_id, coalesce(_metadata, '{}')
    ) returning * into _row;

    return _row;
end;
$$;

revoke all on function public.wallet_apply(uuid, text, numeric, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.wallet_apply(uuid, text, numeric, text, text, text, jsonb) to service_role;
