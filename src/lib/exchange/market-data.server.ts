/**
 * MarketDataProvider — fonte de dados de mercado.
 *
 * PlatformMarketDataProvider devolve apenas o que existe na base de dados da
 * plataforma (negócios realmente executados no ambiente de simulação). Quando
 * não há negócios, devolve null: nunca inventa cotações.
 *
 * BvmMarketDataProvider é o ponto de integração futura. Sem API autorizada e
 * documentada, responde com "Market data integration pending".
 */

export type Quote = {
  assetId: string;
  symbol: string;
  lastPrice: number | null;
  prevClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number;
  bid: number | null;
  ask: number | null;
  updatedAt: string | null;
};

export type BookLevel = { side: "BUY" | "SELL"; price: number; quantity: number; orders: number };

export type TapeTrade = {
  id: string;
  price: number;
  quantity: number;
  executedAt: string;
};

export interface MarketDataProvider {
  readonly name: string;
  getQuote(assetId: string): Promise<Quote | null>;
  getHistoricalPrices(assetId: string, limit?: number): Promise<{ t: string; price: number }[]>;
  getOrderBook(assetId: string, depth?: number): Promise<BookLevel[]>;
  getTrades(assetId: string, limit?: number): Promise<TapeTrade[]>;
}

type Client = import("@supabase/supabase-js").SupabaseClient<
  import("@/integrations/supabase/types").Database
>;

export class PlatformMarketDataProvider implements MarketDataProvider {
  readonly name = "PlatformMarketDataProvider";

  constructor(private readonly db: Client) {}

  async getQuote(assetId: string): Promise<Quote | null> {
    const [assetRes, dataRes, book] = await Promise.all([
      this.db.from("exchange_assets").select("id, symbol").eq("id", assetId).maybeSingle(),
      this.db
        .from("market_data")
        .select("last_price, prev_close, day_high, day_low, volume, updated_at")
        .eq("asset_id", assetId)
        .maybeSingle(),
      this.getOrderBook(assetId, 1),
    ]);
    if (!assetRes.data) return null;
    const md = dataRes.data;
    const bid = book.find((l) => l.side === "BUY")?.price ?? null;
    const ask = book.find((l) => l.side === "SELL")?.price ?? null;
    return {
      assetId,
      symbol: assetRes.data.symbol as string,
      lastPrice: md?.last_price == null ? null : Number(md.last_price),
      prevClose: md?.prev_close == null ? null : Number(md.prev_close),
      dayHigh: md?.day_high == null ? null : Number(md.day_high),
      dayLow: md?.day_low == null ? null : Number(md.day_low),
      volume: Number(md?.volume ?? 0),
      bid,
      ask,
      updatedAt: (md?.updated_at as string | undefined) ?? null,
    };
  }

  async getHistoricalPrices(assetId: string, limit = 60) {
    const { data } = await this.db
      .from("exchange_public_trades")
      .select("price, executed_at")
      .eq("asset_id", assetId)
      .order("executed_at", { ascending: false })
      .limit(limit);
    return (data ?? [])
      .map((row) => ({ t: row.executed_at as string, price: Number(row.price) }))
      .reverse();
  }

  async getOrderBook(assetId: string, depth = 10): Promise<BookLevel[]> {
    const { data } = await this.db.rpc("exchange_order_book", {
      _asset_id: assetId,
      _depth: depth,
    });
    return ((data ?? []) as { side: string; price: number; quantity: number; orders: number }[]).map(
      (row) => ({
        side: row.side as "BUY" | "SELL",
        price: Number(row.price),
        quantity: Number(row.quantity),
        orders: Number(row.orders),
      }),
    );
  }

  async getTrades(assetId: string, limit = 25): Promise<TapeTrade[]> {
    const { data } = await this.db
      .from("exchange_public_trades")
      .select("trade_id, price, quantity, executed_at")
      .eq("asset_id", assetId)
      .order("executed_at", { ascending: false })
      .limit(limit);
    return (data ?? []).map((row) => ({
      id: row.trade_id as string,
      price: Number(row.price),
      quantity: Number(row.quantity),
      executedAt: row.executed_at as string,
    }));
  }
}

export class BvmMarketDataProvider implements MarketDataProvider {
  readonly name = "BvmMarketDataProvider";
  private pending(): never {
    throw new Error("Market data integration pending");
  }
  getQuote(): Promise<Quote | null> {
    this.pending();
  }
  getHistoricalPrices(): Promise<{ t: string; price: number }[]> {
    this.pending();
  }
  getOrderBook(): Promise<BookLevel[]> {
    this.pending();
  }
  getTrades(): Promise<TapeTrade[]> {
    this.pending();
  }
}
