-- Helper: recalcula a posição do utilizador num produto a partir dos investimentos
CREATE OR REPLACE FUNCTION public.recalc_investment_position(_user_id uuid, _product_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
    _invested numeric(18,2);
    _accrued numeric(18,2);
    _realized numeric(18,2);
begin
    select coalesce(sum(case when status = 'active' then amount else 0 end), 0),
           coalesce(sum(case when status = 'active' then accrued_return else 0 end), 0),
           coalesce(sum(case when status <> 'active' then accrued_return else 0 end), 0)
      into _invested, _accrued, _realized
      from public.investments
     where user_id = _user_id and product_id = _product_id;

    insert into public.investment_positions (user_id, product_id, invested_amount, current_value, realized_result, unrealized_result)
    values (_user_id, _product_id, _invested, _invested + _accrued, _realized, _accrued)
    on conflict (user_id, product_id) do update
       set invested_amount = excluded.invested_amount,
           current_value = excluded.current_value,
           realized_result = excluded.realized_result,
           unrealized_result = excluded.unrealized_result,
           updated_at = now();
end;
$$;
REVOKE ALL ON FUNCTION public.recalc_investment_position(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_investment_position(uuid, uuid) TO service_role;

-- Ordem de subscrição idempotente
CREATE OR REPLACE FUNCTION public.place_investment_order(
    _user_id uuid,
    _product_id uuid,
    _amount numeric,
    _idempotency_key text
)
RETURNS public.investment_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
    _order public.investment_orders;
    _product public.investment_products;
    _kyc text;
    _wallet_id uuid;
    _inv public.investments;
begin
    select * into _order from public.investment_orders where idempotency_key = _idempotency_key;
    if found then
        return _order;
    end if;

    if _amount is null or _amount <= 0 then
        raise exception 'montante invalido';
    end if;

    select status into _kyc from public.kyc_profiles where user_id = _user_id;
    if _kyc is null or _kyc <> 'approved' then
        raise exception 'verificacao de identidade (KYC) nao aprovada';
    end if;

    select * into _product from public.investment_products where id = _product_id for update;
    if not found then
        raise exception 'produto inexistente';
    end if;
    if _product.status <> 'open' then
        raise exception 'produto fechado a novas subscricoes';
    end if;
    if _amount < _product.min_amount then
        raise exception 'montante abaixo do minimo do produto';
    end if;
    if _product.max_amount is not null and _amount > _product.max_amount then
        raise exception 'montante acima do maximo do produto';
    end if;
    if _product.raised + _amount > _product.capacity then
        raise exception 'capacidade do produto esgotada';
    end if;

    insert into public.investment_orders (user_id, product_id, side, amount, currency, status, idempotency_key, reference)
    values (_user_id, _product_id, 'buy', _amount, _product.currency, 'PROCESSING', _idempotency_key,
            'ord:' || gen_random_uuid()::text)
    returning * into _order;

    insert into public.investment_order_events (order_id, from_status, to_status, note)
    values (_order.id, 'PENDING', 'PROCESSING', 'ordem aceite');

    _wallet_id := public.ensure_wallet(_user_id, 'investment');

    insert into public.investments (user_id, product_id, amount, principal, target_rate_annual, reference, matures_at, order_id)
    values (_user_id, _product_id, _amount, _amount, _product.target_rate_annual,
            'inv:' || gen_random_uuid()::text,
            now() + (_product.term_months || ' months')::interval, _order.id)
    returning * into _inv;

    perform public.wallet_apply(
        _wallet_id, 'investment_buy', -_amount, 'invbuy:' || _inv.id::text, null, null,
        jsonb_build_object('product_id', _product_id, 'investment_id', _inv.id, 'order_id', _order.id)
    );

    update public.investment_products set raised = raised + _amount where id = _product_id;

    update public.investment_orders
       set status = 'EXECUTED', executed_amount = _amount, investment_id = _inv.id
     where id = _order.id
    returning * into _order;

    insert into public.investment_order_events (order_id, from_status, to_status, note)
    values (_order.id, 'PROCESSING', 'EXECUTED', 'subscricao liquidada');

    perform public.recalc_investment_position(_user_id, _product_id);

    insert into public.notifications (user_id, category, title, body, metadata)
    values (_user_id, 'investment', 'Subscrição executada',
            'A tua subscrição foi liquidada. Referência ' || _order.reference,
            jsonb_build_object('order_id', _order.id, 'investment_id', _inv.id));

    return _order;
end;
$$;
REVOKE ALL ON FUNCTION public.place_investment_order(uuid, uuid, numeric, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_investment_order(uuid, uuid, numeric, text) TO service_role;

-- Resgate idempotente
CREATE OR REPLACE FUNCTION public.redeem_investment(
    _user_id uuid,
    _investment_id uuid,
    _idempotency_key text
)
RETURNS public.investment_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
    _order public.investment_orders;
    _inv public.investments;
    _wallet_id uuid;
    _total numeric(18,2);
    _red public.investment_redemptions;
begin
    select * into _order from public.investment_orders where idempotency_key = _idempotency_key;
    if found then
        return _order;
    end if;

    select * into _inv from public.investments where id = _investment_id for update;
    if not found then
        raise exception 'investimento inexistente';
    end if;
    if _inv.user_id <> _user_id then
        raise exception 'investimento nao pertence ao utilizador';
    end if;
    if _inv.status <> 'active' then
        raise exception 'investimento nao esta ativo';
    end if;

    _total := _inv.amount + coalesce(_inv.accrued_return, 0);

    insert into public.investment_orders (user_id, product_id, investment_id, side, amount, currency, status, idempotency_key, reference)
    values (_user_id, _inv.product_id, _investment_id, 'redeem', _total, 'MZN', 'PROCESSING', _idempotency_key,
            'ord:' || gen_random_uuid()::text)
    returning * into _order;

    insert into public.investment_order_events (order_id, from_status, to_status, note)
    values (_order.id, 'PENDING', 'PROCESSING', 'resgate aceite');

    insert into public.investment_redemptions (user_id, investment_id, order_id, principal, return_amount, total_amount, status, reference)
    values (_user_id, _investment_id, _order.id, _inv.amount, coalesce(_inv.accrued_return, 0), _total, 'PROCESSING',
            'red:' || gen_random_uuid()::text)
    returning * into _red;

    _wallet_id := public.ensure_wallet(_user_id, 'investment');

    perform public.wallet_apply(
        _wallet_id, 'investment_redemption', _total, 'invred:' || _red.id::text, null, null,
        jsonb_build_object('investment_id', _investment_id, 'order_id', _order.id)
    );

    update public.investments
       set status = 'redeemed', redeemed_at = now()
     where id = _investment_id;

    update public.investment_products
       set raised = greatest(0, raised - _inv.amount)
     where id = _inv.product_id;

    update public.investment_redemptions set status = 'COMPLETED' where id = _red.id;

    update public.investment_orders
       set status = 'REDEEMED', executed_amount = _total
     where id = _order.id
    returning * into _order;

    insert into public.investment_order_events (order_id, from_status, to_status, note)
    values (_order.id, 'PROCESSING', 'REDEEMED', 'resgate liquidado');

    perform public.recalc_investment_position(_user_id, _inv.product_id);

    insert into public.notifications (user_id, category, title, body, metadata)
    values (_user_id, 'investment', 'Resgate concluído',
            'O resgate foi creditado na carteira de investimentos. Referência ' || _red.reference,
            jsonb_build_object('order_id', _order.id, 'redemption_id', _red.id));

    return _order;
end;
$$;
REVOKE ALL ON FUNCTION public.redeem_investment(uuid, uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_investment(uuid, uuid, text) TO service_role;

-- Lançamento de rendimento/prejuízo declarado
CREATE OR REPLACE FUNCTION public.post_investment_return(
    _investment_id uuid,
    _kind text,
    _amount numeric,
    _reference text,
    _period_start date DEFAULT NULL,
    _period_end date DEFAULT NULL,
    _settle boolean DEFAULT false
)
RETURNS public.investment_returns
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
    _existing public.investment_returns;
    _inv public.investments;
    _row public.investment_returns;
    _wallet_id uuid;
begin
    select * into _existing from public.investment_returns where reference = _reference;
    if found then
        return _existing;
    end if;

    if _kind not in ('PROFIT','LOSS') then
        raise exception 'tipo de resultado invalido';
    end if;
    if _amount is null or _amount < 0 then
        raise exception 'montante invalido';
    end if;

    select * into _inv from public.investments where id = _investment_id for update;
    if not found then
        raise exception 'investimento inexistente';
    end if;

    insert into public.investment_returns (user_id, investment_id, product_id, kind, amount, period_start, period_end, reference, settled)
    values (_inv.user_id, _investment_id, _inv.product_id, _kind, _amount, _period_start, _period_end, _reference, _settle)
    returning * into _row;

    if _settle then
        _wallet_id := public.ensure_wallet(_inv.user_id, 'investment');
        perform public.wallet_apply(
            _wallet_id,
            case when _kind = 'PROFIT' then 'profit' else 'loss' end,
            case when _kind = 'PROFIT' then _amount else -_amount end,
            'invret:' || _row.id::text, null, null,
            jsonb_build_object('investment_id', _investment_id, 'return_id', _row.id)
        );
    else
        update public.investments
           set accrued_return = coalesce(accrued_return, 0)
               + case when _kind = 'PROFIT' then _amount else -_amount end
         where id = _investment_id;
    end if;

    perform public.recalc_investment_position(_inv.user_id, _inv.product_id);

    insert into public.notifications (user_id, category, title, body, metadata)
    values (_inv.user_id, 'investment',
            case when _kind = 'PROFIT' then 'Rendimento registado' else 'Prejuízo registado' end,
            'Resultado declarado no teu investimento.',
            jsonb_build_object('investment_id', _investment_id, 'return_id', _row.id));

    return _row;
end;
$$;
REVOKE ALL ON FUNCTION public.post_investment_return(uuid, text, numeric, text, date, date, boolean) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_investment_return(uuid, text, numeric, text, date, date, boolean) TO service_role;