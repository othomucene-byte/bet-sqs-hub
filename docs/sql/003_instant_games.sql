-- BETFCOM SQs — Jogos de jogada individual (Roda, Chicken Choice, Leão Rei da Selva)
--
-- Regras invioláveis:
--   * O resultado de cada jogada é fixado e selado no servidor ANTES de o
--     jogador escolher (compromisso sha256 do server_seed).
--   * A semente e o resultado só são revelados quando a jogada termina.
--   * Nenhum saldo se move sem uma linha no ledger imutável (wallet_apply).
--   * O frontend nunca decide resultado, multiplicador ou pagamento.
--
-- RTP oficial: 97% (margem da casa 3%), igual às mesas de crash.

create table if not exists public.instant_rounds (
    id uuid primary key default gen_random_uuid(),
    round_number bigserial unique,
    game text not null check (game in ('wheel', 'chicken', 'lion')),
    user_id uuid not null references auth.users(id) on delete cascade,

    -- provably fair
    server_seed text not null,
    server_seed_hash text not null,
    client_seed text not null,
    nonce bigint not null,

    stake numeric(18, 2) not null check (stake > 0),
    funding text not null default 'wallet' check (funding in ('wallet', 'bonus', 'free_bet')),
    free_bet_id uuid,

    -- parâmetros escolhidos pelo jogador (dificuldade, nº de armadilhas)
    config jsonb not null default '{}',
    -- resultado selado (posições das armadilhas / setor da roda) — NUNCA exposto
    -- ao cliente enquanto status = 'open'
    outcome jsonb not null default '{}',
    picks jsonb not null default '[]',
    step integer not null default 0,
    multiplier numeric(12, 4) not null default 1,
    payout numeric(18, 2),

    status text not null default 'open' check (status in ('open', 'cashed_out', 'lost')),
    created_at timestamptz not null default now(),
    finished_at timestamptz
);

create index if not exists instant_rounds_user_idx
    on public.instant_rounds (user_id, created_at desc);
-- Uma jogada em aberto por jogo e por jogador (evita duplo-clique)
create unique index if not exists instant_rounds_open_idx
    on public.instant_rounds (user_id, game)
    where status = 'open';

-- Sem acesso direto: a tabela guarda o resultado selado, por isso a leitura
-- passa sempre por funções no servidor que mascaram o que não pode ser revelado.
grant all on public.instant_rounds to service_role;
alter table public.instant_rounds enable row level security;

-- Float determinístico 0..1 a partir do compromisso da jogada.
create or replace function public.instant_float(
    _server_seed text,
    _client_seed text,
    _nonce bigint,
    _index integer
)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
    _digest bytea;
    _slice bigint;
begin
    _digest := extensions.hmac(
        _client_seed || ':' || _nonce::text || ':' || _index::text, _server_seed, 'sha256');
    _slice := ('x' || encode(substring(_digest from 1 for 4), 'hex'))::bit(32)::bigint;
    return _slice::numeric / 4294967296::numeric;
end;
$$;

-- Roda da Betfcom: 20 setores fixos. O setor é sorteado por peso, com RTP 97%.
-- Pesos (em 10000): 0x → 5506 | 1.5x → 2200 | 2x → 1400 | 3x → 600
--                   5x → 240  | 10x → 50    | 25x → 4
-- Retorno esperado = (3300+2800+1800+1200+500+100)/10000 = 0.97
create or replace function public.wheel_layout()
returns numeric[]
language sql
immutable
as $$
  select array[0, 1.5, 0, 2, 0, 1.5, 0, 3, 0, 1.5,
               0, 2, 0, 5, 0, 1.5, 0, 10, 0, 25]::numeric[];
$$;

create or replace function public.wheel_spin(
    _server_seed text,
    _client_seed text,
    _nonce bigint
)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
    _roll numeric := public.instant_float(_server_seed, _client_seed, _nonce, 0) * 10000;
    _mult numeric;
    _layout numeric[] := public.wheel_layout();
    _matches integer[] := '{}';
    _i integer;
    _pick integer;
begin
    if _roll < 5506 then _mult := 0;
    elsif _roll < 7706 then _mult := 1.5;
    elsif _roll < 9106 then _mult := 2;
    elsif _roll < 9706 then _mult := 3;
    elsif _roll < 9946 then _mult := 5;
    elsif _roll < 9996 then _mult := 10;
    else _mult := 25;
    end if;

    -- escolhe um dos setores visuais com esse multiplicador
    for _i in 1 .. array_length(_layout, 1) loop
        if _layout[_i] = _mult then _matches := _matches || (_i - 1); end if;
    end loop;

    _pick := _matches[1 + floor(
        public.instant_float(_server_seed, _client_seed, _nonce, 1) * array_length(_matches, 1))::int];
    if _pick is null then _pick := _matches[1]; end if;

    return jsonb_build_object('sector', _pick, 'multiplier', _mult);
