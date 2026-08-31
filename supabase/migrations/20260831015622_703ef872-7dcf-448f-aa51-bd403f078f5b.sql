CREATE OR REPLACE FUNCTION public.transfer_between_wallets(_user_id uuid, _from_kind text, _to_kind text, _amount numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
    _from uuid;
    _to uuid;
    _ref text;
    _balance numeric(18,2);
begin
    if _amount is null or _amount <= 0 then
        raise exception 'montante invalido';
    end if;
    if _from_kind = _to_kind then
        raise exception 'carteiras iguais';
    end if;
    if _from_kind not in ('betting','investment') or _to_kind not in ('betting','investment') then
        raise exception 'tipo de carteira invalido';
    end if;

    _from := public.ensure_wallet(_user_id, _from_kind);
    _to := public.ensure_wallet(_user_id, _to_kind);
    _ref := 'transfer:' || gen_random_uuid()::text;

    perform public.wallet_apply(
        _from, 'transfer_out', -_amount, _ref || ':out', null, null,
        jsonb_build_object('to_kind', _to_kind)
    );
    perform public.wallet_apply(
        _to, 'transfer_in', _amount, _ref || ':in', null, null,
        jsonb_build_object('from_kind', _from_kind)
    );

    select balance into _balance from public.wallets where id = _to;
    return _balance;
end;
$$;

REVOKE ALL ON FUNCTION public.transfer_between_wallets(uuid, text, text, numeric) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.transfer_between_wallets(uuid, text, text, numeric) TO service_role;