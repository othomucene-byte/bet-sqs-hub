alter table public.payment_intents
    add column if not exists provider_fee numeric(18, 2) not null default 0,
    add column if not exists net_amount numeric(18, 2);

comment on column public.payment_intents.provider_fee is
    'Custo cobrado pelo gateway a plataforma. Nunca descontado ao cliente.';
comment on column public.payment_intents.net_amount is
    'Valor liquido liquidado pelo gateway a plataforma (bruto - provider_fee).';

create table if not exists public.payted_webhook_events (
    id uuid primary key default gen_random_uuid(),
    event text not null,
    reference text,
    payted_payment_id text,
    signature_valid boolean not null default false,
    handled boolean not null default false,
    note text,
    payload jsonb not null default '{}',
    received_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists payted_webhook_events_reference_idx
    on public.payted_webhook_events (reference, received_at desc);

grant select on public.payted_webhook_events to authenticated;
grant all on public.payted_webhook_events to service_role;

alter table public.payted_webhook_events enable row level security;

drop policy if exists "admins read payted webhook events" on public.payted_webhook_events;
create policy "admins read payted webhook events"
on public.payted_webhook_events for select to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop trigger if exists payted_webhook_events_updated_at on public.payted_webhook_events;
create trigger payted_webhook_events_updated_at
before update on public.payted_webhook_events
for each row execute function public.set_updated_at();