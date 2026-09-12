import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PositionRow = {
  assetId: string;
  symbol: string;
  name: string;
  quantity: number;
  reservedQuantity: number;
  avgPrice: number;
  lastPrice: number | null;
  marketValue: number | null;
  pnl: number | null;
  pnlPct: number | null;
};

export type OrderRow = {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  orderType: "MARKET" | "LIMIT";
  quantity: number;
  filledQuantity: number;
  remainingQuantity: number;
  limitPrice: number | null;
  avgFillPrice: number | null;
  status: string;
  reservedAmount: number;
  createdAt: string;
};

export type TradeRow = {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  price: number;
  quantity: number;
  grossValue: number;
  fee: number;
  settlementStatus: string;
  executedAt: string;
};

export type ExchangeAccountOverview = {
  environment: "PAPER" | "LIVE";
  accountId: string;
  available: number;
  reserved: number;
  securities: number;
  portfolioValue: number;
  totalValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number | null;
  realizedPnl: number;
  positions: PositionRow[];
  openOrders: OrderRow[];
  recentTrades: TradeRow[];
  watchlist: string[];
  kycApproved: boolean;
  investmentWalletBalance: number;
};

const ENV = z.enum(["PAPER", "LIVE"]);

async function adapterFor(environment: "PAPER" | "LIVE") {
  const { getExchangeAdapter } = await import("./adapters.server");
  return getExchangeAdapter(environment);
}

