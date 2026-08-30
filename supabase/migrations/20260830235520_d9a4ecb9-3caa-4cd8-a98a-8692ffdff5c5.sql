create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

-- Intenções de pagamento NetShop: criadas pelo backend, confirmadas por webhook.
create table if not exists public.payment_intents (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    wallet_id uuid not null references public.wallets(id) on delete restrict,
    direction text not null check (direction in ('deposit', 'withdrawal')),
    provider text not null default 'netshop',
    method text not null,
    amount numeric(18, 2) not null check (amount > 0),
    currency text not null default 'MZN',
    -- Referência única: base da idempotência com o webhook e o ledger.
    reference text not null unique,
    provider_transaction_id text,
    status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'expired')),
    payer_identifier text,
    metadata jsonb not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists payment_intents_user_idx on public.payment_intents (user_id, created_at desc);
create index if not exists payment_intents_status_idx on public.payment_intents (status);

grant select on public.payment_intents to authenticated;
grant all on public.payment_intents to service_role;

alter table public.payment_intents enable row level security;

-- O utilizador só lê as suas intenções; criação e transição de estado são exclusivas do servidor.
create policy "users read own payment intents"
on public.payment_intents
for select
to authenticated
using (auth.uid() = user_id);

create trigger payment_intents_set_updated_at
before update on public.payment_intents
for each row
execute function public.set_updated_at();