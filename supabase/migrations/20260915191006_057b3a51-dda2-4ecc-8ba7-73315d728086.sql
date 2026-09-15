CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  prefix text NOT NULL UNIQUE,
  key_hash text NOT NULL UNIQUE,
  environment text NOT NULL DEFAULT 'SANDBOX' CHECK (environment IN ('SANDBOX','LIVE')),
  scopes text[] NOT NULL DEFAULT ARRAY['market:read']::text[],
  last_used_at timestamptz,
  request_count bigint NOT NULL DEFAULT 0,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX api_keys_user_idx ON public.api_keys(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys_owner_read" ON public.api_keys
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "api_keys_owner_revoke" ON public.api_keys
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "api_keys_admin_read" ON public.api_keys
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.api_request_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  path text NOT NULL,
  status integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX api_request_log_key_idx ON public.api_request_log(api_key_id, created_at DESC);

GRANT SELECT ON public.api_request_log TO authenticated;
GRANT ALL ON public.api_request_log TO service_role;

ALTER TABLE public.api_request_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_request_log_owner_read" ON public.api_request_log
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.api_keys k WHERE k.id = api_request_log.api_key_id AND k.user_id = auth.uid())
  );