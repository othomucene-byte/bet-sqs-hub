CREATE OR REPLACE FUNCTION public.place_bet(_user_id uuid, _round_id uuid, _amount numeric, _auto_cashout numeric DEFAULT NULL::numeric)
RETURNS public.game_bets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.place_bet(_user_id, _round_id, _amount, _auto_cashout, 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.place_bet(_user_id uuid, _round_id uuid, _amount numeric, _auto_cashout numeric DEFAULT NULL::numeric, _slot integer DEFAULT 1)
RETURNS public.game_bets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _round public.game_rounds;
  _wallet_id uuid;
  _bet public.game_bets;
BEGIN
  IF _amount IS NULL OR _amount < 3 OR _amount > 25000 THEN
    RAISE EXCEPTION 'valor de aposta deve estar entre 3 e 25000 MZN';
  END IF;
  IF _slot IS NULL OR _slot NOT IN (1, 2) THEN
    RAISE EXCEPTION 'painel de aposta invalido';
  END IF;

  SELECT * INTO _round FROM public.game_rounds WHERE id = _round_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ronda inexistente';
  END IF;
  IF _round.status <> 'BETTING' THEN
    RAISE EXCEPTION 'apostas fechadas para esta ronda';
  END IF;

  SELECT id INTO _wallet_id FROM public.wallets
  WHERE user_id = _user_id AND kind = 'betting' AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'carteira de apostas indisponivel';
  END IF;

  INSERT INTO public.game_bets (round_id, user_id, amount, auto_cashout, slot)
  VALUES (_round_id, _user_id, _amount, _auto_cashout, _slot)
  RETURNING * INTO _bet;

  PERFORM public.wallet_apply(
    _wallet_id, 'bet', -_amount, 'bet:' || _bet.id::text, _round.game, NULL,
    jsonb_build_object('round_id', _round_id, 'bet_id', _bet.id, 'slot', _slot)
  );

  RETURN _bet;
END;
$$;