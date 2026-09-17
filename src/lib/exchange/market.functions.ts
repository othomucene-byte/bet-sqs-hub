import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type MarketAssetRow = {
  id: string;
  symbol: string;
  name: string;
  assetType: string;
  status: string;
  isDemo: boolean;
  environment: string;
  logoUrl: string | null;
  lastPrice: number | null;
  prevClose: number | null;
  changePct: number | null;
  volume: number;
  bid: number | null;
  ask: number | null;
  spark: number[];
  /** Preço de arranque definido pela administração; usado só para exibição quando não há negócios. */
  referencePrice: number | null;
  referenceSource: string | null;
  /** true quando o valor mostrado é de referência e não resultou de negócios. */
  isReferenceOnly: boolean;
  referenceHistory: { t: string; price: number }[];
  latestCompanyUpdate: {
    title: string;
    sourceName: string;
    sourceUrl: string | null;
    collectedAt: string;
  } | null;
};


export type MarketOverview = {
  marketStatus: "PRE_OPEN" | "OPEN" | "PAUSED" | "CLOSED";
  marketName: string;
  environment: "PAPER" | "LIVE";
  opensAt: string;
  closesAt: string;
  marketDataProvider: string;
  assets: MarketAssetRow[];
};

/** Catálogo público do mercado. Sem negócios executados, o preço fica indisponível. */
export const getMarketOverview = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ environment: z.enum(["LIVE", "PAPER"]).default("LIVE") }).parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<MarketOverview> => {
    const { publicClient } = await import("@/lib/investments/public-client.server");
    const db = publicClient();
    const marketCode = data.environment === "LIVE" ? "SQSX-LIVE" : "SQSX-PAPER";

    const [marketRes, assetsRes, dataRes, tradesRes, bookRes, referenceRes, companyRes] = await Promise.all([
      db
        .from("exchange_markets")
        .select("name, status, environment, opens_at, closes_at")
        .eq("code", marketCode)
        .maybeSingle(),
      db
        .from("exchange_assets")
        .select(
          "id, symbol, name, asset_type, status, is_demo, environment, logo_url, reference_price, reference_price_source",
        )
        .eq("environment", data.environment)
        .order("symbol"),
      db.from("market_data").select("asset_id, last_price, prev_close, volume"),
      db.from("exchange_public_trades").select("asset_id, price, executed_at").order("executed_at").limit(500),
      db
        .from("exchange_orders")
        .select("asset_id, side, limit_price, remaining_quantity, status")
        .in("status", ["OPEN", "PARTIALLY_FILLED"]),
      db
        .from("exchange_reference_price_history")
        .select("asset_id, price, effective_at")
        .order("effective_at")
        .limit(500),
      db
        .from("company_data_points")
        .select("asset_id, title, source_name, source_url, collected_at")
        .eq("status", "approved")
        .order("collected_at", { ascending: false })
        .limit(500),
    ]);

    const dataByAsset = new Map(
      (dataRes.data ?? []).map((row) => [row.asset_id as string, row]),
    );
    const sparks = new Map<string, number[]>();
    for (const t of tradesRes.data ?? []) {
      const key = t.asset_id as string;
      const arr = sparks.get(key) ?? [];
      arr.push(Number(t.price));
      sparks.set(key, arr);
    }
    const references = new Map<string, { t: string; price: number }[]>();
    for (const row of referenceRes.data ?? []) {
      const key = row.asset_id as string;
      const arr = references.get(key) ?? [];
      arr.push({ t: row.effective_at as string, price: Number(row.price) });
      references.set(key, arr);
    }
    const latestCompany = new Map<string, MarketAssetRow["latestCompanyUpdate"]>();
    for (const row of companyRes.data ?? []) {
      const key = row.asset_id as string;
      if (!latestCompany.has(key)) {
        latestCompany.set(key, {
          title: row.title as string,
          sourceName: row.source_name as string,
          sourceUrl: (row.source_url as string | null) ?? null,
          collectedAt: row.collected_at as string,
        });
      }
    }

    // O livro é agregado no servidor; as ordens individuais permanecem privadas por RLS.
    const bids = new Map<string, number>();
    const asks = new Map<string, number>();
    for (const o of bookRes.data ?? []) {
      const key = o.asset_id as string;
      const price = o.limit_price == null ? null : Number(o.limit_price);
      if (price == null) continue;
      if (o.side === "BUY") bids.set(key, Math.max(bids.get(key) ?? 0, price));
      else asks.set(key, Math.min(asks.get(key) ?? Number.POSITIVE_INFINITY, price));
    }

    const assets: MarketAssetRow[] = (assetsRes.data ?? []).map((a) => {
      const md = dataByAsset.get(a.id as string);
      const traded = md?.last_price == null ? null : Number(md.last_price);
      const reference = a.reference_price == null ? null : Number(a.reference_price);
      const last = traded ?? reference;
      const prev = md?.prev_close == null ? reference : Number(md.prev_close);
      const ask = asks.get(a.id as string);
      return {
        id: a.id as string,
        symbol: a.symbol as string,
        name: a.name as string,
        assetType: a.asset_type as string,
        status: a.status as string,
        isDemo: Boolean(a.is_demo),
        environment: a.environment as string,
        logoUrl: (a.logo_url as string | null) ?? null,
        lastPrice: last,
        prevClose: prev,
        changePct:
          traded != null && prev != null && prev > 0 ? ((traded - prev) / prev) * 100 : null,
        volume: Number(md?.volume ?? 0),
        bid: bids.get(a.id as string) ?? null,
        ask: ask == null || !Number.isFinite(ask) ? null : ask,
        spark: (sparks.get(a.id as string) ?? []).slice(-20),
        referencePrice: reference,
        referenceSource: (a.reference_price_source as string | null) ?? null,
        isReferenceOnly: traded == null && reference != null,
        referenceHistory: references.get(a.id as string) ?? [],
        latestCompanyUpdate: latestCompany.get(a.id as string) ?? null,
      };
    });


    const market = marketRes.data;
    return {
      marketStatus: (market?.status as MarketOverview["marketStatus"]) ?? "CLOSED",
      marketName: (market?.name as string) ?? "SQs Exchange",
      environment: (market?.environment as "PAPER" | "LIVE") ?? data.environment,
      opensAt: (market?.opens_at as string) ?? "09:00",
      closesAt: (market?.closes_at as string) ?? "15:00",
      marketDataProvider: "PlatformMarketDataProvider",
      assets,
    };
  });

