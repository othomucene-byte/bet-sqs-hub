update public.exchange_markets set status = 'OPEN', opens_at = '08:00', closes_at = '20:00' where code = 'SQSX-LIVE';

update public.exchange_assets a
set market_id = (select id from public.exchange_markets where code = 'SQSX-LIVE'),
    environment = 'LIVE',
    is_demo = false,
    reference_price_source = 'Preço inicial de referência Betfcom SQs'
where a.environment = 'PAPER';

update public.exchange_markets set status = 'CLOSED' where code = 'SQSX-PAPER';