/** Visão da conta de mercado. Saldos derivam do ledger, no servidor. */
export const getExchangeAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ environment: ENV.default("PAPER") }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<ExchangeAccountOverview> => {
    const { PaperTradingAdapter } = await import("./adapters.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const paper = new PaperTradingAdapter(data.environment);
    const account = await paper.getAccount(context.userId);

    const [positionsRes, ordersRes, tradesRes, watchRes, kycRes, walletRes, marketDataRes] =
      await Promise.all([
        supabaseAdmin
          .from("positions")
          .select("asset_id, quantity, reserved_quantity, avg_price, realized_pnl, exchange_assets(symbol, name)")
          .eq("account_id", account.accountId)
          .gt("quantity", 0),
        context.supabase
          .from("exchange_orders")
          .select(
            "id, side, order_type, quantity, filled_quantity, remaining_quantity, limit_price, avg_fill_price, status, reserved_amount, created_at, exchange_assets(symbol)",
          )
          .eq("user_id", context.userId)
          .in("status", ["OPEN", "PARTIALLY_FILLED"])
          .order("created_at", { ascending: false }),
        context.supabase
          .from("trades")
          .select(
            "id, price, quantity, gross_value, buyer_fee, seller_fee, buyer_id, seller_id, settlement_status, executed_at, exchange_assets(symbol)",
          )
          .or(`buyer_id.eq.${context.userId},seller_id.eq.${context.userId}`)
          .order("executed_at", { ascending: false })
          .limit(20),
        context.supabase.from("watchlists").select("asset_id").eq("user_id", context.userId),
        context.supabase
          .from("kyc_profiles")
          .select("status")
          .eq("user_id", context.userId)
          .maybeSingle(),
        context.supabase
          .from("wallets")
          .select("balance")
          .eq("user_id", context.userId)
          .eq("kind", "investment")
          .maybeSingle(),
        supabaseAdmin.from("exchange_assets").select("id, reference_price, market_data(last_price)"),
      ]);

    const lastPrices = new Map<string, number>(
      (marketDataRes.data ?? [])
        .map((r) => {
          const marketData = Array.isArray(r.market_data) ? r.market_data[0] : r.market_data;
          const marketPrice = marketData?.last_price;
          const value = marketPrice == null ? r.reference_price : marketPrice;
          return value == null ? null : [r.id as string, Number(value)] as const;
        })
        .filter((row): row is readonly [string, number] => row != null),
    );

    let portfolioValue = 0;
    let costBasis = 0;
    let realizedPnl = 0;

    const positions: PositionRow[] = (positionsRes.data ?? []).map((p) => {
      const asset = p.exchange_assets as { symbol: string; name: string } | null;
      const quantity = Number(p.quantity);
      const avgPrice = Number(p.avg_price);
      const last = lastPrices.get(p.asset_id as string) ?? null;
      const marketValue = last == null ? null : Number((last * quantity).toFixed(2));
      const cost = avgPrice * quantity;
      realizedPnl += Number(p.realized_pnl);
      if (marketValue != null) {
        portfolioValue += marketValue;
        costBasis += cost;
      }
      return {
        assetId: p.asset_id as string,
        symbol: asset?.symbol ?? "—",
        name: asset?.name ?? "—",
        quantity,
        reservedQuantity: Number(p.reserved_quantity),
        avgPrice,
        lastPrice: last,
        marketValue,
        pnl: marketValue == null ? null : Number((marketValue - cost).toFixed(2)),
        pnlPct: marketValue == null || cost === 0 ? null : ((marketValue - cost) / cost) * 100,
      };
    });

    const openOrders: OrderRow[] = (ordersRes.data ?? []).map((o) => ({
      id: o.id as string,
      symbol: (o.exchange_assets as { symbol: string } | null)?.symbol ?? "—",
      side: o.side as "BUY" | "SELL",
      orderType: o.order_type as "MARKET" | "LIMIT",
      quantity: Number(o.quantity),
      filledQuantity: Number(o.filled_quantity),
      remainingQuantity: Number(o.remaining_quantity),
      limitPrice: o.limit_price == null ? null : Number(o.limit_price),
      avgFillPrice: o.avg_fill_price == null ? null : Number(o.avg_fill_price),
      status: o.status as string,
      reservedAmount: Number(o.reserved_amount),
      createdAt: o.created_at as string,
    }));

    const recentTrades: TradeRow[] = (tradesRes.data ?? []).map((t) => {
      const isBuyer = t.buyer_id === context.userId;
      return {
        id: t.id as string,
        symbol: (t.exchange_assets as { symbol: string } | null)?.symbol ?? "—",
        side: isBuyer ? "BUY" : "SELL",
        price: Number(t.price),
        quantity: Number(t.quantity),
        grossValue: Number(t.gross_value),
        fee: Number(isBuyer ? t.buyer_fee : t.seller_fee),
        settlementStatus: t.settlement_status as string,
        executedAt: t.executed_at as string,
      };
    });

    const unrealizedPnl = Number((portfolioValue - costBasis).toFixed(2));
    const totalValue = Number((account.available + account.reserved + portfolioValue).toFixed(2));

    return {
      environment: data.environment,
      accountId: account.accountId,
      available: account.available,
      reserved: account.reserved,
      securities: account.securities,
      portfolioValue: Number(portfolioValue.toFixed(2)),
      totalValue,
      unrealizedPnl,
      unrealizedPnlPct: costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : null,
      realizedPnl: Number(realizedPnl.toFixed(2)),
      positions,
      openOrders,
      recentTrades,
      watchlist: (watchRes.data ?? []).map((w) => w.asset_id as string),
      kycApproved: kycRes.data?.status === "approved",
      investmentWalletBalance: Number(walletRes.data?.balance ?? 0),
    };
  });

/** Criação de ordem: validação, reserva e cruzamento ocorrem no PostgreSQL. */
export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        assetId: z.string().uuid(),
        side: z.enum(["BUY", "SELL"]),
        orderType: z.enum(["MARKET", "LIMIT"]),
        quantity: z.number().positive().max(10_000_000),
        limitPrice: z.number().positive().max(10_000_000).nullable().default(null),
        idempotencyKey: z.string().trim().min(8).max(80),
        environment: ENV.default("PAPER"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const adapter = await adapterFor(data.environment);
    const order = await adapter.submitOrder({
      userId: context.userId,
      assetId: data.assetId,
      side: data.side,
      orderType: data.orderType,
      quantity: data.quantity,
      limitPrice: data.orderType === "LIMIT" ? data.limitPrice : null,
      idempotencyKey: data.idempotencyKey,
      environment: data.environment,
    });
    return order;
  });

export const cancelOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ orderId: z.string().uuid(), environment: ENV.default("PAPER") })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const adapter = await adapterFor(data.environment);
    return adapter.cancelOrder(context.userId, data.orderId);
  });

