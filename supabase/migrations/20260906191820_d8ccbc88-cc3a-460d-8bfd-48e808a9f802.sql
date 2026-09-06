-- =========================================================
-- Promotions / bonus engine
-- =========================================================

CREATE TABLE public.promotions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    kind text NOT NULL CHECK (kind IN ('first_deposit', 'loss_recovery')),
    name text NOT NULL,
    description text NOT NULL,
    params jsonb NOT NULL DEFAULT '{}',
    active boolean NOT NULL DEFAULT true,
    starts_at timestamptz,
    ends_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promotions TO authenticated;
GRANT SELECT ON public.promotions TO anon;
GRANT ALL ON public.promotions TO service_role;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promotions readable" ON public.promotions FOR SELECT USING (true);
CREATE TRIGGER promotions_set_updated_at BEFORE UPDATE ON public.promotions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.bonus_wallets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    balance numeric(18,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    currency text NOT NULL DEFAULT 'MZN',
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','frozen','closed')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bonus_wallets TO authenticated;
GRANT ALL ON public.bonus_wallets TO service_role;
ALTER TABLE public.bonus_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bonus wallet" ON public.bonus_wallets FOR SELECT TO authenticated
USING (auth.uid() = user_id);
CREATE TRIGGER bonus_wallets_set_updated_at BEFORE UPDATE ON public.bonus_wallets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.bonus_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bonus_wallet_id uuid NOT NULL REFERENCES public.bonus_wallets(id),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('bonus_credit','bonus_bet','bonus_expire','adjustment')),
    amount numeric(18,2) NOT NULL,
    balance_before numeric(18,2) NOT NULL,
    balance_after numeric(18,2) NOT NULL,
    reference text NOT NULL UNIQUE,
    metadata jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bonus_transactions_user_idx ON public.bonus_transactions (user_id, created_at DESC);
GRANT SELECT ON public.bonus_transactions TO authenticated;
GRANT ALL ON public.bonus_transactions TO service_role;
ALTER TABLE public.bonus_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bonus transactions" ON public.bonus_transactions FOR SELECT TO authenticated
USING (auth.uid() = user_id);
CREATE TRIGGER bonus_transactions_immutable BEFORE UPDATE OR DELETE ON public.bonus_transactions
FOR EACH ROW EXECUTE FUNCTION public.reject_ledger_mutation();

CREATE TABLE public.bonus_grants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    promotion_id uuid NOT NULL REFERENCES public.promotions(id),
    kind text NOT NULL CHECK (kind IN ('first_deposit','loss_recovery')),
    amount numeric(18,2) NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'granted' CHECK (status IN ('granted','expired','consumed')),
    reference text NOT NULL UNIQUE,
    expires_at timestamptz,
    metadata jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX bonus_grants_once_idx ON public.bonus_grants (user_id, promotion_id)
WHERE kind = 'first_deposit';
CREATE INDEX bonus_grants_user_idx ON public.bonus_grants (user_id, created_at DESC);
GRANT SELECT ON public.bonus_grants TO authenticated;
GRANT ALL ON public.bonus_grants TO service_role;
ALTER TABLE public.bonus_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bonus grants" ON public.bonus_grants FOR SELECT TO authenticated
USING (auth.uid() = user_id);
CREATE TRIGGER bonus_grants_set_updated_at BEFORE UPDATE ON public.bonus_grants
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.free_bets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    grant_id uuid REFERENCES public.bonus_grants(id) ON DELETE CASCADE,
    min_amount numeric(18,2) NOT NULL DEFAULT 3,
    max_amount numeric(18,2) NOT NULL DEFAULT 10,
    status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','used','expired')),
    used_amount numeric(18,2),
    used_at timestamptz,
    used_context text,
    used_bet_id uuid,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX free_bets_user_status_idx ON public.free_bets (user_id, status, expires_at);