export type AssetDetail = {
  id: string;
  symbol: string;
  name: string;
  assetType: string;
  status: string;
  currency: string;
  country: string;
  isDemo: boolean;
  environment: string;
  tickSize: number;
  lotSize: number;
  description: string | null;
  issuerInfo: string | null;
  companyName: string | null;
  marketStatus: string;
  quote: {
    lastPrice: number | null;
    prevClose: number | null;
    dayHigh: number | null;
    dayLow: number | null;
    volume: number;
    bid: number | null;
    ask: number | null;
  };
  book: { side: "BUY" | "SELL"; price: number; quantity: number; orders: number }[];
  trades: { id: string; price: number; quantity: number; executedAt: string }[];
  history: { t: string; price: number }[];
  referencePrice: number | null;
  referenceSource: string | null;
  isReferenceOnly: boolean;
  referenceHistory: { t: string; price: number }[];
};


export const getAssetDetail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ symbol: z.string().trim().min(1).max(20) }).parse(input),
  )
  .handler(async ({ data }): Promise<AssetDetail | null> => {
    const { publicClient } = await import("@/lib/investments/public-client.server");
    const { PlatformMarketDataProvider } = await import("./market-data.server");
    const db = publicClient();

    const { data: asset } = await db
      .from("exchange_assets")
      .select(
        "id, symbol, name, asset_type, status, currency, country, is_demo, environment, tick_size, lot_size, description, issuer_info, market_id, reference_price, reference_price_source, companies(name)",
      )
      .eq("symbol", data.symbol.toUpperCase())
      .eq("environment", "LIVE")
      .maybeSingle();
    if (!asset) return null;

    const provider = new PlatformMarketDataProvider(db);
    const [quote, book, trades, history, marketRes, referenceRes] = await Promise.all([
      provider.getQuote(asset.id as string),
      provider.getOrderBook(asset.id as string, 10),
      provider.getTrades(asset.id as string, 25),
      provider.getHistoricalPrices(asset.id as string, 60),
      db.from("exchange_markets").select("status").eq("id", asset.market_id as string).maybeSingle(),
      db
        .from("exchange_reference_price_history")
        .select("price, effective_at")
        .eq("asset_id", asset.id as string)
        .order("effective_at"),
    ]);

    const company = asset.companies as { name: string } | null;
    const reference = asset.reference_price == null ? null : Number(asset.reference_price);
    const traded = quote?.lastPrice ?? null;
    return {
      id: asset.id as string,
      symbol: asset.symbol as string,
      name: asset.name as string,
      assetType: asset.asset_type as string,
      status: asset.status as string,
      currency: asset.currency as string,
      country: asset.country as string,
      isDemo: Boolean(asset.is_demo),
      environment: asset.environment as string,
      tickSize: Number(asset.tick_size),
      lotSize: Number(asset.lot_size),
      description: (asset.description as string | null) ?? null,
      issuerInfo: (asset.issuer_info as string | null) ?? null,
      companyName: company?.name ?? null,
      marketStatus: (marketRes.data?.status as string) ?? "CLOSED",
      quote: {
        lastPrice: traded ?? reference,
        prevClose: quote?.prevClose ?? reference,
        dayHigh: quote?.dayHigh ?? null,
        dayLow: quote?.dayLow ?? null,
        volume: quote?.volume ?? 0,
        bid: quote?.bid ?? null,
        ask: quote?.ask ?? null,
      },
      book,
      trades,
      history,
      referencePrice: reference,
      referenceSource: (asset.reference_price_source as string | null) ?? null,
      isReferenceOnly: traded == null && reference != null,
      referenceHistory: (referenceRes.data ?? []).map((row) => ({
        t: row.effective_at as string,
        price: Number(row.price),
      })),
    };
  });
