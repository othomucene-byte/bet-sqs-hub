-- ============ CATÁLOGO PÚBLICO ============
CREATE TABLE public.sports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  grouping text NOT NULL DEFAULT 'Outros',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sports TO anon, authenticated;
GRANT ALL ON public.sports TO service_role;
ALTER TABLE public.sports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sports_public_read" ON public.sports FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.sport_competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_id uuid NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  region text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sport_competitions TO anon, authenticated;
GRANT ALL ON public.sport_competitions TO service_role;
ALTER TABLE public.sport_competitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sport_competitions_public_read" ON public.sport_competitions FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.sport_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.sport_competitions(id) ON DELETE CASCADE,
  provider_event_id text NOT NULL UNIQUE,
  home_team text NOT NULL,
  away_team text NOT NULL,
  commence_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  home_score integer,
  away_score integer,
  odds_updated_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sport_events_status_check CHECK (status IN ('scheduled','live','closed','settled','void'))
);
CREATE INDEX sport_events_commence_idx ON public.sport_events (commence_at);
CREATE INDEX sport_events_competition_idx ON public.sport_events (competition_id);
GRANT SELECT ON public.sport_events TO anon, authenticated;
GRANT ALL ON public.sport_events TO service_role;
ALTER TABLE public.sport_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sport_events_public_read" ON public.sport_events FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.sport_odds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.sport_events(id) ON DELETE CASCADE,
  market text NOT NULL,
  selection text NOT NULL,
  line numeric(8,2),
  price numeric(10,3) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sport_odds_market_check CHECK (market IN ('h2h','dc','totals','btts')),
  CONSTRAINT sport_odds_price_check CHECK (price >= 1.01 AND price <= 1000)
);
CREATE UNIQUE INDEX sport_odds_unique_idx
  ON public.sport_odds (event_id, market, selection, COALESCE(line, -999));
GRANT SELECT ON public.sport_odds TO anon, authenticated;
GRANT ALL ON public.sport_odds TO service_role;
ALTER TABLE public.sport_odds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sport_odds_public_read" ON public.sport_odds FOR SELECT TO anon, authenticated USING (true);

-- ============ BILHETES ============
CREATE TABLE public.bet_slips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  stake numeric(18,2) NOT NULL,
  total_odds numeric(12,3) NOT NULL,
  potential_payout numeric(18,2) NOT NULL,
  payout numeric(18,2),
  status text NOT NULL DEFAULT 'open',
  reference text NOT NULL UNIQUE,
  idempotency_key text NOT NULL UNIQUE,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bet_slips_kind_check CHECK (kind IN ('single','multiple')),
  CONSTRAINT bet_slips_status_check CHECK (status IN ('open','won','lost','void'))
);
CREATE INDEX bet_slips_user_idx ON public.bet_slips (user_id, created_at DESC);
GRANT SELECT ON public.bet_slips TO authenticated;
GRANT ALL ON public.bet_slips TO service_role;
ALTER TABLE public.bet_slips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bet_slips_owner_read" ON public.bet_slips FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.bet_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slip_id uuid NOT NULL REFERENCES public.bet_slips(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.sport_events(id) ON DELETE RESTRICT,
  market text NOT NULL,
  selection text NOT NULL,
  line numeric(8,2),
  price numeric(10,3) NOT NULL,
  result text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bet_selections_result_check CHECK (result IN ('pending','won','lost','void'))
);
CREATE INDEX bet_selections_slip_idx ON public.bet_selections (slip_id);
CREATE INDEX bet_selections_event_idx ON public.bet_selections (event_id);
GRANT SELECT ON public.bet_selections TO authenticated;
GRANT ALL ON public.bet_selections TO service_role;
ALTER TABLE public.bet_selections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bet_selections_owner_read" ON public.bet_selections FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bet_slips s WHERE s.id = slip_id AND s.user_id = auth.uid()));

