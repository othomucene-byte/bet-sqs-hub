alter table public.game_rounds add column if not exists game text not null default 'aviator';
alter table public.game_rounds drop constraint if exists game_rounds_game_check;
alter table public.game_rounds add constraint game_rounds_game_check check (game in ('aviator','fish'));
create index if not exists game_rounds_game_status_idx on public.game_rounds (game, round_number desc);

alter table public.game_bets add column if not exists slot smallint not null default 1;
alter table public.game_bets drop constraint if exists game_bets_slot_check;
alter table public.game_bets add constraint game_bets_slot_check check (slot in (1,2));
alter table public.game_bets drop constraint if exists game_bets_round_id_user_id_key;
alter table public.game_bets add constraint game_bets_round_user_slot_key unique (round_id, user_id, slot);

create or replace function public.place_bet(_user_id uuid, _round_id uuid, _amount numeric, _auto_cashout numeric default null::numeric, _slot integer default 1)
returns game_bets
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    _round public.game_rounds;
    _wallet_id uuid;
    _bet public.game_bets;
begin
    if _amount is null or _amount <= 0 then
        raise exception 'valor de aposta invalido';
    end if;
    if _slot is null or _slot not in (1,2) then
        raise exception 'painel de aposta invalido';
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

    insert into public.game_bets (round_id, user_id, amount, auto_cashout, slot)
    values (_round_id, _user_id, _amount, _auto_cashout, _slot)
    returning * into _bet;

    perform public.wallet_apply(
        _wallet_id, 'bet', -_amount, 'bet:' || _bet.id::text, _round.game, null,
        jsonb_build_object('round_id', _round_id, 'bet_id', _bet.id, 'slot', _slot)
    );

    return _bet;
end;
$function$;

revoke all on function public.place_bet(uuid, uuid, numeric, numeric, integer) from public, anon, authenticated;
grant execute on function public.place_bet(uuid, uuid, numeric, numeric, integer) to service_role;