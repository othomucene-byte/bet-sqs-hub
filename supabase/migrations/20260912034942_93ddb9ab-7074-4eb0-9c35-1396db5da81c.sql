CREATE TABLE public.exchange_reference_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.exchange_assets(id) ON DELETE CASCADE,
  price numeric(20,6) NOT NULL CHECK (price > 0),
  source text,
  reason text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  effective_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.exchange_reference_price_history TO anon, authenticated;
GRANT ALL ON public.exchange_reference_price_history TO service_role;

ALTER TABLE public.exchange_reference_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reference price history is public"
ON public.exchange_reference_price_history
FOR SELECT
TO anon, authenticated
USING (true);

CREATE INDEX exchange_reference_price_history_asset_time_idx
ON public.exchange_reference_price_history(asset_id, effective_at DESC);

CREATE OR REPLACE FUNCTION public.record_exchange_reference_price_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reference_price IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.reference_price IS DISTINCT FROM NEW.reference_price OR OLD.reference_price_source IS DISTINCT FROM NEW.reference_price_source) THEN
    INSERT INTO public.exchange_reference_price_history(asset_id, price, source, reason, changed_by, effective_at)
    VALUES (
      NEW.id,
      NEW.reference_price,
      NEW.reference_price_source,
      CASE WHEN TG_OP = 'INSERT' THEN 'Preço de referência inicial' ELSE 'Revisão administrativa do preço de referência' END,
      auth.uid(),
      now()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER exchange_assets_reference_price_history
AFTER INSERT OR UPDATE OF reference_price, reference_price_source
ON public.exchange_assets
FOR EACH ROW
EXECUTE FUNCTION public.record_exchange_reference_price_history();

INSERT INTO public.exchange_reference_price_history(asset_id, price, source, reason, effective_at)
SELECT a.id, a.reference_price, a.reference_price_source, 'Preço de referência inicial', COALESCE(a.updated_at, a.created_at, now())
FROM public.exchange_assets a
WHERE a.reference_price IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.exchange_reference_price_history h WHERE h.asset_id = a.id
  );