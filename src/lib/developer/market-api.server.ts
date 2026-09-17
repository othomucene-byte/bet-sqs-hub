/**
 * Leitura dos dados públicos do mercado para a API de developers.
 *
 * Só dados verificados pelo servidor: preços de negócios, preço de referência
 * identificado pela fonte, livro agregado e fita pública de negócios. Nunca
 * expõe identificadores de pessoas nem ordens individuais.
 */

type Db = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function db(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function listAssets() {
  const client = await db();
  const [assetsRes, dataRes] = await Promise.all([
    client
      .from("exchange_assets")
      .select(
        "id, symbol, name, asset_type, status, currency, country, tick_size, lot_size, reference_price, reference_price_source, logo_url",
      )
      .eq("environment", "LIVE")
      .order("symbol"),
    client.from("market_data").select("asset_id, last_price, prev_close, volume, day_high, day_low"),
  ]);
  const byAsset = new Map((dataRes.data ?? []).map((row) => [row.asset_id as string, row]));

  return (assetsRes.data ?? []).map((a) => {
    const md = byAsset.get(a.id as string);
    const traded = md?.last_price == null ? null : Number(md.last_price);
    const reference = a.reference_price == null ? null : Number(a.reference_price);
    return {
      symbol: a.symbol as string,
      name: a.name as string,
      asset_type: a.asset_type as string,
      status: a.status as string,
      currency: a.currency as string,
      country: a.country as string,
      tick_size: Number(a.tick_size),
      lot_size: Number(a.lot_size),
      logo_url: (a.logo_url as string | null) ?? null,
      last_price: traded ?? reference,
      price_basis: traded != null ? "trade" : reference != null ? "reference" : "unavailable",
      reference_price: reference,
      reference_price_source: (a.reference_price_source as string | null) ?? null,
      prev_close: md?.prev_close == null ? null : Number(md.prev_close),
      day_high: md?.day_high == null ? null : Number(md.day_high),
      day_low: md?.day_low == null ? null : Number(md.day_low),
      volume: Number(md?.volume ?? 0),
    };
  });
}

export async function findAsset(symbol: string, environment: "LIVE" | "PAPER" = "LIVE") {
  const client = await db();
  const { data } = await client
    .from("exchange_assets")
    .select("id, symbol, name, environment")
    .eq("environment", environment)
    .ilike("symbol", symbol)
    .maybeSingle();
  return data ? { id: data.id as string, symbol: data.symbol as string, name: data.name as string } : null;
}

export async function assetDetail(symbol: string) {
  const asset = await findAsset(symbol);
  if (!asset) return null;
  const assets = await listAssets();
  const quote = assets.find((entry) => entry.symbol === asset.symbol) ?? null;
  const client = await db();
  const { data: company } = await client
    .from("company_data_points")
    .select("kind, title, summary, metrics, source_name, source_url, collected_at, event_date")
    .eq("asset_id", asset.id)
    .eq("status", "approved")
    .order("collected_at", { ascending: false })
    .limit(20);

  return {
    ...(quote ?? { symbol: asset.symbol, name: asset.name }),
    company_data: (company ?? []).map((row) => ({
      kind: row.kind as string,
      title: row.title as string,
      summary: (row.summary as string | null) ?? null,
      metrics: row.metrics ?? {},
      source_name: row.source_name as string,
      source_url: (row.source_url as string | null) ?? null,
      event_date: (row.event_date as string | null) ?? null,
      collected_at: row.collected_at as string,
    })),
  };
}

export async function orderBook(symbol: string, depth: number) {
  const asset = await findAsset(symbol);
  if (!asset) return null;
  const client = await db();
  const { data } = await client.rpc("exchange_order_book", {
    _asset_id: asset.id,
    _depth: depth,
  });
  const levels = (data ?? []) as Array<{ side: string; price: number; quantity: number; orders: number }>;
  return {
    symbol: asset.symbol,
    bids: levels
      .filter((l) => l.side === "BUY")
      .map((l) => ({ price: Number(l.price), quantity: Number(l.quantity), orders: Number(l.orders) })),
    asks: levels
      .filter((l) => l.side === "SELL")
      .map((l) => ({ price: Number(l.price), quantity: Number(l.quantity), orders: Number(l.orders) })),
  };
}

export async function publicTrades(symbol: string, limit: number) {
  const asset = await findAsset(symbol);
  if (!asset) return null;
  const client = await db();
  const { data } = await client
    .from("exchange_public_trades")
    .select("price, quantity, executed_at")
    .eq("asset_id", asset.id)
    .order("executed_at", { ascending: false })
    .limit(limit);
  return {
    symbol: asset.symbol,
    trades: (data ?? []).map((row) => ({
      price: Number(row.price),
      quantity: Number(row.quantity),
      executed_at: row.executed_at as string,
    })),
  };
}