end;
$$;

-- Chicken Choice: em cada nível, uma das portas tem armadilha.
create or replace function public.chicken_traps(
    _server_seed text,
    _client_seed text,
    _nonce bigint,
    _doors integer,
    _levels integer
)
returns integer[]
language plpgsql
immutable
set search_path = public
as $$
declare
    _traps integer[] := '{}';
    _l integer;
begin
    for _l in 0 .. _levels - 1 loop
        _traps := _traps || floor(
            public.instant_float(_server_seed, _client_seed, _nonce, _l) * _doors)::int;
    end loop;
    return _traps;
end;
$$;

-- Leão Rei da Selva: armadilhas distintas numa grelha de 25 casas (Fisher-Yates).
create or replace function public.lion_traps(
    _server_seed text,
    _client_seed text,
    _nonce bigint,
    _tiles integer,
    _traps integer
)
returns integer[]
language plpgsql
immutable
set search_path = public
as $$
declare
    _pool integer[] := '{}';
    _out integer[] := '{}';
    _i integer;
    _j integer;
    _tmp integer;
begin
    for _i in 0 .. _tiles - 1 loop _pool := _pool || _i; end loop;

    for _i in reverse _tiles .. 2 loop
        _j := 1 + floor(public.instant_float(
            _server_seed, _client_seed, _nonce, _tiles - _i) * _i)::int;
        _tmp := _pool[_i];
        _pool[_i] := _pool[_j];
        _pool[_j] := _tmp;
    end loop;

    for _i in 1 .. _traps loop _out := _out || _pool[_i]; end loop;
    return _out;
end;
$$;

-- Multiplicador acumulado do Chicken após _step portas seguras.
create or replace function public.chicken_multiplier(_doors integer, _step integer)
returns numeric
language sql
immutable
as $$
  select round(0.97 * power(_doors::numeric / (_doors - 1)::numeric, _step), 4);
$$;

-- Multiplicador acumulado do Leão após _step casas seguras.
create or replace function public.lion_multiplier(
    _tiles integer, _traps integer, _step integer)
returns numeric
language plpgsql
immutable
as $$
declare
    _m numeric := 0.97;
    _i integer;
begin
    for _i in 0 .. _step - 1 loop
        _m := _m * (_tiles - _i)::numeric / (_tiles - _traps - _i)::numeric;
    end loop;
    return round(_m, 4);
end;
$$;

