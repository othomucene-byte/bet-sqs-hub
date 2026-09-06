DROP POLICY IF EXISTS rounds_public_read ON public.game_rounds;
REVOKE ALL ON TABLE public.game_rounds FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.round_reveal(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.round_reveal(bigint) TO service_role;