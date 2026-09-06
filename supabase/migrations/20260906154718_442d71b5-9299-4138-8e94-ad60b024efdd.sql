CREATE OR REPLACE FUNCTION public.settle_round(_round_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    _round public.game_rounds;
    _bet public.game_bets;
    _wallet_id uuid;
    _payout numeric(18,2);
    _paid integer := 0;
BEGIN
    SELECT * INTO _round FROM public.game_rounds WHERE id = _round_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ronda inexistente';
    END IF;
    IF _round.crash_multiplier IS NULL THEN
        RAISE EXCEPTION 'ronda sem resultado definido';
    END IF;

    FOR _bet IN
        SELECT * FROM public.game_bets
         WHERE round_id = _round_id
           AND status = 'active'
           AND auto_cashout IS NOT NULL
           AND auto_cashout < _round.crash_multiplier
         ORDER BY placed_at
         FOR UPDATE
    LOOP
        _payout := round(_bet.amount * _bet.auto_cashout, 2);

        UPDATE public.game_bets
           SET status = 'cashed_out',
               cashout_multiplier = _bet.auto_cashout,
               payout = _payout,
               cashed_out_at = coalesce(_round.crashed_at, now())
         WHERE id = _bet.id AND status = 'active';

        SELECT id INTO _wallet_id FROM public.wallets
         WHERE user_id = _bet.user_id AND kind = 'betting';

        PERFORM public.wallet_apply(
            _wallet_id, 'win', _payout, 'win:' || _bet.id::text, _round.game, NULL,
            jsonb_build_object('round_id', _round_id, 'multiplier', _bet.auto_cashout, 'auto', true)
        );

        _paid := _paid + 1;
    END LOOP;

    UPDATE public.game_bets
       SET status = 'lost'
     WHERE round_id = _round_id AND status = 'active';

    RETURN _paid;
END;
$function$;