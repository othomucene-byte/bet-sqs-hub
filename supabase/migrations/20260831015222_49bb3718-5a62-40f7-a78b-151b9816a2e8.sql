REVOKE ALL ON FUNCTION public.place_investment(uuid, uuid, numeric) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.cancel_investment(uuid, uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.ensure_wallet(uuid, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.place_investment(uuid, uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_investment(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_wallet(uuid, text) TO service_role;