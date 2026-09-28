CREATE TABLE public.affiliate_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  commission_type text NOT NULL DEFAULT 'percent' CHECK (commission_type IN ('fixed','percent')),
  commission_value numeric(18,2) NOT NULL DEFAULT 0 CHECK (commission_value >= 0),
  trigger_event text NOT NULL DEFAULT 'first_deposit' CHECK (trigger_event IN ('signup','first_deposit')),
  min_deposit numeric(18,2) NOT NULL DEFAULT 0,
  attribution_hours int NOT NULL DEFAULT 24 CHECK (attribution_hours > 0),
  validation_days int NOT NULL DEFAULT 7 CHECK (validation_days >= 0),
  min_payout numeric(18,2) NOT NULL DEFAULT 0,
  reversal_rules text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.affiliate_config (id) VALUES (1);
GRANT SELECT ON public.affiliate_config TO anon, authenticated;
GRANT ALL ON public.affiliate_config TO service_role;
ALTER TABLE public.affiliate_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads affiliate config" ON public.affiliate_config FOR SELECT USING (true);

CREATE TABLE public.affiliate_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referral_id uuid NOT NULL UNIQUE REFERENCES public.affiliate_referrals(id) ON DELETE CASCADE,
  event text NOT NULL,
  base_amount numeric(18,2) NOT NULL DEFAULT 0,
  amount numeric(18,2) NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','reversed')),
  available_at timestamptz NOT NULL,
  note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.affiliate_commissions TO authenticated;
GRANT ALL ON public.affiliate_commissions TO service_role;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin read commissions" ON public.affiliate_commissions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid()));

CREATE TABLE public.affiliate_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'wallet' CHECK (method IN ('wallet')),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','rejected','paid')),
  transaction_reference text,
  note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.affiliate_payouts TO authenticated;
GRANT ALL ON public.affiliate_payouts TO service_role;
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin read payouts" ON public.affiliate_payouts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid()));

CREATE TABLE public.affiliate_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image_url text NOT NULL,
  size text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.affiliate_banners TO anon, authenticated;
GRANT ALL ON public.affiliate_banners TO service_role;
ALTER TABLE public.affiliate_banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read active banners" ON public.affiliate_banners FOR SELECT USING (active OR public.has_role(auth.uid(),'admin'));

