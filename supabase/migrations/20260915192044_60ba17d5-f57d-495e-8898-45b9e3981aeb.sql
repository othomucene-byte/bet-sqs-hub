CREATE TABLE public.webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  description text,
  events text[] NOT NULL DEFAULT ARRAY['order.updated','trade.executed','price.updated']::text[],
  environment text NOT NULL DEFAULT 'SANDBOX' CHECK (environment IN ('SANDBOX','LIVE')),
  secret text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  failure_count integer NOT NULL DEFAULT 0,
  last_delivery_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX webhook_endpoints_user_idx ON public.webhook_endpoints(user_id);

GRANT SELECT (id, user_id, url, description, events, environment, active, failure_count, last_delivery_at, created_at) ON public.webhook_endpoints TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.webhook_endpoints TO authenticated;
GRANT ALL ON public.webhook_endpoints TO service_role;

ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_endpoints_owner_read" ON public.webhook_endpoints
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "webhook_endpoints_owner_write" ON public.webhook_endpoints
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "webhook_endpoints_owner_delete" ON public.webhook_endpoints
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed')),
  attempts integer NOT NULL DEFAULT 0,
  response_status integer,
  error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX webhook_deliveries_pending_idx ON public.webhook_deliveries(status, next_attempt_at);
CREATE INDEX webhook_deliveries_endpoint_idx ON public.webhook_deliveries(endpoint_id, created_at DESC);

GRANT SELECT ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_deliveries_owner_read" ON public.webhook_deliveries
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.webhook_endpoints e WHERE e.id = webhook_deliveries.endpoint_id AND e.user_id = auth.uid())
  );

CREATE TABLE public.oauth_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id text NOT NULL UNIQUE,
  client_secret_hash text NOT NULL,
  name text NOT NULL,
  redirect_uris text[] NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['market:read']::text[],
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX oauth_clients_owner_idx ON public.oauth_clients(owner_user_id);

GRANT SELECT (id, owner_user_id, client_id, name, redirect_uris, scopes, revoked_at, created_at) ON public.oauth_clients TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.oauth_clients TO authenticated;
GRANT ALL ON public.oauth_clients TO service_role;

ALTER TABLE public.oauth_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oauth_clients_owner_read" ON public.oauth_clients
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY "oauth_clients_owner_update" ON public.oauth_clients
  FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "oauth_clients_owner_delete" ON public.oauth_clients
  FOR DELETE TO authenticated USING (owner_user_id = auth.uid());

CREATE TABLE public.oauth_authorization_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL REFERENCES public.oauth_clients(client_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL UNIQUE,
  redirect_uri text NOT NULL,
  scopes text[] NOT NULL,
  code_challenge text,
  code_challenge_method text CHECK (code_challenge_method IN ('S256','plain')),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.oauth_authorization_codes TO service_role;
ALTER TABLE public.oauth_authorization_codes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL REFERENCES public.oauth_clients(client_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token_hash text NOT NULL UNIQUE,
  refresh_token_hash text UNIQUE,
  scopes text[] NOT NULL,
  environment text NOT NULL DEFAULT 'SANDBOX' CHECK (environment IN ('SANDBOX','LIVE')),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX oauth_tokens_user_idx ON public.oauth_tokens(user_id, created_at DESC);

GRANT SELECT (id, client_id, user_id, scopes, environment, expires_at, revoked_at, last_used_at, created_at) ON public.oauth_tokens TO authenticated;
GRANT UPDATE ON public.oauth_tokens TO authenticated;
GRANT ALL ON public.oauth_tokens TO service_role;

ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oauth_tokens_owner_read" ON public.oauth_tokens
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "oauth_tokens_owner_revoke" ON public.oauth_tokens
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());