/** Crédito de simulação: dinheiro fictício, isolado do dinheiro real. */
export const grantPaperCash = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        amount: z.number().positive().max(1_000_000),
        idempotencyKey: z.string().trim().min(8).max(80),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.rpc("exchange_grant_paper_cash", {
      _user_id: context.userId,
      _amount: data.amount,
      _idempotency_key: data.idempotencyKey,
    });
    if (error) throw new Error(error.message);
    const transfer = row as unknown as { id: string; amount: number; reference: string };
    return { id: transfer.id, amount: Number(transfer.amount), reference: transfer.reference };
  });

/** Movimento real entre a carteira de investimentos e a conta LIVE do mercado. */
export const transferWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        direction: z.enum(["IN", "OUT"]),
        amount: z.number().positive().max(10_000_000),
        idempotencyKey: z.string().trim().min(8).max(80),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.rpc("exchange_transfer_wallet", {
      _user_id: context.userId,
      _direction: data.direction,
      _amount: data.amount,
      _idempotency_key: data.idempotencyKey,
    });
    if (error) throw new Error(error.message);
    const transfer = row as unknown as { id: string; status: string; reference: string };
    return { id: transfer.id, status: transfer.status, reference: transfer.reference };
  });

export const toggleWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ assetId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("watchlists")
      .select("id")
      .eq("user_id", context.userId)
      .eq("asset_id", data.assetId)
      .maybeSingle();

    if (existing) {
      await context.supabase.from("watchlists").delete().eq("id", existing.id as string);
      return { watching: false };
    }
    const { error } = await context.supabase
      .from("watchlists")
      .insert({ user_id: context.userId, asset_id: data.assetId });
    if (error) throw new Error(error.message);
    return { watching: true };
  });

export type HistoryRow = {
  orders: OrderRow[];
  transfers: {
    id: string;
    direction: string;
    source: string;
    amount: number;
    status: string;
    reference: string;
    createdAt: string;
  }[];
  ledger: {
    id: string;
    reference: string;
    referenceType: string;
    debit: number;
    credit: number;
    kind: string;
    createdAt: string;
  }[];
};

/** Histórico completo: ordens, transferências e lançamentos do ledger do utilizador. */
export const getExchangeHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(200).default(100) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<HistoryRow> => {
    const [ordersRes, transfersRes, entriesRes] = await Promise.all([
      context.supabase
        .from("exchange_orders")
        .select(
          "id, side, order_type, quantity, filled_quantity, remaining_quantity, limit_price, avg_fill_price, status, reserved_amount, created_at, exchange_assets(symbol)",
        )
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(data.limit),
      context.supabase
        .from("exchange_transfers")
        .select("id, direction, source, amount, status, reference, created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(data.limit),
      context.supabase
        .from("ledger_entries")
        .select(
          "id, debit, credit, created_at, ledger_accounts(kind), ledger_transactions(reference, reference_type)",
        )
        .order("created_at", { ascending: false })
        .limit(data.limit),
    ]);

    return {
      orders: (ordersRes.data ?? []).map((o) => ({
        id: o.id as string,
        symbol: (o.exchange_assets as { symbol: string } | null)?.symbol ?? "—",
        side: o.side as "BUY" | "SELL",
        orderType: o.order_type as "MARKET" | "LIMIT",
        quantity: Number(o.quantity),
        filledQuantity: Number(o.filled_quantity),
        remainingQuantity: Number(o.remaining_quantity),
        limitPrice: o.limit_price == null ? null : Number(o.limit_price),
        avgFillPrice: o.avg_fill_price == null ? null : Number(o.avg_fill_price),
        status: o.status as string,
        reservedAmount: Number(o.reserved_amount),
        createdAt: o.created_at as string,
      })),
      transfers: (transfersRes.data ?? []).map((t) => ({
        id: t.id as string,
        direction: t.direction as string,
        source: t.source as string,
        amount: Number(t.amount),
        status: t.status as string,
        reference: t.reference as string,
        createdAt: t.created_at as string,
      })),
      ledger: (entriesRes.data ?? []).map((e) => {
        const tx = e.ledger_transactions as { reference: string; reference_type: string } | null;
        return {
          id: e.id as string,
          reference: tx?.reference ?? "—",
          referenceType: tx?.reference_type ?? "—",
          debit: Number(e.debit),
          credit: Number(e.credit),
          kind: (e.ledger_accounts as { kind: string } | null)?.kind ?? "—",
          createdAt: e.created_at as string,
        };
      }),
    };
  });
