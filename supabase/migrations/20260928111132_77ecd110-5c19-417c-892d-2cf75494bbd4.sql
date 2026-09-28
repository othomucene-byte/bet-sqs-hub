CREATE TABLE public.affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.affiliates TO authenticated;
GRANT ALL ON public.affiliates TO service_role;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin read affiliate" ON public.affiliates FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.affiliate_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.affiliate_clicks (affiliate_id, created_at);
GRANT SELECT ON public.affiliate_clicks TO authenticated;
GRANT ALL ON public.affiliate_clicks TO service_role;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin read clicks" ON public.affiliate_clicks FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid()));

CREATE TABLE public.affiliate_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.affiliate_referrals TO authenticated;
GRANT ALL ON public.affiliate_referrals TO service_role;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin read referrals" ON public.affiliate_referrals FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.affiliate_join()
RETURNS public.affiliates LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.affiliates; _code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  SELECT * INTO _row FROM affiliates WHERE user_id = auth.uid();
  IF FOUND THEN RETURN _row; END IF;
  LOOP
    _code := upper(substr(encode(gen_random_bytes(6),'hex'),1,8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM affiliates WHERE code = _code);
  END LOOP;
  INSERT INTO affiliates(user_id, code) VALUES (auth.uid(), _code) RETURNING * INTO _row;
  RETURN _row;
END $$;
REVOKE ALL ON FUNCTION public.affiliate_join() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.affiliate_join() TO authenticated;

CREATE OR REPLACE FUNCTION public.affiliate_track_click(_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  SELECT id INTO _id FROM affiliates WHERE code = upper(_code) AND status = 'active';
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO affiliate_clicks(affiliate_id) VALUES (_id);
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.affiliate_track_click(text) TO anon, authenticated;

-- Atribui apenas contas novas (criadas há menos de 24h), sem autoindicação nem duplicação.
CREATE OR REPLACE FUNCTION public.affiliate_claim(_code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _aff public.affiliates; _created timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'unauthenticated'; END IF;
  SELECT * INTO _aff FROM affiliates WHERE code = upper(_code) AND status = 'active';
  IF NOT FOUND THEN RETURN 'invalid_code'; END IF;
  IF _aff.user_id = auth.uid() THEN RETURN 'self_referral'; END IF;
  IF EXISTS (SELECT 1 FROM affiliate_referrals WHERE referred_user_id = auth.uid()) THEN RETURN 'already_referred'; END IF;
  SELECT created_at INTO _created FROM auth.users WHERE id = auth.uid();
  IF _created < now() - interval '24 hours' THEN RETURN 'account_too_old'; END IF;
  INSERT INTO affiliate_referrals(affiliate_id, referred_user_id) VALUES (_aff.id, auth.uid());
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION public.affiliate_claim(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.affiliate_claim(text) TO authenticated;