-- BETFCOM SQs — Motor de Crash (rondas, apostas, provably fair)
-- Pronto a aplicar como migração assim que o Lovable Cloud estiver ativo.
-- O resultado da ronda é gerado e guardado no servidor ANTES de a ronda correr.

create table if not exists public.game_rounds (
    id uuid primary key default gen_random_uuid(),
    round_number bigserial unique,
    status text not null default 'WAITING'
        check (status in ('WAITING', 'BETTING', 'RUNNING', 'CRASHED', 'SETTLED')),

    -- compromisso publicado antes da ronda; server_seed só é revelado após CRASHED
    server_seed_hash text not null,
    server_seed text,
    client_seed text not null,
    nonce bigint not null,

    crash_multiplier numeric(12, 4),
    house_edge numeric(6, 4) not null default 0.0500,

    betting_started_at timestamptz,
    betting_closed_at timestamptz,
    started_at timestamptz,
    crashed_at timestamptz,
    settled_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists game_rounds_status_idx on public.game_rounds (status, created_at desc);

grant select on public.game_rounds to authenticated;
grant select on public.game_rounds to anon;
grant all on public.game_rounds to service_role;
alter table public.game_rounds enable row level security;

-- Leitura pública do histórico, MAS sem revelar o seed de rondas ainda não terminadas.
create policy "rondas terminadas são públicas"
on public.game_rounds for select to anon, authenticated
using (true);
-- Nota: a coluna server_seed é sempre projetada pelo servidor com máscara
-- enquanto status <> 'SETTLED'. Ver views em 003_views.sql.

create table if not exists public.game_bets (
    id uuid primary key default gen_random_uuid(),
    round_id uuid not null references public.game_rounds(id),
    user_id uuid not null references auth.users(id) on delete cascade,

    amount numeric(18, 2) not null check (amount > 0),
    auto_cashout numeric(12, 4) check (auto_cashout > 1),

    cashout_multiplier numeric(12, 4),
    payout numeric(18, 2),

    status text not null default 'active'
        check (status in ('active', 'cashed_out', 'lost', 'refunded')),

    -- uma aposta por utilizador por ronda evita duplicação por duplo-clique
    placed_at timestamptz not null default now(),
    cashed_out_at timestamptz,
    unique (round_id, user_id)
);

create index if not exists game_bets_round_idx on public.game_bets (round_id);
create index if not exists game_bets_user_idx on public.game_bets (user_id, placed_at desc);

grant select on public.game_bets to authenticated;
grant all on public.game_bets to service_role;
alter table public.game_bets enable row level security;

create policy "users read own bets"
on public.game_bets for select to authenticated
using (auth.uid() = user_id);
-- Inserção/atualização apenas pelo motor no servidor (service_role).

-- Resultado provably fair: HMAC-SHA256(server_seed, client_seed:nonce) -> multiplicador
-- com house edge aplicado no RTP (não subtraído do cash-out).
create or replace function public.crash_result(
    _server_seed text,
    _client_seed text,
    _nonce bigint,
    _house_edge numeric default 0.05
)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
    _digest bytea;
    _slice bigint;
    _max bigint := 4294967296; -- 2^32
    _float numeric;
    _result numeric;
begin
    _digest := extensions.hmac(_client_seed || ':' || _nonce::text, _server_seed, 'sha256');
    _slice := ('x' || encode(substring(_digest from 1 for 4), 'hex'))::bit(32)::bigint;
    _float := _slice::numeric / _max::numeric;

    -- 1% das rondas são crash instantâneo (parte da house edge)
    if _float < _house_edge then
        return 1.00;
    end if;

    _result := (1 - _house_edge) / (1 - _float);
    return greatest(1.00, round(least(_result, 10000), 4));
end;
$$;

grant execute on function public.crash_result(text, text, bigint, numeric) to authenticated, service_role;
