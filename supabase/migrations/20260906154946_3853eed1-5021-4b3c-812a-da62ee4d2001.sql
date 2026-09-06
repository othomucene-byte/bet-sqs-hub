CREATE POLICY rounds_no_direct_client_access
ON public.game_rounds
FOR SELECT
TO anon, authenticated
USING (false);