CREATE TRIGGER sports_set_updated_at BEFORE UPDATE ON public.sports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sport_competitions_set_updated_at BEFORE UPDATE ON public.sport_competitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sport_events_set_updated_at BEFORE UPDATE ON public.sport_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sport_odds_set_updated_at BEFORE UPDATE ON public.sport_odds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER bet_slips_set_updated_at BEFORE UPDATE ON public.bet_slips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ RESULTADO DE UMA SELEÇÃO ============
CREATE OR REPLACE FUNCTION public.sport_selection_outcome(
  _market text, _selection text, _line numeric, _home integer, _away integer
) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = public
AS $fn$
DECLARE
  _total integer;
BEGIN
  IF _home IS NULL OR _away IS NULL THEN
    RETURN 'void';
  END IF;
  _total := _home + _away;

  IF _market = 'h2h' THEN
    IF _selection = 'HOME' THEN RETURN CASE WHEN _home > _away THEN 'won' ELSE 'lost' END; END IF;
    IF _selection = 'AWAY' THEN RETURN CASE WHEN _away > _home THEN 'won' ELSE 'lost' END; END IF;
    IF _selection = 'DRAW' THEN RETURN CASE WHEN _home = _away THEN 'won' ELSE 'lost' END; END IF;
    RETURN 'void';
  END IF;

  IF _market = 'dc' THEN
    IF _selection = '1X' THEN RETURN CASE WHEN _home >= _away THEN 'won' ELSE 'lost' END; END IF;
    IF _selection = 'X2' THEN RETURN CASE WHEN _away >= _home THEN 'won' ELSE 'lost' END; END IF;
    IF _selection = '12' THEN RETURN CASE WHEN _home <> _away THEN 'won' ELSE 'lost' END; END IF;
    RETURN 'void';
  END IF;

  IF _market = 'totals' THEN
    IF _line IS NULL THEN RETURN 'void'; END IF;
    IF _total::numeric = _line THEN RETURN 'void'; END IF;
    IF _selection = 'OVER' THEN RETURN CASE WHEN _total::numeric > _line THEN 'won' ELSE 'lost' END; END IF;
    IF _selection = 'UNDER' THEN RETURN CASE WHEN _total::numeric < _line THEN 'won' ELSE 'lost' END; END IF;
    RETURN 'void';
  END IF;

  IF _market = 'btts' THEN
    IF _selection = 'YES' THEN RETURN CASE WHEN _home > 0 AND _away > 0 THEN 'won' ELSE 'lost' END; END IF;
    IF _selection = 'NO' THEN RETURN CASE WHEN _home = 0 OR _away = 0 THEN 'won' ELSE 'lost' END; END IF;
    RETURN 'void';
  END IF;

  RETURN 'void';
END;
$fn$;

