CREATE TABLE public.exchange_public_trades (
  trade_id uuid PRIMARY KEY REFERENCES public.trades(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.exchange_assets(id) ON DELETE CASCADE,
  price numeric(20,6) NOT NULL,
  quantity numeric(20,6) NOT NULL,
  executed_at timestamptz NOT NULL
);

GRANT SELECT ON public.exchange_public_trades TO anon, authenticated;
GRANT ALL ON public.exchange_public_trades TO service_role;

ALTER TABLE public.exchange_public_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public market tape is readable"
ON public.exchange_public_trades
FOR SELECT
TO anon, authenticated
USING (true);

CREATE INDEX exchange_public_trades_asset_time_idx
ON public.exchange_public_trades(asset_id, executed_at DESC);

CREATE OR REPLACE FUNCTION public.sync_exchange_public_trade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.exchange_public_trades(trade_id, asset_id, price, quantity, executed_at)
  VALUES (NEW.id, NEW.asset_id, NEW.price, NEW.quantity, NEW.executed_at)
  ON CONFLICT (trade_id) DO UPDATE SET
    asset_id = EXCLUDED.asset_id,
    price = EXCLUDED.price,
    quantity = EXCLUDED.quantity,
    executed_at = EXCLUDED.executed_at;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_exchange_public_trade() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_exchange_public_trade() FROM anon;
REVOKE ALL ON FUNCTION public.sync_exchange_public_trade() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_exchange_public_trade() TO service_role;

CREATE TRIGGER trades_sync_public_tape
AFTER INSERT OR UPDATE OF asset_id, price, quantity, executed_at
ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.sync_exchange_public_trade();

INSERT INTO public.exchange_public_trades(trade_id, asset_id, price, quantity, executed_at)
SELECT id, asset_id, price, quantity, executed_at FROM public.trades
ON CONFLICT (trade_id) DO NOTHING;

DROP POLICY "trades public read" ON public.trades;

CREATE POLICY "Participants read their trades"
ON public.trades
FOR SELECT
TO authenticated
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

REVOKE EXECUTE ON FUNCTION public.exchange_set_reference_price(uuid, uuid, numeric, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.exchange_set_reference_price(uuid, uuid, numeric, text) FROM PUBLIC;