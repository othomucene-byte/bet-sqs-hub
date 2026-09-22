-- 1. sport_events: campos de direto
ALTER TABLE public.sport_events
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'api-football',
  ADD COLUMN IF NOT EXISTS provider_status text,
  ADD COLUMN IF NOT EXISTS elapsed_minutes integer,
  ADD COLUMN IF NOT EXISTS extra_minutes integer,
  ADD COLUMN IF NOT EXISTS period text,
  ADD COLUMN IF NOT EXISTS live_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS venue text,
  ADD COLUMN IF NOT EXISTS round text,
  ADD COLUMN IF NOT EXISTS home_team_external_id text,
  ADD COLUMN IF NOT EXISTS away_team_external_id text;

ALTER TABLE public.sport_events DROP CONSTRAINT IF EXISTS sport_events_status_check;
ALTER TABLE public.sport_events ADD CONSTRAINT sport_events_status_check CHECK (
  status = ANY (ARRAY['scheduled','live','halftime','finished','closed','settled','void','postponed','cancelled','suspended'])
);

CREATE INDEX IF NOT EXISTS sport_events_status_idx ON public.sport_events (status, commence_at DESC);
CREATE INDEX IF NOT EXISTS sport_events_live_updated_idx ON public.sport_events (live_updated_at DESC);

-- 2. equipas
CREATE TABLE IF NOT EXISTS public.sport_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'api-football',
  external_id text NOT NULL,
  name text NOT NULL,
  logo text,
  country text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_id)
);
GRANT SELECT ON public.sport_teams TO anon, authenticated;
GRANT ALL ON public.sport_teams TO service_role;
ALTER TABLE public.sport_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sport_teams_public_read" ON public.sport_teams FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER sport_teams_set_updated_at BEFORE UPDATE ON public.sport_teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. acontecimentos do jogo
CREATE TABLE IF NOT EXISTS public.sport_match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.sport_events(id) ON DELETE CASCADE,
  external_key text NOT NULL,
  minute integer,
  extra_minute integer,
  kind text NOT NULL,
  detail text,
  team_side text CHECK (team_side IN ('home','away')),
  player text,
  assist text,
  comments text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, external_key)
);
GRANT SELECT ON public.sport_match_events TO anon, authenticated;
GRANT ALL ON public.sport_match_events TO service_role;
ALTER TABLE public.sport_match_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sport_match_events_public_read" ON public.sport_match_events FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS sport_match_events_event_idx ON public.sport_match_events (event_id, minute);

-- 4. estatísticas
CREATE TABLE IF NOT EXISTS public.sport_match_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.sport_events(id) ON DELETE CASCADE,
  team_side text NOT NULL CHECK (team_side IN ('home','away')),
  metric text NOT NULL,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, team_side, metric)
);
GRANT SELECT ON public.sport_match_stats TO anon, authenticated;
GRANT ALL ON public.sport_match_stats TO service_role;
ALTER TABLE public.sport_match_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sport_match_stats_public_read" ON public.sport_match_stats FOR SELECT TO anon, authenticated USING (true);

-- 5. alterações em direto (fila para SSE)
CREATE TABLE IF NOT EXISTS public.sport_live_updates (
  id bigserial PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.sport_events(id) ON DELETE CASCADE,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sport_live_updates TO anon, authenticated;
GRANT ALL ON public.sport_live_updates TO service_role;
GRANT SELECT, USAGE ON SEQUENCE public.sport_live_updates_id_seq TO service_role;
ALTER TABLE public.sport_live_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sport_live_updates_public_read" ON public.sport_live_updates FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS sport_live_updates_cursor_idx ON public.sport_live_updates (id DESC);

-- 6. configuração do fornecedor
CREATE TABLE IF NOT EXISTS public.sports_provider_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'api-football',
  active boolean NOT NULL DEFAULT true,
  live_interval_seconds integer NOT NULL DEFAULT 60,
  catalog_interval_seconds integer NOT NULL DEFAULT 3600,
  daily_request_budget integer NOT NULL DEFAULT 100,
  live_budget_share numeric NOT NULL DEFAULT 0.7,
  enabled_sports jsonb NOT NULL DEFAULT '["futebol"]'::jsonb,
  requests_day date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  requests_today integer NOT NULL DEFAULT 0,
  last_live_sync_at timestamptz,
  last_catalog_sync_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sports_provider_config TO authenticated;
GRANT ALL ON public.sports_provider_config TO service_role;
ALTER TABLE public.sports_provider_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sports_provider_config_admin_read" ON public.sports_provider_config
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER sports_provider_config_set_updated_at BEFORE UPDATE ON public.sports_provider_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.sports_provider_config (provider) VALUES ('api-football')
  ON CONFLICT DO NOTHING;

-- 7. registo de sincronizações
CREATE TABLE IF NOT EXISTS public.sports_sync_log (
  id bigserial PRIMARY KEY,
  kind text NOT NULL,
  ok boolean NOT NULL DEFAULT true,
  requests_used integer NOT NULL DEFAULT 0,
  matches_touched integer NOT NULL DEFAULT 0,
  events_inserted integer NOT NULL DEFAULT 0,
  duration_ms integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sports_sync_log TO authenticated;
GRANT ALL ON public.sports_sync_log TO service_role;
GRANT SELECT, USAGE ON SEQUENCE public.sports_sync_log_id_seq TO service_role;
ALTER TABLE public.sports_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sports_sync_log_admin_read" ON public.sports_sync_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS sports_sync_log_created_idx ON public.sports_sync_log (created_at DESC);

-- 8. contagem de pedidos com orçamento diário
CREATE OR REPLACE FUNCTION public.sports_consume_requests(_count integer)
RETURNS TABLE(allowed boolean, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.sports_provider_config;
  today date := (now() AT TIME ZONE 'utc')::date;
BEGIN
  SELECT * INTO cfg FROM public.sports_provider_config ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF cfg.id IS NULL THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  IF cfg.requests_day <> today THEN
    UPDATE public.sports_provider_config
      SET requests_day = today, requests_today = 0
      WHERE id = cfg.id;
    cfg.requests_today := 0;
  END IF;

  IF cfg.requests_today + _count > cfg.daily_request_budget THEN
    RETURN QUERY SELECT false, GREATEST(cfg.daily_request_budget - cfg.requests_today, 0);
    RETURN;
  END IF;

  UPDATE public.sports_provider_config
    SET requests_today = cfg.requests_today + _count
    WHERE id = cfg.id;

  RETURN QUERY SELECT true, GREATEST(cfg.daily_request_budget - cfg.requests_today - _count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.sports_consume_requests(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sports_consume_requests(integer) TO service_role;