-- ============ REGISTO DE BILHETE ============
CREATE OR REPLACE FUNCTION public.place_bet_slip(
  _user_id uuid, _selections jsonb, _stake numeric, _idempotency_key text
) RETURNS bet_slips
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
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
BEGIN
  SELECT * INTO _slip FROM public.bet_slips WHERE idempotency_key = _idempotency_key;
  IF FOUND THEN RETURN _slip; END IF;

  IF _stake IS NULL OR _stake < 3 OR _stake > 25000 THEN
    RAISE EXCEPTION 'valor da aposta deve estar entre 3 e 25000 MZN';
  END IF;

  _count := jsonb_array_length(COALESCE(_selections, '[]'::jsonb));
  IF _count < 1 OR _count > 12 THEN
    RAISE EXCEPTION 'bilhete deve ter entre 1 e 12 selecoes';
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(_selections) LOOP
    SELECT * INTO _event FROM public.sport_events
     WHERE id = (_item->>'event_id')::uuid;
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

  _payout := round(_stake * _total, 2);
  IF _payout > 500000 THEN
    RAISE EXCEPTION 'ganho potencial acima do limite de 500000 MZN';
  END IF;

  _kind := CASE WHEN _count = 1 THEN 'single' ELSE 'multiple' END;

  INSERT INTO public.bet_slips (user_id, kind, stake, total_odds, potential_payout, reference, idempotency_key)
  VALUES (_user_id, _kind, _stake, _total, _payout, 'slip:' || gen_random_uuid()::text, _idempotency_key)
  RETURNING * INTO _slip;

  FOR _item IN SELECT * FROM jsonb_array_elements(_selections) LOOP
    INSERT INTO public.bet_selections (slip_id, event_id, market, selection, line, price)
    VALUES (
      _slip.id,
      (_item->>'event_id')::uuid,
      (_item->>'market'),
      (_item->>'selection'),
      (_item->>'line')::numeric,
      (_item->>'price')::numeric
    );
  END LOOP;

  SELECT id INTO _wallet_id FROM public.wallets
   WHERE user_id = _user_id AND kind = 'betting' AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'carteira de apostas indisponivel'; END IF;

  PERFORM public.wallet_apply(
    _wallet_id, 'bet', -_stake, 'slipbet:' || _slip.id::text, 'sports', NULL,
    jsonb_build_object('slip_id', _slip.id, 'selections', _count, 'total_odds', _total)
  );

  RETURN _slip;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.place_bet_slip(uuid, jsonb, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_bet_slip(uuid, jsonb, numeric, text) TO service_role;

-- ============ RESOLVER BILHETES DE UM CONJUNTO DE JOGOS ============
CREATE OR REPLACE FUNCTION public.resolve_bet_slips()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
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

    _payout := round(_slip.stake * _odds, 2);

    UPDATE public.bet_slips
       SET status = CASE WHEN _all_void THEN 'void' ELSE 'won' END,
           payout = _payout,
           total_odds = _odds,
           settled_at = now()
     WHERE id = _slip.id;

    SELECT id INTO _wallet_id FROM public.wallets
     WHERE user_id = _slip.user_id AND kind = 'betting';

    IF _wallet_id IS NOT NULL AND _payout > 0 THEN
      PERFORM public.wallet_apply(
        _wallet_id,
        CASE WHEN _all_void THEN 'refund' ELSE 'win' END,
        _payout, 'slipwin:' || _slip.id::text, 'sports', NULL,
        jsonb_build_object('slip_id', _slip.id, 'total_odds', _odds)
      );
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

REVOKE EXECUTE ON FUNCTION public.resolve_bet_slips() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_bet_slips() TO service_role;

-- ============ LIQUIDAR / ANULAR JOGO ============
CREATE OR REPLACE FUNCTION public.settle_sport_event(_event_id uuid, _home integer, _away integer)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  _event public.sport_events;
BEGIN
  SELECT * INTO _event FROM public.sport_events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'jogo inexistente'; END IF;
  IF _event.status = 'settled' THEN RETURN 0; END IF;
  IF _home IS NULL OR _away IS NULL THEN RAISE EXCEPTION 'resultado invalido'; END IF;

  UPDATE public.sport_events
     SET status = 'settled', home_score = _home, away_score = _away, settled_at = now()
   WHERE id = _event_id;

  UPDATE public.sport_odds SET active = false WHERE event_id = _event_id;

  UPDATE public.bet_selections
     SET result = public.sport_selection_outcome(market, selection, line, _home, _away)
   WHERE event_id = _event_id AND result = 'pending';

  RETURN public.resolve_bet_slips();
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.settle_sport_event(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_sport_event(uuid, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.void_sport_event(_event_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  UPDATE public.sport_events
     SET status = 'void', settled_at = now()
   WHERE id = _event_id AND status <> 'settled';

  UPDATE public.sport_odds SET active = false WHERE event_id = _event_id;

  UPDATE public.bet_selections SET result = 'void'
   WHERE event_id = _event_id AND result = 'pending';

  RETURN public.resolve_bet_slips();
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.void_sport_event(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.void_sport_event(uuid) TO service_role;