GRANT SELECT ON public.free_bets TO authenticated;
GRANT ALL ON public.free_bets TO service_role;
ALTER TABLE public.free_bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own free bets" ON public.free_bets FOR SELECT TO authenticated
USING (auth.uid() = user_id);
CREATE TRIGGER free_bets_set_updated_at BEFORE UPDATE ON public.free_bets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.loss_streaks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    day date NOT NULL,
    lost_amount numeric(18,2) NOT NULL DEFAULT 0,
    lost_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, day)
);
GRANT SELECT ON public.loss_streaks TO authenticated;
GRANT ALL ON public.loss_streaks TO service_role;
ALTER TABLE public.loss_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own loss streaks" ON public.loss_streaks FOR SELECT TO authenticated
USING (auth.uid() = user_id);
CREATE TRIGGER loss_streaks_set_updated_at BEFORE UPDATE ON public.loss_streaks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.promotions (code, kind, name, description, params) VALUES
('FIRST_DEPOSIT_20', 'first_deposit', 'Bónus de primeiro depósito',
 'No primeiro depósito confirmado recebes 20 MZN de saldo bónus jogável, uma única vez. O bónus não é sacável; os ganhos das apostas feitas com bónus vão para o saldo real. Válido 7 dias. Jogue com responsabilidade.',
 '{"amount": 20, "expires_days": 7}'),
('LOSS_RECOVERY_4', 'loss_recovery', '4 apostas grátis por perdas',
 'Se as tuas perdas reais somarem 200 MZN ou mais no mesmo dia, podes receber 4 apostas grátis de 3 a 10 MZN cada, válidas 24 horas. No máximo uma recompensa por semana. Aposta grátis paga apenas o lucro. Jogue com responsabilidade.',
 '{"threshold": 200, "free_bets": 4, "min_amount": 3, "max_amount": 10, "expires_hours": 24, "cooldown_days": 7}');

-- =========================================================
-- Funding source on bets
-- =========================================================

ALTER TABLE public.game_bets
  ADD COLUMN funding text NOT NULL DEFAULT 'wallet' CHECK (funding IN ('wallet','bonus','free_bet')),
  ADD COLUMN free_bet_id uuid REFERENCES public.free_bets(id);

ALTER TABLE public.bet_slips
  ADD COLUMN funding text NOT NULL DEFAULT 'wallet' CHECK (funding IN ('wallet','bonus','free_bet')),
  ADD COLUMN free_bet_id uuid REFERENCES public.free_bets(id);

-- =========================================================
-- Bonus ledger primitive
-- =========================================================

