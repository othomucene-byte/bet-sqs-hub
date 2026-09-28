CREATE OR REPLACE FUNCTION public.affiliate_join()
RETURNS public.affiliates LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.affiliates; _code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  SELECT * INTO _row FROM affiliates WHERE user_id = auth.uid();
  IF FOUND THEN RETURN _row; END IF;
  LOOP
    _code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM affiliates WHERE code = _code);
  END LOOP;
  INSERT INTO affiliates(user_id, code) VALUES (auth.uid(), _code) RETURNING * INTO _row;
  RETURN _row;
END $$;
REVOKE ALL ON FUNCTION public.affiliate_join() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.affiliate_join() TO authenticated;