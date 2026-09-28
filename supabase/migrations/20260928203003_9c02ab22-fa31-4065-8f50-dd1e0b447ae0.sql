-- =============================================================================
-- Programa de afiliados Betfcom: comissão de 5% sobre o valor apostado ou
-- investido (rev-share) e link de afiliado válido por 1 ano.
-- Sem tarefas agendadas: a disponibilidade deriva do prazo de validação.
-- =============================================================================

-- 1) Configuração: validade do link de afiliado (dias)
ALTER TABLE public.affiliate_config ADD COLUMN IF NOT EXISTS link_validity_days integer NOT NULL DEFAULT 365;
ALTER TABLE public.affiliate_config DROP CONSTRAINT IF EXISTS affiliate_config_link_validity_days_check;
ALTER TABLE public.affiliate_config ADD CONSTRAINT affiliate_config_link_validity_days_check CHECK (link_validity_days > 0);

-- 2) Afiliados: termo do link criado
ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS expires_at timestamptz;
UPDATE public.affiliates
   SET expires_at = created_at + make_interval(days => coalesce((SELECT link_validity_days FROM public.affiliate_config WHERE id = 1), 365))
 WHERE expires_at IS NULL;
ALTER TABLE public.affiliates ALTER COLUMN expires_at SET NOT NULL;
CREATE INDEX IF NOT EXISTS affiliates_expires_at_idx ON public.affiliates (expires_at);

-- 3) Comissões: várias por referido (uma por aposta/investimento), idempotentes por origem
ALTER TABLE public.affiliate_commissions DROP CONSTRAINT IF EXISTS affiliate_commissions_referral_id_key;
ALTER TABLE public.affiliate_commissions ADD COLUMN IF NOT EXISTS source_kind text;
ALTER TABLE public.affiliate_commissions ADD COLUMN IF NOT EXISTS source_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_commissions_source_key ON public.affiliate_commissions (source_kind, source_id);
CREATE INDEX IF NOT EXISTS affiliate_commissions_due_idx ON public.affiliate_commissions (status, available_at);

