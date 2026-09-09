-- 1) Mercado real
INSERT INTO public.exchange_markets (code, name, environment, status, timezone, opens_at, closes_at)
VALUES ('SQSX-LIVE', 'SQs Exchange — Mercado de Moçambique', 'LIVE', 'CLOSED', 'Africa/Maputo', '09:00', '15:00')
ON CONFLICT (code) DO NOTHING;

-- 2) Transferências reais exigem KYC aprovado
CREATE OR REPLACE FUNCTION public.exchange_transfer_wallet(_user_id uuid, _direction text, _amount numeric, _idempotency_key text)
 RETURNS exchange_transfers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare _row public.exchange_transfers; _acc uuid; _wallet uuid; _ref text; _cash numeric;
begin
    select * into _row from public.exchange_transfers where idempotency_key = _idempotency_key;
    if found then return _row; end if;
    if _direction not in ('IN','OUT') then raise exception 'direcao invalida'; end if;
    if _amount is null or _amount <= 0 then raise exception 'montante invalido'; end if;

    if not exists (select 1 from public.kyc_profiles where user_id = _user_id and status = 'approved') then
        raise exception 'verificacao de identidade (KYC) nao aprovada';
    end if;

    _acc := public.exchange_ensure_account(_user_id, 'LIVE');
    _wallet := public.ensure_wallet(_user_id, 'investment');
    _ref := 'xtransfer:' || gen_random_uuid()::text;

    insert into public.exchange_transfers (user_id, account_id, direction, source, amount, reference, idempotency_key)
    values (_user_id, _acc, _direction, 'INVESTMENT_WALLET', _amount, _ref, _idempotency_key)
    returning * into _row;

    if _direction = 'IN' then
        perform public.wallet_apply(_wallet, 'transfer_out', -_amount, _ref || ':w', null, null,
            jsonb_build_object('to', 'exchange'));
        perform public.exchange_ledger_post(_ref, 'EXCHANGE_DEPOSIT', _row.id,
            jsonb_build_array(
                jsonb_build_object('account', public.exchange_ledger_account(_acc, 'CASH'), 'debit', _amount),
                jsonb_build_object('account', public.exchange_platform_account('EXTERNAL'), 'credit', _amount)));
    else
        select available into _cash from public.exchange_cash(_acc);
        if _cash < _amount then raise exception 'saldo disponivel insuficiente na conta de mercado'; end if;
        perform public.exchange_ledger_post(_ref, 'EXCHANGE_WITHDRAWAL', _row.id,
            jsonb_build_array(
                jsonb_build_object('account', public.exchange_platform_account('EXTERNAL'), 'debit', _amount),
                jsonb_build_object('account', public.exchange_ledger_account(_acc, 'CASH'), 'credit', _amount)));
        perform public.wallet_apply(_wallet, 'transfer_in', _amount, _ref || ':w', null, null,
            jsonb_build_object('from', 'exchange'));
    end if;

    perform public.exchange_audit(_user_id,
        case when _direction = 'IN' then 'exchange_deposit' else 'exchange_withdrawal' end,
        'exchange_transfers', _row.id, jsonb_build_object('amount', _amount));
    return _row;
end;
$$;

REVOKE ALL ON FUNCTION public.exchange_transfer_wallet(uuid, text, numeric, text) FROM anon, authenticated;

