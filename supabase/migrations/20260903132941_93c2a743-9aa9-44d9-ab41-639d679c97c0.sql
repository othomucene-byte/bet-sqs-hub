REVOKE EXECUTE ON FUNCTION public.place_bet(uuid, uuid, numeric, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.place_bet(uuid, uuid, numeric, numeric, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_bet(uuid, uuid, numeric, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.place_bet(uuid, uuid, numeric, numeric, integer) TO service_role;