-- 4) Função central: cria comissão sobre um montante apostado/investido
CREATE OR REPLACE FUNCTION public.affiliate_commission_for(_user_id uuid, _event text, _base numeric, _source_kind text, _source_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE c public.affiliate_config; r public.affiliate_referrals; a public.affiliates; _amt numeric;
BEGIN
  IF _user_id IS NULL OR _source_id IS NULL OR coalesce(_base, 0) <= 0 THEN RETURN; END IF;
  SELECT * INTO c FROM affiliate_config WHERE id = 1;
  IF c IS NULL OR NOT c.enabled THEN RETURN; END IF;
  SELECT * INTO r FROM affiliate_referrals WHERE referred_user_id = _user_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO a FROM affiliates WHERE id = r.affiliate_id;
  IF NOT FOUND OR a.status <> 'active' THEN RETURN; END IF;
  IF a.expires_at IS NOT NULL AND now() >= a.expires_at THEN RETURN; END IF;
  _amt := CASE WHEN c.commission_type = 'fixed' THEN c.commission_value ELSE round(_base * c.commission_value / 100, 2) END;
  IF _amt <= 0 THEN RETURN; END IF;
  INSERT INTO affiliate_commissions(affiliate_id, referral_id, event, base_amount, amount, available_at, source_kind, source_id)
  VALUES (r.affiliate_id, r.id, _event, _base, _amt, now() + make_interval(days => c.validation_days), _source_kind, _source_id)
  ON CONFLICT (source_kind, source_id) DO NOTHING;
END
$fn$;
REVOKE ALL ON FUNCTION public.affiliate_commission_for(uuid, text, numeric, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.affiliate_commission_for(uuid, text, numeric, text, uuid) TO service_role;

-- 5) Eventos antigos (cadastro / 1.º depósito) passam a deduplicar por origem
CREATE OR REPLACE FUNCTION public.affiliate_create_commission(_referral_id uuid, _event text, _base numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE c public.affiliate_config; r public.affiliate_referrals; _amt numeric;
BEGIN
  SELECT * INTO c FROM affiliate_config WHERE id = 1;
  IF c IS NULL OR NOT c.enabled OR c.trigger_event <> _event THEN RETURN; END IF;
  IF _event = 'first_deposit' AND _base < c.min_deposit THEN RETURN; END IF;
  SELECT * INTO r FROM affiliate_referrals WHERE id = _referral_id;
  IF NOT FOUND THEN RETURN; END IF;
  _amt := CASE WHEN c.commission_type = 'fixed' THEN c.commission_value ELSE round(_base * c.commission_value / 100, 2) END;
  IF _amt <= 0 THEN RETURN; END IF;
  INSERT INTO affiliate_commissions(affiliate_id, referral_id, event, base_amount, amount, available_at, source_kind, source_id)
  VALUES (r.affiliate_id, r.id, _event, _base, _amt, now() + make_interval(days => c.validation_days), 'referral_' || _event, r.id)
  ON CONFLICT (source_kind, source_id) DO NOTHING;
END
$fn$;

-- 6) Trigger único para apostas e investimentos: cria comissão no registo,
--    estorna quando a aposta/investimento é anulado ou reembolsado
CREATE OR REPLACE FUNCTION public.affiliate_on_wager()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE _r jsonb; _base numeric; _fund text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status IN ('refunded','void','cancelled','voided','annulled','postponed') THEN
      UPDATE affiliate_commissions
         SET status = 'reversed',
             note = coalesce(nullif(note, ''), 'estorno automático: ') || NEW.status,
             decided_at = coalesce(decided_at, now())
       WHERE source_kind = TG_TABLE_NAME AND source_id = NEW.id
         AND status IN ('pending','approved');
    END IF;
    RETURN NEW;
  END IF;

  _r := to_jsonb(NEW);
  _base := coalesce((_r->>'amount')::numeric, (_r->>'stake')::numeric, 0);
  IF _base <= 0 THEN RETURN NEW; END IF;
  IF _r->>'status' IN ('refunded','void','cancelled') THEN RETURN NEW; END IF;
  _fund := _r->>'funding';
  IF _fund IS NOT NULL AND _fund <> 'wallet' THEN RETURN NEW; END IF;
  IF (_r->>'free_bet_id') IS NOT NULL THEN RETURN NEW; END IF;

  PERFORM affiliate_commission_for(
    (_r->>'user_id')::uuid,
    CASE WHEN TG_TABLE_NAME = 'investments' THEN 'investment' ELSE 'bet' END,
    _base, TG_TABLE_NAME, (_r->>'id')::uuid);
  RETURN NEW;
END
$fn$;
REVOKE ALL ON FUNCTION public.affiliate_on_wager() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS affiliate_wager ON public.game_bets;
CREATE TRIGGER affiliate_wager AFTER INSERT OR UPDATE OF status ON public.game_bets FOR EACH ROW EXECUTE FUNCTION public.affiliate_on_wager();
DROP TRIGGER IF EXISTS affiliate_wager ON public.bet_slips;
CREATE TRIGGER affiliate_wager AFTER INSERT OR UPDATE OF status ON public.bet_slips FOR EACH ROW EXECUTE FUNCTION public.affiliate_on_wager();
DROP TRIGGER IF EXISTS affiliate_wager ON public.instant_rounds;
CREATE TRIGGER affiliate_wager AFTER INSERT OR UPDATE OF status ON public.instant_rounds FOR EACH ROW EXECUTE FUNCTION public.affiliate_on_wager();
DROP TRIGGER IF EXISTS affiliate_wager ON public.investments;
CREATE TRIGGER affiliate_wager AFTER INSERT OR UPDATE OF status ON public.investments FOR EACH ROW EXECUTE FUNCTION public.affiliate_on_wager();

-- 7) Saldo: comissões aprovadas + pendências cujo prazo de validação já terminou
CREATE OR REPLACE FUNCTION public.affiliate_available(_affiliate_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT coalesce((SELECT sum(amount) FROM affiliate_commissions
                    WHERE affiliate_id = _affiliate_id
                      AND (status = 'approved'
                           OR (status = 'pending' AND available_at <= now()))),0)
       - coalesce((SELECT sum(amount) FROM affiliate_payouts
                    WHERE affiliate_id = _affiliate_id AND status <> 'rejected'),0)
$fn$;

-- 8) Validade do link nos pontos de entrada
CREATE OR REPLACE FUNCTION public.affiliate_track_click(_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE _id uuid; _exp timestamptz;
BEGIN
  SELECT id, expires_at INTO _id, _exp FROM affiliates WHERE code = upper(_code) AND status = 'active';
  IF NOT FOUND THEN RETURN false; END IF;
  IF _exp IS NOT NULL AND now() >= _exp THEN RETURN false; END IF;
  INSERT INTO affiliate_clicks(affiliate_id) VALUES (_id);
  RETURN true;
END
$fn$;

CREATE OR REPLACE FUNCTION public.affiliate_claim(_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE _aff public.affiliates; _created timestamptz; _hours int; _rid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'unauthenticated'; END IF;
  SELECT * INTO _aff FROM affiliates WHERE code = upper(_code) AND status = 'active';
  IF NOT FOUND THEN RETURN 'invalid_code'; END IF;
  IF _aff.expires_at IS NOT NULL AND now() >= _aff.expires_at THEN RETURN 'link_expired'; END IF;
  IF _aff.user_id = auth.uid() THEN RETURN 'self_referral'; END IF;
  IF EXISTS (SELECT 1 FROM affiliate_referrals WHERE referred_user_id = auth.uid()) THEN RETURN 'already_referred'; END IF;
  SELECT attribution_hours INTO _hours FROM affiliate_config WHERE id = 1;
  SELECT created_at INTO _created FROM auth.users WHERE id = auth.uid();
  IF _created < now() - make_interval(hours => coalesce(_hours, 24)) THEN RETURN 'account_too_old'; END IF;
  INSERT INTO affiliate_referrals(affiliate_id, referred_user_id) VALUES (_aff.id, auth.uid()) RETURNING id INTO _rid;
  PERFORM affiliate_create_commission(_rid, 'signup', 0);
  RETURN 'ok';
END
$fn$;

CREATE OR REPLACE FUNCTION public.affiliate_join()
RETURNS affiliates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE _row public.affiliates; _code text; _days int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  SELECT * INTO _row FROM affiliates WHERE user_id = auth.uid();
  IF FOUND THEN RETURN _row; END IF;
  SELECT link_validity_days INTO _days FROM affiliate_config WHERE id = 1;
  LOOP
    _code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM affiliates WHERE code = _code);
  END LOOP;
  INSERT INTO affiliates(user_id, code, expires_at)
  VALUES (auth.uid(), _code, now() + make_interval(days => coalesce(_days, 365)))
  RETURNING * INTO _row;
  RETURN _row;
END
$fn$;

-- 9) O painel de regras passa a poder ajustar a validade do link
CREATE OR REPLACE FUNCTION public.affiliate_admin_config(_cfg jsonb)
RETURNS affiliate_config
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE _row public.affiliate_config;
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'proibido'; END IF;
  UPDATE affiliate_config SET
    enabled = coalesce((_cfg->>'enabled')::boolean, enabled),
    commission_type = coalesce(_cfg->>'commission_type', commission_type),
    commission_value = coalesce((_cfg->>'commission_value')::numeric, commission_value),
    trigger_event = coalesce(_cfg->>'trigger_event', trigger_event),
    min_deposit = coalesce((_cfg->>'min_deposit')::numeric, min_deposit),
    attribution_hours = coalesce((_cfg->>'attribution_hours')::int, attribution_hours),
    validation_days = coalesce((_cfg->>'validation_days')::int, validation_days),
    min_payout = coalesce((_cfg->>'min_payout')::numeric, min_payout),
    link_validity_days = coalesce((_cfg->>'link_validity_days')::int, link_validity_days),
    reversal_rules = coalesce(_cfg->>'reversal_rules', reversal_rules),
    updated_at = now()
  WHERE id = 1 RETURNING * INTO _row;
  PERFORM exchange_audit(auth.uid(), 'affiliate_config', 'affiliate_config', NULL, _cfg);
  RETURN _row;
END
$fn$;

-- 10) Regras em vigor: 5% do valor apostado ou investido, link válido 1 ano
UPDATE public.affiliate_config
   SET enabled = true,
       commission_type = 'percent',
       commission_value = 5,
       trigger_event = 'signup',
       link_validity_days = 365,
       updated_at = now()
 WHERE id = 1;