-- Debita a aposta na origem escolhida. Mesmo caminho de dinheiro das mesas de crash.
create or replace function public.instant_debit(
    _user_id uuid,
    _round public.instant_rounds
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    _wallet_id uuid;
    _fb public.free_bets;
begin
    if _round.funding = 'wallet' then
        select id into _wallet_id from public.wallets
         where user_id = _user_id and kind = 'betting' and status = 'active';
        if not found then raise exception 'carteira de apostas indisponivel'; end if;
        perform public.wallet_apply(
            _wallet_id, 'bet', -_round.stake, 'ibet:' || _round.id::text, _round.game, null,
            jsonb_build_object('instant_round_id', _round.id, 'game', _round.game));
    elsif _round.funding = 'bonus' then
        perform public.bonus_apply(_user_id, 'bonus_bet', -_round.stake,
            'ibonusbet:' || _round.id::text,
            jsonb_build_object('instant_round_id', _round.id, 'game', _round.game));
    else
        select * into _fb from public.free_bets where id = _round.free_bet_id for update;
        if not found or _fb.user_id <> _user_id then
            raise exception 'aposta gratis inexistente';
        end if;
        if _fb.status <> 'available' or _fb.expires_at < now() then
            raise exception 'aposta gratis indisponivel ou expirada';
        end if;
        if _round.stake < _fb.min_amount or _round.stake > _fb.max_amount then
            raise exception 'valor da aposta gratis deve estar entre % e % MZN',
                _fb.min_amount, _fb.max_amount;
        end if;
        update public.free_bets
           set status = 'used', used_amount = _round.stake, used_at = now(),
               used_context = _round.game
         where id = _round.free_bet_id;
    end if;
end;
$$;

-- Paga o prémio (idempotente pela reference do ledger).
create or replace function public.instant_credit(
    _user_id uuid,
    _round public.instant_rounds
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    _wallet_id uuid;
begin
    if coalesce(_round.payout, 0) <= 0 then return; end if;
    select id into _wallet_id from public.wallets
     where user_id = _user_id and kind = 'betting';
    if not found then raise exception 'carteira de apostas indisponivel'; end if;
    perform public.wallet_apply(
        _wallet_id, 'win', _round.payout, 'iwin:' || _round.id::text, _round.game, null,
        jsonb_build_object('instant_round_id', _round.id, 'multiplier', _round.multiplier));
end;
$$;

-- Abre a jogada: sela o resultado, debita a aposta e (na roda) resolve logo.
create or replace function public.instant_start(
    _user_id uuid,
    _game text,
    _stake numeric,
    _funding text default 'wallet',
    _free_bet_id uuid default null,
    _config jsonb default '{}'
)
returns public.instant_rounds
language plpgsql
security definer
set search_path = public
as $$
declare
    _round public.instant_rounds;
    _seed text := encode(extensions.gen_random_bytes(32), 'hex');
    _client text := encode(extensions.gen_random_bytes(8), 'hex');
    _doors integer;
    _traps integer;
    _levels integer := 8;
    _tiles integer := 25;
    _spin jsonb;
begin
    if _game not in ('wheel', 'chicken', 'lion') then
        raise exception 'jogo invalido';
    end if;
    if coalesce(_funding, 'wallet') not in ('wallet', 'bonus', 'free_bet') then
        raise exception 'origem de saldo invalida';
    end if;
    if _stake is null or _stake < 3 or _stake > 25000 then
        raise exception 'valor de aposta deve estar entre 3 e 25000 MZN';
    end if;

    if exists (select 1 from public.instant_rounds
                where user_id = _user_id and game = _game and status = 'open') then
        raise exception 'ja tem uma jogada em curso neste jogo';
    end if;

    insert into public.instant_rounds (
        game, user_id, server_seed, server_seed_hash, client_seed, nonce,
        stake, funding, free_bet_id, config)
    values (
        _game, _user_id, _seed, encode(extensions.digest(_seed, 'sha256'), 'hex'),
        _client, 0, _stake, coalesce(_funding, 'wallet'),
        case when _funding = 'free_bet' then _free_bet_id else null end,
        coalesce(_config, '{}'))
    returning * into _round;

    update public.instant_rounds set nonce = _round.round_number
     where id = _round.id returning * into _round;

    perform public.instant_debit(_user_id, _round);

    if _game = 'wheel' then
        _spin := public.wheel_spin(_round.server_seed, _round.client_seed, _round.nonce);
        _round.multiplier := (_spin->>'multiplier')::numeric;
        _round.payout := case
            when _round.funding = 'free_bet'
                then round(_round.stake * greatest(_round.multiplier - 1, 0), 2)
            else round(_round.stake * _round.multiplier, 2) end;

        update public.instant_rounds
           set outcome = _spin,
               multiplier = _round.multiplier,
               payout = _round.payout,
               status = case when _round.multiplier > 0 then 'cashed_out' else 'lost' end,
               finished_at = now()
         where id = _round.id
        returning * into _round;

        perform public.instant_credit(_user_id, _round);
        return _round;
    end if;

    if _game = 'chicken' then
        _doors := greatest(2, least(5, coalesce((_config->>'doors')::int, 3)));
        update public.instant_rounds
           set config = jsonb_build_object('doors', _doors, 'levels', _levels),
               outcome = jsonb_build_object(
                   'traps', public.chicken_traps(
                       _round.server_seed, _round.client_seed, _round.nonce, _doors, _levels))
         where id = _round.id
        returning * into _round;
    else
        _traps := greatest(1, least(10, coalesce((_config->>'traps')::int, 3)));
        update public.instant_rounds
           set config = jsonb_build_object('tiles', _tiles, 'traps', _traps),
               outcome = jsonb_build_object(
                   'traps', public.lion_traps(
                       _round.server_seed, _round.client_seed, _round.nonce, _tiles, _traps))
         where id = _round.id
        returning * into _round;
    end if;

    return _round;
end;
$$;

-- Escolha do jogador. O servidor compara com o resultado já selado.
create or replace function public.instant_pick(
    _user_id uuid,
    _round_id uuid,
    _pick integer
)
returns public.instant_rounds
language plpgsql
security definer
set search_path = public
as $$
declare
    _round public.instant_rounds;
    _traps integer[];
    _doors integer;
    _levels integer;
    _tiles integer;
    _ntraps integer;
    _hit boolean;
    _safe integer;
begin
    select * into _round from public.instant_rounds where id = _round_id for update;
    if not found then raise exception 'jogada inexistente'; end if;
    if _round.user_id <> _user_id then raise exception 'jogada nao pertence ao utilizador'; end if;
    if _round.status <> 'open' then return _round; end if;
    if _round.game = 'wheel' then raise exception 'a roda nao aceita escolhas'; end if;

    select array(select jsonb_array_elements_text(_round.outcome->'traps')::int) into _traps;

    if _round.game = 'chicken' then
        _doors := (_round.config->>'doors')::int;
        _levels := (_round.config->>'levels')::int;
        if _pick < 0 or _pick >= _doors then raise exception 'porta invalida'; end if;
        _hit := _traps[_round.step + 1] = _pick;
        _safe := _levels;
    else
        _tiles := (_round.config->>'tiles')::int;
        _ntraps := (_round.config->>'traps')::int;
        if _pick < 0 or _pick >= _tiles then raise exception 'casa invalida'; end if;
        if _round.picks @> to_jsonb(_pick) then raise exception 'casa ja escolhida'; end if;
        _hit := _pick = any(_traps);
        _safe := _tiles - _ntraps;
    end if;

    if _hit then
        update public.instant_rounds
           set picks = _round.picks || to_jsonb(_pick),
               multiplier = 0, payout = 0, status = 'lost', finished_at = now()
         where id = _round.id and status = 'open'
        returning * into _round;
        return _round;
    end if;

    update public.instant_rounds
       set picks = _round.picks || to_jsonb(_pick),
           step = _round.step + 1,
           multiplier = case when _round.game = 'chicken'
               then public.chicken_multiplier(_doors, _round.step + 1)
               else public.lion_multiplier(_tiles, _ntraps, _round.step + 1) end
     where id = _round.id and status = 'open'
    returning * into _round;

    -- completou o jogo: pagamento automático
    if _round.step >= _safe then
        return public.instant_cashout(_user_id, _round.id);
    end if;

    return _round;
end;
$$;

-- Levanta o prémio acumulado.
create or replace function public.instant_cashout(
    _user_id uuid,
    _round_id uuid
)
returns public.instant_rounds
language plpgsql
security definer
set search_path = public
as $$
declare
    _round public.instant_rounds;
    _payout numeric(18, 2);
begin
    select * into _round from public.instant_rounds where id = _round_id for update;
    if not found then raise exception 'jogada inexistente'; end if;
    if _round.user_id <> _user_id then raise exception 'jogada nao pertence ao utilizador'; end if;
    if _round.status <> 'open' then return _round; end if;
    if _round.step <= 0 then raise exception 'faça pelo menos uma escolha antes de levantar'; end if;

    _payout := case
        when _round.funding = 'free_bet'
            then round(_round.stake * greatest(_round.multiplier - 1, 0), 2)
        else round(_round.stake * _round.multiplier, 2) end;

    update public.instant_rounds
       set payout = _payout, status = 'cashed_out', finished_at = now()
     where id = _round.id and status = 'open'
    returning * into _round;

    if not found then
        select * into _round from public.instant_rounds where id = _round_id;
        return _round;
    end if;

    perform public.instant_credit(_user_id, _round);
    return _round;
end;
$$;

revoke all on function public.instant_start(uuid, text, numeric, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.instant_pick(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.instant_cashout(uuid, uuid) from public, anon, authenticated;
revoke all on function public.instant_debit(uuid, public.instant_rounds) from public, anon, authenticated;
revoke all on function public.instant_credit(uuid, public.instant_rounds) from public, anon, authenticated;

grant execute on function public.instant_start(uuid, text, numeric, text, uuid, jsonb) to service_role;
grant execute on function public.instant_pick(uuid, uuid, integer) to service_role;
grant execute on function public.instant_cashout(uuid, uuid) to service_role;
grant execute on function public.instant_debit(uuid, public.instant_rounds) to service_role;
grant execute on function public.instant_credit(uuid, public.instant_rounds) to service_role;
grant execute on function public.instant_float(text, text, bigint, integer) to authenticated, service_role;
grant execute on function public.wheel_layout() to anon, authenticated, service_role;
grant execute on function public.wheel_spin(text, text, bigint) to authenticated, service_role;
grant execute on function public.chicken_traps(text, text, bigint, integer, integer) to authenticated, service_role;
grant execute on function public.lion_traps(text, text, bigint, integer, integer) to authenticated, service_role;
grant execute on function public.chicken_multiplier(integer, integer) to anon, authenticated, service_role;
grant execute on function public.lion_multiplier(integer, integer, integer) to anon, authenticated, service_role;
