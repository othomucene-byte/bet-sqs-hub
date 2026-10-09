alter table public.instant_rounds drop constraint if exists instant_rounds_game_check;
alter table public.instant_rounds add constraint instant_rounds_game_check check (game in ('wheel','chicken','lion','trade'));

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
    _win boolean;
    _dir integer;
begin
    if _game not in ('wheel', 'chicken', 'lion', 'trade') then
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

    if _game = 'trade' then
        _dir := case when coalesce((_config->>'dir')::int, 1) >= 0 then 1 else -1 end;
        _win := public.instant_float(_round.server_seed, _round.client_seed, _round.nonce, 0) < 0.5;
        _round.multiplier := case when _win then 1.94 else 0 end;
        _round.payout := case
            when not _win then 0
            when _round.funding = 'free_bet' then round(_round.stake * 0.94, 2)
            else round(_round.stake * 1.94, 2) end;
        update public.instant_rounds
           set config = jsonb_build_object('dir', _dir),
               outcome = jsonb_build_object('sector', case when _win then 1 else 0 end, 'dir', _dir),
               multiplier = _round.multiplier,
               payout = _round.payout,
               status = case when _win then 'cashed_out' else 'lost' end,
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

revoke all on function public.instant_start(uuid, text, numeric, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.instant_start(uuid, text, numeric, text, uuid, jsonb) to service_role;
