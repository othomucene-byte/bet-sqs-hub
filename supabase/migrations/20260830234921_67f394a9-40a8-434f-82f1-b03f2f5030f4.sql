-- Liquida a ronda: paga auto cash-outs validos e marca as restantes como perdidas.
create or replace function public.settle_round(_round_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    _round public.game_rounds;
    _bet public.game_bets;
    _wallet_id uuid;
    _payout numeric(18,2);
    _paid integer := 0;
begin
    select * into _round from public.game_rounds where id = _round_id for update;
    if not found then
        raise exception 'ronda inexistente';
    end if;
    if _round.crash_multiplier is null then
        raise exception 'ronda sem resultado definido';
    end if;

    -- auto cash-outs alcancados antes do crash
    for _bet in
        select * from public.game_bets
         where round_id = _round_id
           and status = 'active'
           and auto_cashout is not null
           and auto_cashout <= _round.crash_multiplier
         order by placed_at
         for update
    loop
        _payout := round(_bet.amount * _bet.auto_cashout, 2);

        update public.game_bets
           set status = 'cashed_out',
               cashout_multiplier = _bet.auto_cashout,
               payout = _payout,
               cashed_out_at = coalesce(_round.crashed_at, now())
         where id = _bet.id and status = 'active';

        select id into _wallet_id from public.wallets
         where user_id = _bet.user_id and kind = 'betting';

        perform public.wallet_apply(
            _wallet_id, 'win', _payout, 'win:' || _bet.id::text, 'crash', null,
            jsonb_build_object('round_id', _round_id, 'multiplier', _bet.auto_cashout, 'auto', true)
        );

        _paid := _paid + 1;
    end loop;

    -- restantes apostas ativas perdem
    update public.game_bets
       set status = 'lost'
     where round_id = _round_id and status = 'active';

    return _paid;
end;
$$;

revoke all on function public.settle_round(uuid) from public, anon, authenticated;
grant execute on function public.settle_round(uuid) to service_role;

-- Reembolsa todas as apostas de uma ronda anulada.
create or replace function public.refund_round(_round_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    _bet public.game_bets;
    _wallet_id uuid;
    _count integer := 0;
begin
    for _bet in
        select * from public.game_bets
         where round_id = _round_id and status = 'active'
         for update
    loop
        update public.game_bets set status = 'refunded' where id = _bet.id;

        select id into _wallet_id from public.wallets
         where user_id = _bet.user_id and kind = 'betting';

        perform public.wallet_apply(
            _wallet_id, 'refund', _bet.amount, 'refund:' || _bet.id::text, 'crash', null,
            jsonb_build_object('round_id', _round_id)
        );

        _count := _count + 1;
    end loop;

    return _count;
end;
$$;

revoke all on function public.refund_round(uuid) from public, anon, authenticated;
grant execute on function public.refund_round(uuid) to service_role;