-- 3) Candidaturas de listagem
CREATE TABLE IF NOT EXISTS public.exchange_listing_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id),
  company_name text NOT NULL,
  proposed_symbol text NOT NULL,
  asset_type text NOT NULL DEFAULT 'EQUITY'
    CHECK (asset_type IN ('EQUITY','BOND','TREASURY_BOND','COMMERCIAL_PAPER','FUND','OTHER')),
  sector text,
  description text,
  website text,
  contact_email text,
  contact_phone text,
  shares_offered numeric(18,2),
  reference_price numeric(18,4),
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','under_review','approved','rejected')),
  decision_note text,
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  asset_id uuid REFERENCES public.exchange_assets(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.exchange_listing_applications TO authenticated;
GRANT ALL ON public.exchange_listing_applications TO service_role;
ALTER TABLE public.exchange_listing_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listing own read" ON public.exchange_listing_applications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "listing own insert" ON public.exchange_listing_applications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER exchange_listing_applications_updated
  BEFORE UPDATE ON public.exchange_listing_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS exchange_listing_status_idx
  ON public.exchange_listing_applications (status, created_at DESC);

-- 4) Dados das empresas atualizados pela inteligência
CREATE TABLE IF NOT EXISTS public.company_data_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.exchange_assets(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id),
  kind text NOT NULL CHECK (kind IN ('FINANCIALS','NEWS','DIVIDEND','CORPORATE_EVENT','PROFILE','OTHER')),
  title text NOT NULL,
  summary text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  event_date date,
  source_name text NOT NULL,
  source_url text,
  confidence numeric(4,3) NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','superseded')),
  validation_note text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  supersedes_id uuid REFERENCES public.company_data_points(id),
  provider text NOT NULL DEFAULT 'mistral',
  model text,
  run_id uuid,
  content_hash text NOT NULL,
  collected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, kind, content_hash)
);

GRANT SELECT ON public.company_data_points TO anon, authenticated;
GRANT ALL ON public.company_data_points TO service_role;
ALTER TABLE public.company_data_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company data public read approved" ON public.company_data_points
  FOR SELECT USING (status = 'approved');
CREATE POLICY "company data admin read" ON public.company_data_points
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER company_data_points_updated
  BEFORE UPDATE ON public.company_data_points
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS company_data_points_asset_idx
  ON public.company_data_points (asset_id, kind, status, collected_at DESC);

-- 5) Trabalhos automáticos (lock, pausa, progresso)
CREATE TABLE IF NOT EXISTS public.ai_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','running','paused','failed')),
  lease_until timestamptz,
  cursor_asset_id uuid,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  failure_count integer NOT NULL DEFAULT 0,
  paused_reason text,
  processed_today integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_jobs TO authenticated;
GRANT ALL ON public.ai_jobs TO service_role;
ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai jobs admin read" ON public.ai_jobs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER ai_jobs_updated
  BEFORE UPDATE ON public.ai_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.ai_jobs (job_key) VALUES ('company_data_refresh')
ON CONFLICT (job_key) DO NOTHING;

-- 6) Lock de execução única
CREATE OR REPLACE FUNCTION public.ai_job_acquire(_job_key text, _lease_seconds integer DEFAULT 600)
 RETURNS public.ai_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare _job public.ai_jobs;
begin
    select * into _job from public.ai_jobs where job_key = _job_key for update;
    if not found then
        insert into public.ai_jobs (job_key) values (_job_key) returning * into _job;
    end if;
    if _job.status = 'paused' then return null; end if;
    if _job.status = 'running' and _job.lease_until is not null and _job.lease_until > now() then
        return null;
    end if;
    update public.ai_jobs
       set status = 'running',
           lease_until = now() + make_interval(secs => _lease_seconds),
           last_run_at = now()
     where id = _job.id returning * into _job;
    return _job;
end;
$$;

CREATE OR REPLACE FUNCTION public.ai_job_release(_job_key text, _ok boolean, _error text DEFAULT NULL, _pause boolean DEFAULT false, _processed integer DEFAULT 0)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
begin
    update public.ai_jobs
       set status = case when _pause then 'paused' when _ok then 'idle' else 'failed' end,
           lease_until = null,
           last_success_at = case when _ok then now() else last_success_at end,
           last_error = _error,
           failure_count = case when _ok then 0 else failure_count + 1 end,
           paused_reason = case when _pause then _error else null end,
           processed_today = processed_today + coalesce(_processed, 0)
     where job_key = _job_key;
end;
$$;

REVOKE ALL ON FUNCTION public.ai_job_acquire(text, integer) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_job_release(text, boolean, text, boolean, integer) FROM anon, authenticated;