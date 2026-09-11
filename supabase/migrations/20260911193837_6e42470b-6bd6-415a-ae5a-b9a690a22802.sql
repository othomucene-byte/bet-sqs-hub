ALTER TABLE public.exchange_assets
  ADD COLUMN IF NOT EXISTS reference_price numeric,
  ADD COLUMN IF NOT EXISTS reference_price_source text,
  ADD COLUMN IF NOT EXISTS reference_price_at timestamp with time zone;

CREATE OR REPLACE FUNCTION public.exchange_set_reference_price(
  _admin_id uuid,
  _asset_id uuid,
  _price numeric,
  _source text
) RETURNS public.exchange_assets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_asset public.exchange_assets;
BEGIN
  IF NOT public.has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _price IS NULL OR _price <= 0 THEN
    RAISE EXCEPTION 'invalid price';
  END IF;
  IF _source IS NULL OR length(btrim(_source)) < 3 THEN
    RAISE EXCEPTION 'source required';
  END IF;

  UPDATE public.exchange_assets
     SET reference_price = _price,
         reference_price_source = btrim(_source),
         reference_price_at = now(),
         updated_at = now()
   WHERE id = _asset_id
  RETURNING * INTO v_asset;

  IF v_asset.id IS NULL THEN
    RAISE EXCEPTION 'asset not found';
  END IF;

  PERFORM public.exchange_audit(_admin_id, 'exchange.reference_price', 'exchange_assets', _asset_id,
    jsonb_build_object('price', _price, 'source', btrim(_source)));

  RETURN v_asset;
END;
$fn$;

REVOKE ALL ON FUNCTION public.exchange_set_reference_price(uuid, uuid, numeric, text) FROM anon, authenticated;