ALTER TABLE public.game_rounds ALTER COLUMN house_edge SET DEFAULT 0.03;

CREATE OR REPLACE FUNCTION public.crash_result(
    _server_seed text,
    _client_seed text,
    _nonce bigint,
    _house_edge numeric default 0.03
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
declare
    _digest bytea;
    _slice bigint;
    _max bigint := 4294967296; -- 2^32
    _float numeric;
    _result numeric;
begin
    _digest := extensions.hmac(_client_seed || ':' || _nonce::text, _server_seed, 'sha256');
    _slice := ('x' || encode(substring(_digest from 1 for 4), 'hex'))::bit(32)::bigint;
    _float := _slice::numeric / _max::numeric;

    -- Uma fracção igual à margem da casa termina em crash instantâneo (1.00x)
    if _float < _house_edge then
        return 1.00;
    end if;

    _result := (1 - _house_edge) / (1 - _float);
    return greatest(1.00, round(least(_result, 10000), 4));
end;
$$;

REVOKE ALL ON FUNCTION public.crash_result(text, text, bigint, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.crash_result(text, text, bigint, numeric) TO authenticated, service_role;