-- Cria comissão pendente a partir da configuração atual (uma por referido).
CREATE OR REPLACE FUNCTION public.affiliate_create_commission(_referral_id uuid, _event text, _base numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.affiliate_config; r public.affiliate_referrals; _amt numeric;
BEGIN
  SELECT * INTO c FROM affiliate_config WHERE id = 1;
  IF NOT c.enabled OR c.trigger_event <> _event THEN RETURN; END IF;
  IF _event = 'first_deposit' AND _base < c.min_deposit THEN RETURN; END IF;
  SELECT * INTO r FROM affiliate_referrals WHERE id = _referral_id;
  IF NOT FOUND THEN RETURN; END IF;
  _amt := CASE WHEN c.commission_type = 'fixed' THEN c.commission_value ELSE round(_base * c.commission_value / 100, 2) END;
  IF _amt <= 0 THEN RETURN; END IF;
  INSERT INTO affiliate_commissions(affiliate_id, referral_id, event, base_amount, amount, available_at)
  VALUES (r.affiliate_id, r.id, _event, _base, _amt, now() + make_interval(days => c.validation_days))
  ON CONFLICT (referral_id) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.affiliate_create_commission(uuid, text, numeric) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.affiliate_on_deposit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid; _ref uuid;
BEGIN
  IF NEW.type <> 'deposit' OR NEW.amount <= 0 OR NEW.status <> 'completed' THEN RETURN NEW; END IF;
  SELECT user_id INTO _uid FROM wallets WHERE id = NEW.wallet_id;
  SELECT id INTO _ref FROM affiliate_referrals WHERE referred_user_id = _uid;
  IF _ref IS NULL THEN RETURN NEW; END IF;
  -- apenas o primeiro depósito do referido
  IF EXISTS (SELECT 1 FROM wallet_transactions t JOIN wallets w ON w.id = t.wallet_id
             WHERE w.user_id = _uid AND t.type = 'deposit' AND t.status = 'completed' AND t.id <> NEW.id) THEN RETURN NEW; END IF;
  PERFORM affiliate_create_commission(_ref, 'first_deposit', NEW.amount);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.affiliate_on_deposit() FROM public, anon, authenticated;
CREATE TRIGGER affiliate_first_deposit AFTER INSERT ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.affiliate_on_deposit();

-- Atribuição agora usa o prazo configurado e gera comissão de cadastro, se for o evento.
CREATE OR REPLACE FUNCTION public.affiliate_claim(_code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _aff public.affiliates; _created timestamptz; _hours int; _rid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'unauthenticated'; END IF;
  SELECT * INTO _aff FROM affiliates WHERE code = upper(_code) AND status = 'active';
  IF NOT FOUND THEN RETURN 'invalid_code'; END IF;
  IF _aff.user_id = auth.uid() THEN RETURN 'self_referral'; END IF;
  IF EXISTS (SELECT 1 FROM affiliate_referrals WHERE referred_user_id = auth.uid()) THEN RETURN 'already_referred'; END IF;
  SELECT attribution_hours INTO _hours FROM affiliate_config WHERE id = 1;
  SELECT created_at INTO _created FROM auth.users WHERE id = auth.uid();
  IF _created < now() - make_interval(hours => coalesce(_hours, 24)) THEN RETURN 'account_too_old'; END IF;
  INSERT INTO affiliate_referrals(affiliate_id, referred_user_id) VALUES (_aff.id, auth.uid()) RETURNING id INTO _rid;
  PERFORM affiliate_create_commission(_rid, 'signup', 0);
  RETURN 'ok';
END $$;

CREATE OR REPLACE FUNCTION public.affiliate_available(_affiliate_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT sum(amount) FROM affiliate_commissions WHERE affiliate_id = _affiliate_id AND status = 'approved'),0)
       - coalesce((SELECT sum(amount) FROM affiliate_payouts WHERE affiliate_id = _affiliate_id AND status <> 'rejected'),0)
$$;
GRANT EXECUTE ON FUNCTION public.affiliate_available(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.affiliate_request_payout(_amount numeric)
RETURNS public.affiliate_payouts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _aff public.affiliates; _min numeric; _row public.affiliate_payouts;
BEGIN
  SELECT * INTO _aff FROM affiliates WHERE user_id = auth.uid() AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'não é afiliado ativo'; END IF;
  SELECT min_payout INTO _min FROM affiliate_config WHERE id = 1;
  IF _amount <= 0 OR _amount < _min THEN RAISE EXCEPTION 'valor abaixo do mínimo'; END IF;
  IF _amount > affiliate_available(_aff.id) THEN RAISE EXCEPTION 'saldo de comissões insuficiente'; END IF;
  INSERT INTO affiliate_payouts(affiliate_id, amount) VALUES (_aff.id, _amount) RETURNING * INTO _row;
  RETURN _row;
END $$;
REVOKE ALL ON FUNCTION public.affiliate_request_payout(numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.affiliate_request_payout(numeric) TO authenticated;

-- ADMIN
CREATE OR REPLACE FUNCTION public.affiliate_admin_config(_cfg jsonb)
RETURNS public.affiliate_config LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    reversal_rules = coalesce(_cfg->>'reversal_rules', reversal_rules),
    updated_at = now()
  WHERE id = 1 RETURNING * INTO _row;
  PERFORM exchange_audit(auth.uid(), 'affiliate_config', 'affiliate_config', NULL, _cfg);
  RETURN _row;
END $$;

CREATE OR REPLACE FUNCTION public.affiliate_admin_commission(_id uuid, _status text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.affiliate_commissions;
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'proibido'; END IF;
  IF _status NOT IN ('approved','rejected','reversed') THEN RAISE EXCEPTION 'estado inválido'; END IF;
  SELECT * INTO _c FROM affiliate_commissions WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'comissão inexistente'; END IF;
  IF _status = 'approved' AND (_c.status <> 'pending' OR _c.available_at > now()) THEN RAISE EXCEPTION 'ainda em período de validação ou já decidida'; END IF;
  IF _status = 'rejected' AND _c.status <> 'pending' THEN RAISE EXCEPTION 'só pendentes podem ser rejeitadas'; END IF;
  IF _status = 'reversed' AND _c.status <> 'approved' THEN RAISE EXCEPTION 'só aprovadas podem ser estornadas'; END IF;
  UPDATE affiliate_commissions SET status = _status, note = _note, decided_by = auth.uid(), decided_at = now() WHERE id = _id;
  PERFORM exchange_audit(auth.uid(), 'affiliate_commission_'||_status, 'affiliate_commissions', _id, jsonb_build_object('note',_note));
END $$;

CREATE OR REPLACE FUNCTION public.affiliate_admin_payout(_id uuid, _action text, _note text)
RETURNS public.affiliate_payouts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.affiliate_payouts; _uid uuid; _tx public.wallet_transactions;
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'proibido'; END IF;
  SELECT * INTO _p FROM affiliate_payouts WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pedido inexistente'; END IF;
  IF _action = 'approve' AND _p.status = 'requested' THEN
    UPDATE affiliate_payouts SET status='approved', note=_note, decided_by=auth.uid(), decided_at=now() WHERE id=_id RETURNING * INTO _p;
  ELSIF _action = 'reject' AND _p.status IN ('requested','approved') THEN
    UPDATE affiliate_payouts SET status='rejected', note=_note, decided_by=auth.uid(), decided_at=now() WHERE id=_id RETURNING * INTO _p;
  ELSIF _action = 'pay' AND _p.status = 'approved' THEN
    SELECT user_id INTO _uid FROM affiliates WHERE id = _p.affiliate_id;
    _tx := wallet_apply(ensure_wallet(_uid,'betting'), 'adjustment', _p.amount, 'aff_payout_'||_p.id::text, 'affiliate', NULL,
                        jsonb_build_object('affiliate_payout_id', _p.id));
    UPDATE affiliate_payouts SET status='paid', transaction_reference=_tx.reference, note=coalesce(_note,note), decided_by=auth.uid(), decided_at=now()
    WHERE id=_id RETURNING * INTO _p;
  ELSE
    RAISE EXCEPTION 'ação inválida para o estado atual';
  END IF;
  PERFORM exchange_audit(auth.uid(), 'affiliate_payout_'||_action, 'affiliate_payouts', _id, jsonb_build_object('note',_note));
  RETURN _p;
END $$;

CREATE OR REPLACE FUNCTION public.affiliate_admin_banner(_title text, _image_url text, _size text, _id uuid, _active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'proibido'; END IF;
  IF _id IS NULL THEN
    INSERT INTO affiliate_banners(title, image_url, size) VALUES (_title, _image_url, _size);
  ELSE
    UPDATE affiliate_banners SET active = _active WHERE id = _id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.affiliate_admin_status(_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'proibido'; END IF;
  UPDATE affiliates SET status = _status WHERE id = _id;
END $$;

REVOKE ALL ON FUNCTION public.affiliate_admin_config(jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.affiliate_admin_commission(uuid,text,text) FROM public, anon;
REVOKE ALL ON FUNCTION public.affiliate_admin_payout(uuid,text,text) FROM public, anon;
REVOKE ALL ON FUNCTION public.affiliate_admin_banner(text,text,text,uuid,boolean) FROM public, anon;
REVOKE ALL ON FUNCTION public.affiliate_admin_status(uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.affiliate_admin_config(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_admin_commission(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_admin_payout(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_admin_banner(text,text,text,uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_admin_status(uuid,text) TO authenticated;