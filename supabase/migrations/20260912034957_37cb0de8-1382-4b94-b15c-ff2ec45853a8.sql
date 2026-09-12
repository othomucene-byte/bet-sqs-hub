REVOKE ALL ON FUNCTION public.record_exchange_reference_price_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_exchange_reference_price_history() FROM anon;
REVOKE ALL ON FUNCTION public.record_exchange_reference_price_history() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_exchange_reference_price_history() TO service_role;