CREATE OR REPLACE FUNCTION public.ensure_bonus_wallet(_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE _id uuid;
BEGIN
    SELECT id INTO _id FROM public.bonus_wallets WHERE user_id = _user_id;
    IF _id IS NULL THEN
        INSERT INTO public.bonus_wallets (user_id) VALUES (_user_id)
        ON CONFLICT (user_id) DO NOTHING;
        SELECT id INTO _id FROM public.bonus_wallets WHERE user_id = _user_id;
    END IF;
    RETURN _id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.bonus_apply(
    _user_id uuid, _type text, _amount numeric, _reference text, _metadata jsonb DEFAULT '{}'
)
RETURNS public.bonus_transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
    _existing public.bonus_transactions;
    _wallet_id uuid;
    _before numeric(18,2);
    _after numeric(18,2);
    _row public.bonus_transactions;
BEGIN
    SELECT * INTO _existing FROM public.bonus_transactions WHERE reference = _reference;
    IF FOUND THEN RETURN _existing; END IF;

    _wallet_id := public.ensure_bonus_wallet(_user_id);
    SELECT balance INTO _before FROM public.bonus_wallets WHERE id = _wallet_id FOR UPDATE;

    _after := _before + _amount;
    IF _after < 0 THEN RAISE EXCEPTION 'saldo bónus insuficiente'; END IF;

    UPDATE public.bonus_wallets SET balance = _after, updated_at = now() WHERE id = _wallet_id;

    INSERT INTO public.bonus_transactions (
        bonus_wallet_id, user_id, type, amount, balance_before, balance_after, reference, metadata
    ) VALUES (
        _wallet_id, _user_id, _type, _amount, _before, _after, _reference, COALESCE(_metadata, '{}')
    ) RETURNING * INTO _row;

    RETURN _row;
END;
$fn$;

-- =========================================================
-- First deposit bonus
-- =========================================================

CREATE OR REPLACE FUNCTION public.grant_first_deposit_bonus(_user_id uuid, _payment_reference text)
RETURNS public.bonus_grants
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
    _promo public.promotions;
    _grant public.bonus_grants;
    _amount numeric(18,2);
    _days integer;
    _ref text := 'firstdep:' || _payment_reference;
BEGIN
    SELECT * INTO _grant FROM public.bonus_grants WHERE reference = _ref;
    IF FOUND THEN RETURN _grant; END IF;

    SELECT * INTO _promo FROM public.promotions
     WHERE code = 'FIRST_DEPOSIT_20' AND active = true;
    IF NOT FOUND THEN RETURN NULL; END IF;

    IF EXISTS (
        SELECT 1 FROM public.bonus_grants
         WHERE user_id = _user_id AND promotion_id = _promo.id AND kind = 'first_deposit'
    ) THEN
        RETURN NULL;
    END IF;

    _amount := COALESCE((_promo.params->>'amount')::numeric, 20);
    _days := COALESCE((_promo.params->>'expires_days')::integer, 7);

    INSERT INTO public.bonus_grants (user_id, promotion_id, kind, amount, reference, expires_at, metadata)
    VALUES (_user_id, _promo.id, 'first_deposit', _amount, _ref,
            now() + (_days || ' days')::interval,
            jsonb_build_object('payment_reference', _payment_reference))
    RETURNING * INTO _grant;

    PERFORM public.bonus_apply(_user_id, 'bonus_credit', _amount, _ref,
        jsonb_build_object('promotion', _promo.code, 'grant_id', _grant.id));

    INSERT INTO public.notifications (user_id, category, title, body, metadata)
    VALUES (_user_id, 'promotion', 'Bónus de primeiro depósito',
            'Recebeste ' || _amount || ' MZN de saldo bónus jogável. Válido ' || _days || ' dias. Não é sacável.',
            jsonb_build_object('grant_id', _grant.id));

    RETURN _grant;
END;
$fn$;

-- =========================================================
-- Loss tracking + loss recovery free bets
-- =========================================================

CREATE OR REPLACE FUNCTION public.maybe_grant_loss_recovery(_user_id uuid)
RETURNS public.bonus_grants
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
    _promo public.promotions;
    _grant public.bonus_grants;
    _day date := (now() AT TIME ZONE 'Africa/Maputo')::date;
    _lost numeric(18,2);
    _threshold numeric(18,2);
    _count integer;
    _min numeric(18,2);
    _max numeric(18,2);
    _hours integer;
    _cooldown integer;
    _i integer;
BEGIN
    SELECT * INTO _promo FROM public.promotions
     WHERE code = 'LOSS_RECOVERY_4' AND active = true;
    IF NOT FOUND THEN RETURN NULL; END IF;

    _threshold := COALESCE((_promo.params->>'threshold')::numeric, 200);
    _count := COALESCE((_promo.params->>'free_bets')::integer, 4);
    _min := COALESCE((_promo.params->>'min_amount')::numeric, 3);
    _max := COALESCE((_promo.params->>'max_amount')::numeric, 10);
    _hours := COALESCE((_promo.params->>'expires_hours')::integer, 24);
    _cooldown := COALESCE((_promo.params->>'cooldown_days')::integer, 7);

    SELECT lost_amount INTO _lost FROM public.loss_streaks
     WHERE user_id = _user_id AND day = _day;
    IF _lost IS NULL OR _lost < _threshold THEN RETURN NULL; END IF;

    IF EXISTS (
        SELECT 1 FROM public.bonus_grants
         WHERE user_id = _user_id AND kind = 'loss_recovery'
           AND created_at > now() - (_cooldown || ' days')::interval
    ) THEN
        RETURN NULL;
    END IF;

    INSERT INTO public.bonus_grants (user_id, promotion_id, kind, amount, reference, expires_at, metadata)
    VALUES (_user_id, _promo.id, 'loss_recovery', 0,
            'lossrec:' || _user_id::text || ':' || _day::text,
            now() + (_hours || ' hours')::interval,
            jsonb_build_object('lost_amount', _lost, 'day', _day))
    RETURNING * INTO _grant;

    FOR _i IN 1.._count LOOP
        INSERT INTO public.free_bets (user_id, grant_id, min_amount, max_amount, expires_at)
        VALUES (_user_id, _grant.id, _min, _max, _grant.expires_at);
    END LOOP;

    INSERT INTO public.notifications (user_id, category, title, body, metadata)
    VALUES (_user_id, 'promotion', 'Apostas grátis disponíveis',
            'Recebeste ' || _count || ' apostas grátis de ' || _min || ' a ' || _max ||
            ' MZN. Válidas ' || _hours || ' horas. Pagam apenas o lucro.',
            jsonb_build_object('grant_id', _grant.id));

    RETURN _grant;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.record_bet_loss(_user_id uuid, _amount numeric)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE _day date := (now() AT TIME ZONE 'Africa/Maputo')::date;
BEGIN
    IF _amount IS NULL OR _amount <= 0 THEN RETURN; END IF;

    INSERT INTO public.loss_streaks (user_id, day, lost_amount, lost_count)
    VALUES (_user_id, _day, _amount, 1)
    ON CONFLICT (user_id, day) DO UPDATE
       SET lost_amount = public.loss_streaks.lost_amount + _amount,
           lost_count = public.loss_streaks.lost_count + 1,
           updated_at = now();

    PERFORM public.maybe_grant_loss_recovery(_user_id);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.expire_bonuses()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
    _g public.bonus_grants;
    _n integer := 0;
    _balance numeric(18,2);
BEGIN
    UPDATE public.free_bets SET status = 'expired'
     WHERE status = 'available' AND expires_at < now();

    FOR _g IN
        SELECT * FROM public.bonus_grants
         WHERE kind = 'first_deposit' AND status = 'granted'
           AND expires_at IS NOT NULL AND expires_at < now()
    LOOP
        SELECT balance INTO _balance FROM public.bonus_wallets WHERE user_id = _g.user_id;
        IF _balance IS NOT NULL AND _balance > 0 THEN
            PERFORM public.bonus_apply(_g.user_id, 'bonus_expire', -_balance,
                'bonusexp:' || _g.id::text,
                jsonb_build_object('grant_id', _g.id));
        END IF;
        UPDATE public.bonus_grants SET status = 'expired' WHERE id = _g.id;
        _n := _n + 1;
    END LOOP;

    UPDATE public.bonus_grants SET status = 'expired'
     WHERE kind = 'loss_recovery' AND status = 'granted'
       AND expires_at IS NOT NULL AND expires_at < now();

    RETURN _n;
END;
$fn$;

-- =========================================================
-- place_bet with funding source
-- =========================================================

CREATE OR REPLACE FUNCTION public.place_bet(
    _user_id uuid, _round_id uuid, _amount numeric, _auto_cashout numeric,
    _slot integer, _funding text, _free_bet_id uuid
)
RETURNS public.game_bets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
    _round public.game_rounds;
    _wallet_id uuid;
    _bet public.game_bets;
    _fb public.free_bets;
    _src text := COALESCE(_funding, 'wallet');
BEGIN
    IF _src NOT IN ('wallet','bonus','free_bet') THEN
        RAISE EXCEPTION 'origem de saldo invalida';
    END IF;
    IF _slot IS NULL OR _slot NOT IN (1, 2) THEN
        RAISE EXCEPTION 'painel de aposta invalido';
    END IF;

    SELECT * INTO _round FROM public.game_rounds WHERE id = _round_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'ronda inexistente'; END IF;
    IF _round.status <> 'BETTING' THEN RAISE EXCEPTION 'apostas fechadas para esta ronda'; END IF;

    IF _src = 'free_bet' THEN
        SELECT * INTO _fb FROM public.free_bets WHERE id = _free_bet_id FOR UPDATE;
        IF NOT FOUND OR _fb.user_id <> _user_id THEN
            RAISE EXCEPTION 'aposta gratis inexistente';
        END IF;
        IF _fb.status <> 'available' OR _fb.expires_at < now() THEN
            RAISE EXCEPTION 'aposta gratis indisponivel ou expirada';
        END IF;
        IF _amount < _fb.min_amount OR _amount > _fb.max_amount THEN
            RAISE EXCEPTION 'valor da aposta gratis deve estar entre % e % MZN', _fb.min_amount, _fb.max_amount;
        END IF;
    ELSE
        IF _amount IS NULL OR _amount < 3 OR _amount > 25000 THEN
            RAISE EXCEPTION 'valor de aposta deve estar entre 3 e 25000 MZN';
        END IF;
    END IF;

    INSERT INTO public.game_bets (round_id, user_id, amount, auto_cashout, slot, funding, free_bet_id)
    VALUES (_round_id, _user_id, _amount, _auto_cashout, _slot, _src,
            CASE WHEN _src = 'free_bet' THEN _free_bet_id ELSE NULL END)
    RETURNING * INTO _bet;

    IF _src = 'wallet' THEN
        SELECT id INTO _wallet_id FROM public.wallets
         WHERE user_id = _user_id AND kind = 'betting' AND status = 'active';
        IF NOT FOUND THEN RAISE EXCEPTION 'carteira de apostas indisponivel'; END IF;

        PERFORM public.wallet_apply(
            _wallet_id, 'bet', -_amount, 'bet:' || _bet.id::text, _round.game, NULL,
            jsonb_build_object('round_id', _round_id, 'bet_id', _bet.id, 'slot', _slot)
        );
    ELSIF _src = 'bonus' THEN
        PERFORM public.bonus_apply(_user_id, 'bonus_bet', -_amount, 'bonusbet:' || _bet.id::text,
            jsonb_build_object('round_id', _round_id, 'bet_id', _bet.id, 'slot', _slot));
    ELSE
        UPDATE public.free_bets
           SET status = 'used', used_amount = _amount, used_at = now(),
               used_context = _round.game, used_bet_id = _bet.id
         WHERE id = _free_bet_id;
    END IF;

    RETURN _bet;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.place_bet(
    _user_id uuid, _round_id uuid, _amount numeric, _auto_cashout numeric DEFAULT NULL, _slot integer DEFAULT 1
)
RETURNS public.game_bets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  RETURN public.place_bet(_user_id, _round_id, _amount, _auto_cashout, _slot, 'wallet', NULL);
END;
$fn$;

-- =========================================================
-- cashout / settle honouring funding source
-- =========================================================

CREATE OR REPLACE FUNCTION public.cashout_bet(_user_id uuid, _bet_id uuid)
RETURNS public.game_bets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
    _bet public.game_bets;
    _round public.game_rounds;
    _multiplier numeric(12,4);
    _payout numeric(18,2);
    _wallet_id uuid;
BEGIN
    SELECT * INTO _bet FROM public.game_bets WHERE id = _bet_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'aposta inexistente'; END IF;
    IF _bet.user_id <> _user_id THEN RAISE EXCEPTION 'aposta nao pertence ao utilizador'; END IF;
    IF _bet.status <> 'active' THEN RETURN _bet; END IF;

    SELECT * INTO _round FROM public.game_rounds WHERE id = _bet.round_id;
    IF _round.status <> 'RUNNING' THEN RAISE EXCEPTION 'ronda nao esta a correr'; END IF;

    _multiplier := public.crash_multiplier_at(_round.started_at);
    IF _round.crash_multiplier IS NOT NULL AND _multiplier >= _round.crash_multiplier THEN
        RAISE EXCEPTION 'crash ja ocorreu';
    END IF;

    _payout := CASE
        WHEN _bet.funding = 'free_bet' THEN round(_bet.amount * (_multiplier - 1), 2)
        ELSE round(_bet.amount * _multiplier, 2)
    END;

    UPDATE public.game_bets
       SET status = 'cashed_out', cashout_multiplier = _multiplier,
           payout = _payout, cashed_out_at = now()
     WHERE id = _bet_id AND status = 'active'
    RETURNING * INTO _bet;

    IF NOT FOUND THEN
        SELECT * INTO _bet FROM public.game_bets WHERE id = _bet_id;
        RETURN _bet;
    END IF;

    IF _payout > 0 THEN
        SELECT id INTO _wallet_id FROM public.wallets
         WHERE user_id = _user_id AND kind = 'betting';
        PERFORM public.wallet_apply(
            _wallet_id, 'win', _payout, 'win:' || _bet_id::text, _round.game, NULL,
            jsonb_build_object('round_id', _bet.round_id, 'multiplier', _multiplier, 'funding', _bet.funding)
        );
    END IF;

    RETURN _bet;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.settle_round(_round_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
    _round public.game_rounds;
    _bet public.game_bets;
    _wallet_id uuid;
    _payout numeric(18,2);
    _paid integer := 0;
BEGIN
    SELECT * INTO _round FROM public.game_rounds WHERE id = _round_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'ronda inexistente'; END IF;
    IF _round.crash_multiplier IS NULL THEN RAISE EXCEPTION 'ronda sem resultado definido'; END IF;

    FOR _bet IN
        SELECT * FROM public.game_bets
         WHERE round_id = _round_id AND status = 'active'
           AND auto_cashout IS NOT NULL AND auto_cashout < _round.crash_multiplier
         ORDER BY placed_at FOR UPDATE
    LOOP
        _payout := CASE
            WHEN _bet.funding = 'free_bet' THEN round(_bet.amount * (_bet.auto_cashout - 1), 2)
            ELSE round(_bet.amount * _bet.auto_cashout, 2)
        END;

        UPDATE public.game_bets
           SET status = 'cashed_out', cashout_multiplier = _bet.auto_cashout,
               payout = _payout, cashed_out_at = COALESCE(_round.crashed_at, now())
         WHERE id = _bet.id AND status = 'active';

        IF _payout > 0 THEN
            SELECT id INTO _wallet_id FROM public.wallets
             WHERE user_id = _bet.user_id AND kind = 'betting';
            PERFORM public.wallet_apply(
                _wallet_id, 'win', _payout, 'win:' || _bet.id::text, _round.game, NULL,
                jsonb_build_object('round_id', _round_id, 'multiplier', _bet.auto_cashout,
                                   'auto', true, 'funding', _bet.funding)
            );
        END IF;

        _paid := _paid + 1;
    END LOOP;

    FOR _bet IN
        SELECT * FROM public.game_bets
         WHERE round_id = _round_id AND status = 'active' FOR UPDATE
    LOOP
        UPDATE public.game_bets SET status = 'lost' WHERE id = _bet.id;
        IF _bet.funding = 'wallet' THEN
            PERFORM public.record_bet_loss(_bet.user_id, _bet.amount);
        END IF;
    END LOOP;

    RETURN _paid;
END;
$fn$;

-- =========================================================
-- sports slips with funding source
-- =========================================================

CREATE OR REPLACE FUNCTION public.place_bet_slip(
    _user_id uuid, _selections jsonb, _stake numeric, _idempotency_key text,
    _funding text, _free_bet_id uuid
)
RETURNS public.bet_slips
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  _slip public.bet_slips;
  _item jsonb;
  _count integer;
  _event public.sport_events;
  _odd public.sport_odds;
  _total numeric(12,3) := 1;
  _payout numeric(18,2);
  _kind text;
  _wallet_id uuid;
  _event_ids uuid[] := '{}';
  _fb public.free_bets;
  _src text := COALESCE(_funding, 'wallet');
BEGIN
  SELECT * INTO _slip FROM public.bet_slips WHERE idempotency_key = _idempotency_key;
  IF FOUND THEN RETURN _slip; END IF;

  IF _src NOT IN ('wallet','bonus','free_bet') THEN
    RAISE EXCEPTION 'origem de saldo invalida';
  END IF;

  IF _src = 'free_bet' THEN
    SELECT * INTO _fb FROM public.free_bets WHERE id = _free_bet_id FOR UPDATE;
    IF NOT FOUND OR _fb.user_id <> _user_id THEN RAISE EXCEPTION 'aposta gratis inexistente'; END IF;
    IF _fb.status <> 'available' OR _fb.expires_at < now() THEN
      RAISE EXCEPTION 'aposta gratis indisponivel ou expirada';
    END IF;
    IF _stake < _fb.min_amount OR _stake > _fb.max_amount THEN
      RAISE EXCEPTION 'valor da aposta gratis deve estar entre % e % MZN', _fb.min_amount, _fb.max_amount;
    END IF;
  ELSE
    IF _stake IS NULL OR _stake < 3 OR _stake > 25000 THEN
      RAISE EXCEPTION 'valor da aposta deve estar entre 3 e 25000 MZN';
    END IF;
  END IF;

  _count := jsonb_array_length(COALESCE(_selections, '[]'::jsonb));
  IF _count < 1 OR _count > 12 THEN
    RAISE EXCEPTION 'bilhete deve ter entre 1 e 12 selecoes';
  END IF;
  IF _src = 'free_bet' AND _count <> 1 THEN
    RAISE EXCEPTION 'aposta gratis so pode ser usada em bilhete simples';
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(_selections) LOOP
    SELECT * INTO _event FROM public.sport_events WHERE id = (_item->>'event_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'jogo inexistente'; END IF;
    IF _event.status <> 'scheduled' OR _event.commence_at <= now() THEN
      RAISE EXCEPTION 'jogo já começou ou está suspenso: % vs %', _event.home_team, _event.away_team;
    END IF;
    IF _event.id = ANY(_event_ids) THEN
      RAISE EXCEPTION 'nao e possivel combinar duas selecoes do mesmo jogo';
    END IF;
    _event_ids := _event_ids || _event.id;

    SELECT * INTO _odd FROM public.sport_odds
     WHERE event_id = _event.id
       AND market = (_item->>'market')
       AND selection = (_item->>'selection')
       AND COALESCE(line, -999) = COALESCE((_item->>'line')::numeric, -999)
       AND active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'cotacao indisponivel'; END IF;

    IF abs(_odd.price - (_item->>'price')::numeric) > 0.001 THEN
      RAISE EXCEPTION 'cotacao alterada: % passou para %', (_item->>'price'), _odd.price;
    END IF;

    _total := round(_total * _odd.price, 3);
  END LOOP;

  _payout := CASE
    WHEN _src = 'free_bet' THEN round(_stake * (_total - 1), 2)
    ELSE round(_stake * _total, 2)
  END;
  IF _payout > 500000 THEN
    RAISE EXCEPTION 'ganho potencial acima do limite de 500000 MZN';
  END IF;

  _kind := CASE WHEN _count = 1 THEN 'single' ELSE 'multiple' END;

  INSERT INTO public.bet_slips (user_id, kind, stake, total_odds, potential_payout, reference,
                                idempotency_key, funding, free_bet_id)
  VALUES (_user_id, _kind, _stake, _total, _payout, 'slip:' || gen_random_uuid()::text,
          _idempotency_key, _src,
          CASE WHEN _src = 'free_bet' THEN _free_bet_id ELSE NULL END)
  RETURNING * INTO _slip;

  FOR _item IN SELECT * FROM jsonb_array_elements(_selections) LOOP
    INSERT INTO public.bet_selections (slip_id, event_id, market, selection, line, price)
    VALUES (_slip.id, (_item->>'event_id')::uuid, (_item->>'market'), (_item->>'selection'),
            (_item->>'line')::numeric, (_item->>'price')::numeric);
  END LOOP;

  IF _src = 'wallet' THEN
    SELECT id INTO _wallet_id FROM public.wallets
     WHERE user_id = _user_id AND kind = 'betting' AND status = 'active';
    IF NOT FOUND THEN RAISE EXCEPTION 'carteira de apostas indisponivel'; END IF;

    PERFORM public.wallet_apply(
      _wallet_id, 'bet', -_stake, 'slipbet:' || _slip.id::text, 'sports', NULL,
      jsonb_build_object('slip_id', _slip.id, 'selections', _count, 'total_odds', _total)
    );
  ELSIF _src = 'bonus' THEN
    PERFORM public.bonus_apply(_user_id, 'bonus_bet', -_stake, 'bonusslip:' || _slip.id::text,
      jsonb_build_object('slip_id', _slip.id, 'selections', _count));
  ELSE
    UPDATE public.free_bets
       SET status = 'used', used_amount = _stake, used_at = now(),
           used_context = 'sports', used_bet_id = _slip.id
     WHERE id = _free_bet_id;
  END IF;

  RETURN _slip;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.place_bet_slip(
    _user_id uuid, _selections jsonb, _stake numeric, _idempotency_key text
)
RETURNS public.bet_slips
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  RETURN public.place_bet_slip(_user_id, _selections, _stake, _idempotency_key, 'wallet', NULL);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.resolve_bet_slips()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  _slip public.bet_slips;
  _pending integer;
  _lost integer;
  _odds numeric(12,3);
  _payout numeric(18,2);
  _wallet_id uuid;
  _resolved integer := 0;
  _all_void boolean;
BEGIN
  FOR _slip IN
    SELECT * FROM public.bet_slips WHERE status = 'open' FOR UPDATE
  LOOP
    SELECT count(*) FILTER (WHERE result = 'pending'),
           count(*) FILTER (WHERE result = 'lost'),
           COALESCE(bool_and(result = 'void'), false)
      INTO _pending, _lost, _all_void
      FROM public.bet_selections WHERE slip_id = _slip.id;

    IF _lost > 0 THEN
      UPDATE public.bet_slips
         SET status = 'lost', payout = 0, settled_at = now()
       WHERE id = _slip.id;
      IF _slip.funding = 'wallet' THEN
        PERFORM public.record_bet_loss(_slip.user_id, _slip.stake);
      END IF;
      INSERT INTO public.notifications (user_id, category, title, body, metadata)
      VALUES (_slip.user_id, 'betting', 'Bilhete perdido',
              'O teu bilhete ' || _slip.reference || ' não foi premiado.',
              jsonb_build_object('slip_id', _slip.id));
      _resolved := _resolved + 1;
      CONTINUE;
    END IF;

    IF _pending > 0 THEN CONTINUE; END IF;

    SELECT COALESCE(round(exp(sum(ln(CASE WHEN result = 'void' THEN 1 ELSE price END)))::numeric, 3), 1)
      INTO _odds FROM public.bet_selections WHERE slip_id = _slip.id;

    _payout := CASE
      WHEN _slip.funding = 'free_bet' THEN round(_slip.stake * (_odds - 1), 2)
      ELSE round(_slip.stake * _odds, 2)
    END;

    UPDATE public.bet_slips
       SET status = CASE WHEN _all_void THEN 'void' ELSE 'won' END,
           payout = _payout, total_odds = _odds, settled_at = now()
     WHERE id = _slip.id;

    IF _slip.funding = 'bonus' AND _all_void THEN
      PERFORM public.bonus_apply(_slip.user_id, 'bonus_credit', _slip.stake,
        'bonusvoid:' || _slip.id::text, jsonb_build_object('slip_id', _slip.id));
    ELSE
      SELECT id INTO _wallet_id FROM public.wallets
       WHERE user_id = _slip.user_id AND kind = 'betting';

      IF _wallet_id IS NOT NULL AND _payout > 0 THEN
        PERFORM public.wallet_apply(
          _wallet_id,
          CASE WHEN _all_void THEN 'refund' ELSE 'win' END,
          _payout, 'slipwin:' || _slip.id::text, 'sports', NULL,
          jsonb_build_object('slip_id', _slip.id, 'total_odds', _odds, 'funding', _slip.funding)
        );
      END IF;
    END IF;

    INSERT INTO public.notifications (user_id, category, title, body, metadata)
    VALUES (_slip.user_id, 'betting',
            CASE WHEN _all_void THEN 'Bilhete anulado' ELSE 'Bilhete premiado' END,
            'Bilhete ' || _slip.reference || ' liquidado.',
            jsonb_build_object('slip_id', _slip.id, 'payout', _payout));

    _resolved := _resolved + 1;
  END LOOP;

  RETURN _resolved;
END;
$fn$;

REVOKE ALL ON FUNCTION public.bonus_apply(uuid, text, numeric, text, jsonb) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_bonus_wallet(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_first_deposit_bonus(uuid, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_bet_loss(uuid, numeric) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.maybe_grant_loss_recovery(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_bonuses() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bonus_apply(uuid, text, numeric, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_bonus_wallet(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_first_deposit_bonus(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_bet_loss(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.maybe_grant_loss_recovery(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_bonuses() TO service_role;
GRANT EXECUTE ON FUNCTION public.place_bet(uuid, uuid, numeric, numeric, integer, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.place_bet_slip(uuid, jsonb, numeric, text, text, uuid) TO service_role;