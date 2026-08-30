-- ============ rondas ============
create table public.game_rounds (
    id uuid primary key default gen_random_uuid(),
    round_number bigint generated always as identity unique,
    status text not null default 'WAITING'
        check (status in ('WAITING','BETTING','RUNNING','CRASHED','SETTLED')),
    server_seed_hash text not null,
    server_seed text,
    client_seed text not null,
    nonce bigint not null,
    crash_multiplier numeric(12,4),
    house_edge numeric(6,4) not null default 0.0500,
    betting_started_at timestamptz,
    betting_closed_at timestamptz,
    started_at timestamptz,
    crashed_at timestamptz,
    settled_at timestamptz,
    created_at timestamptz not null default now()
);

create index game_rounds_status_idx on public.game_rounds (status, created_at desc);
create index game_rounds_number_idx on public.game_rounds (round_number desc);

-- server_seed NAO e legivel pelo cliente: grant por coluna, sem server_seed
grant select (
    id, round_number, status, server_seed_hash, client_seed, nonce,
    crash_multiplier, house_edge, betting_started_at, betting_closed_at,
    started_at, crashed_at, settled_at, created_at
) on public.game_rounds to anon, authenticated;
grant all on public.game_rounds to service_role;

alter table public.game_rounds enable row level security;

create policy "rounds_public_read" on public.game_rounds
for select to anon, authenticated using (true);

-- ============ apostas ============
create table public.game_bets (
    id uuid primary key default gen_random_uuid(),
    round_id uuid not null references public.game_rounds(id),
    user_id uuid not null references auth.users(id) on delete cascade,
    amount numeric(18,2) not null check (amount > 0),
    auto_cashout numeric(12,4) check (auto_cashout > 1),
    cashout_multiplier numeric(12,4),
    payout numeric(18,2),
    status text not null default 'active'
        check (status in ('active','cashed_out','lost','refunded')),
    placed_at timestamptz not null default now(),
    cashed_out_at timestamptz,
    unique (round_id, user_id)
);

create index game_bets_round_idx on public.game_bets (round_id);
create index game_bets_user_idx on public.game_bets (user_id, placed_at desc);

grant select on public.game_bets to authenticated;
grant all on public.game_bets to service_role;
alter table public.game_bets enable row level security;

create policy "bets_select_own" on public.game_bets
for select to authenticated using (auth.uid() = user_id);
create policy "bets_admin_read" on public.game_bets
for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ============ provably fair ============
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
    _max numeric := 4294967296;
    _float numeric;
    _result numeric;
begin
    _digest := extensions.hmac(_client_seed || ':' || _nonce::text, _server_seed, 'sha256');
    _slice := ('x' || encode(substring(_digest from 1 for 4), 'hex'))::bit(32)::bigint;
    _float := _slice::numeric / _max;

    if _float < _house_edge then
        return 1.00;
    end if;

    _result := (1 - _house_edge) / (1 - _float);
    return round(least(greatest(_result, 1.00), 10000), 4);
end;
$$;

revoke all on function public.crash_result(text, text, bigint, numeric) from public, anon;
grant execute on function public.crash_result(text, text, bigint, numeric) to authenticated, service_role;

-- multiplicador atual: 1.06^segundos desde o arranque. Autoridade = servidor.
create or replace function public.crash_multiplier_at(_started_at timestamptz, _at timestamptz default now())
returns numeric
language sql
immutable
set search_path = public
as $$
    select case
        when _started_at is null then 1.0000
        else round(greatest(1.0, power(1.06, greatest(0, extract(epoch from (_at - _started_at)))))::numeric, 4)
    end
$$;

revoke all on function public.crash_multiplier_at(timestamptz, timestamptz) from public, anon;
grant execute on function public.crash_multiplier_at(timestamptz, timestamptz) to authenticated, service_role;

