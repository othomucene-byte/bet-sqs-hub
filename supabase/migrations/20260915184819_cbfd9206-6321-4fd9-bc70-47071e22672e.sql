CREATE TABLE public.ai_agent_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  interval_minutes integer NOT NULL DEFAULT 60,
  allowed_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  batch_size integer NOT NULL DEFAULT 5,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_agent_config TO anon, authenticated;
GRANT ALL ON public.ai_agent_config TO service_role;
ALTER TABLE public.ai_agent_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_agent_config_public_read" ON public.ai_agent_config
  FOR SELECT TO anon, authenticated USING (true);

CREATE TRIGGER ai_agent_config_updated_at
  BEFORE UPDATE ON public.ai_agent_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ai_run_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  job_key text NOT NULL DEFAULT 'company_data_refresh',
  asset_id uuid REFERENCES public.exchange_assets(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  trigger text NOT NULL DEFAULT 'cron',
  status text NOT NULL DEFAULT 'ok',
  inserted_count integer NOT NULL DEFAULT 0,
  approved_count integer NOT NULL DEFAULT 0,
  pending_count integer NOT NULL DEFAULT 0,
  conflict_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  provider text,
  model text,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_run_log TO anon, authenticated;
GRANT ALL ON public.ai_run_log TO service_role;
ALTER TABLE public.ai_run_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_run_log_public_read" ON public.ai_run_log
  FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX ai_run_log_asset_idx ON public.ai_run_log (asset_id, finished_at DESC);

ALTER TABLE public.exchange_assets
  ADD COLUMN IF NOT EXISTS ai_monitored boolean NOT NULL DEFAULT true;

ALTER TABLE public.company_data_points
  ADD COLUMN IF NOT EXISTS sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS change_summary text,
  ADD COLUMN IF NOT EXISTS conflict_note text;

INSERT INTO public.ai_agent_config (config_key, enabled, interval_minutes, allowed_sources, batch_size)
VALUES (
  'company_data_refresh',
  true,
  60,
  '["bolsadevalores.co.mz","bvm.co.mz","mz.gov.mz","jornalnoticias.co.mz","opais.co.mz","carta.co.mz","clubofmozambique.com","verangola.net","reuters.com","bloomberg.com"]'::jsonb,
  5
)
ON CONFLICT (config_key) DO NOTHING;