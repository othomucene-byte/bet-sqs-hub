-- Símbolo único por ambiente (o mesmo símbolo pode existir em teste e em real).
ALTER TABLE public.exchange_assets DROP CONSTRAINT IF EXISTS exchange_assets_symbol_key;
CREATE UNIQUE INDEX IF NOT EXISTS exchange_assets_symbol_env_key
  ON public.exchange_assets (symbol, environment);

-- Mercado de simulação aberto e instrumentos de teste espelhando as empresas listadas.
UPDATE public.exchange_markets SET status = 'OPEN' WHERE code = 'SQSX-PAPER';

INSERT INTO public.exchange_assets (
  market_id, company_id, symbol, name, asset_type, country, currency, status,
  tick_size, lot_size, logo_url, description, issuer_info, is_demo, environment,
  reference_price, reference_price_source, reference_price_at, ai_monitored
)
SELECT
  (SELECT id FROM public.exchange_markets WHERE code = 'SQSX-PAPER'),
  a.company_id, a.symbol, a.name, a.asset_type, a.country, a.currency, a.status,
  a.tick_size, a.lot_size, a.logo_url, a.description, a.issuer_info, true, 'PAPER',
  a.reference_price, a.reference_price_source, a.reference_price_at, false
FROM public.exchange_assets a
WHERE a.environment = 'LIVE'
  AND NOT EXISTS (
    SELECT 1 FROM public.exchange_assets p
    WHERE p.environment = 'PAPER' AND p.symbol = a.symbol
  );