-- revelacao da semente apenas depois do crash
create or replace function public.round_reveal(_round_number bigint)
returns table (round_number bigint, server_seed text, server_seed_hash text, client_seed text, nonce bigint, crash_multiplier numeric)
language sql
stable
security definer
set search_path = public
as $$
    select r.round_number, r.server_seed, r.server_seed_hash, r.client_seed, r.nonce, r.crash_multiplier
    from public.game_rounds r
    where r.round_number = _round_number
      and r.status in ('CRASHED','SETTLED')
$$;

revoke all on function public.round_reveal(bigint) from public;
grant execute on function public.round_reveal(bigint) to anon, authenticated, service_role;

-- ============ motor: colocar aposta ============
create or replace function public.place_bet(
    _user_id uuid,
    _round_id uuid,
    _amount numeric,
    _auto_cashout numeric default null
)
returns public.game_bets
language plpgsql
security definer
set search_path = public
as $$
declare
    _round public.game_rounds;
    _wallet_id uuid;
    _bet public.game_bets;
begin
    if _amount is null or _amount <= 0 then
        raise exception 'valor de aposta invalido';
    end if;

    select * into _round from public.game_rounds where id = _round_id for update;
    if not found then
        raise exception 'ronda inexistente';
    end if;
    if _round.status <> 'BETTING' then
        raise exception 'apostas fechadas para esta ronda';
    end if;

    select id into _wallet_id from public.wallets
     where user_id = _user_id and kind = 'betting' and status = 'active';
    if not found then
        raise exception 'carteira de apostas indisponivel';
    end if;

    insert into public.game_bets (round_id, user_id, amount, auto_cashout)
    values (_round_id, _user_id, _amount, _auto_cashout)
    returning * into _bet;

    perform public.wallet_apply(
        _wallet_id, 'bet', -_amount, 'bet:' || _bet.id::text, 'crash', null,
        jsonb_build_object('round_id', _round_id, 'bet_id', _bet.id)
    );

    return _bet;
end;
$$;

revoke all on function public.place_bet(uuid, uuid, numeric, numeric) from public, anon, authenticated;
grant execute on function public.place_bet(uuid, uuid, numeric, numeric) to service_role;

-- ============ motor: cash-out ============
create or replace function public.cashout_bet(_user_id uuid, _bet_id uuid)
returns public.game_bets
language plpgsql
security definer
set search_path = public
as $$
declare
    _bet public.game_bets;
    _round public.game_rounds;
    _multiplier numeric(12,4);
    _payout numeric(18,2);
    _wallet_id uuid;
begin
    select * into _bet from public.game_bets where id = _bet_id for update;
    if not found then
        raise exception 'aposta inexistente';
    end if;
    if _bet.user_id <> _user_id then
        raise exception 'aposta nao pertence ao utilizador';
    end if;
    if _bet.status <> 'active' then
        return _bet;  -- idempotente: cash-out ja processado
    end if;

    select * into _round from public.game_rounds where id = _bet.round_id;
    if _round.status <> 'RUNNING' then
        raise exception 'ronda nao esta a correr';
    end if;

    _multiplier := public.crash_multiplier_at(_round.started_at);
    if _round.crash_multiplier is not null and _multiplier >= _round.crash_multiplier then
        raise exception 'crash ja ocorreu';
    end if;

    _payout := round(_bet.amount * _multiplier, 2);

    update public.game_bets
       set status = 'cashed_out',
           cashout_multiplier = _multiplier,
           payout = _payout,
           cashed_out_at = now()
     where id = _bet_id and status = 'active'
    returning * into _bet;

    if not found then
        select * into _bet from public.game_bets where id = _bet_id;
        return _bet;
    end if;

    select id into _wallet_id from public.wallets
     where user_id = _user_id and kind = 'betting';

    perform public.wallet_apply(
        _wallet_id, 'win', _payout, 'win:' || _bet_id::text, 'crash', null,
        jsonb_build_object('round_id', _bet.round_id, 'multiplier', _multiplier)
    );

    return _bet;
end;
$$;

revoke all on function public.cashout_bet(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cashout_bet(uuid, uuid) to service_role;