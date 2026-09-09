import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(context: {
  supabase: import("@supabase/supabase-js").SupabaseClient<
    import("@/integrations/supabase/types").Database
  >;
  userId: string;
}) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito à administração.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type AdminExchangeOverview = {
  investors: number;
  openOrders: number;
  tradesToday: number;
  volumeToday: number;
  assets: number;
  pendingTransfers: number;
  riskAlerts: number;
  ledgerBalanced: boolean;
  totalDebits: number;
  totalCredits: number;
  markets: {
    id: string;
    code: string;
    name: string;
    status: string;
    environment: string;
    opensAt: string;
    closesAt: string;
  }[];
  assetRows: {
    id: string;
    symbol: string;
    name: string;
    assetType: string;
    status: string;
    isDemo: boolean;
    tickSize: number;
    lotSize: number;
    lastPrice: number | null;
  }[];
  orders: {
    id: string;
    symbol: string;
    side: string;
    orderType: string;
    quantity: number;
    remainingQuantity: number;
    limitPrice: number | null;
    status: string;
    createdAt: string;
  }[];
  trades: {
    id: string;
    symbol: string;
    price: number;
    quantity: number;
    grossValue: number;
    fees: number;
    settlementStatus: string;
    executedAt: string;
  }[];
  ledger: {
    id: string;
    reference: string;
    referenceType: string;
    createdAt: string;
    debit: number;
    credit: number;
    kind: string;
  }[];
  fees: { id: string; code: string; name: string; percent: number; fixed: number; active: boolean }[];
  limits: {
    id: string;
    userId: string | null;
    maxOrderValue: number;
    maxPositionValue: number;
    maxDailyVolume: number;
    maxOpenOrders: number;
  }[];
  alerts: { id: string; kind: string; message: string; createdAt: string }[];
  audit: {
    id: string;
    action: string;
    entity: string | null;
    entityId: string | null;
    createdAt: string;
  }[];
};

export const getAdminExchangeOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminExchangeOverview> => {
    const db = await requireAdmin(context);
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);

    const [
      accountsRes,
      openOrdersRes,
      tradesRes,
      assetsRes,
      transfersRes,
      alertsRes,
      entriesRes,
      marketsRes,
      ordersRes,
      feesRes,
      limitsRes,
      auditRes,
      marketDataRes,
    ] = await Promise.all([
      db.from("investment_accounts").select("id", { count: "exact", head: true }),
      db
        .from("exchange_orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["OPEN", "PARTIALLY_FILLED"]),
      db
        .from("trades")
        .select("id, price, quantity, gross_value, buyer_fee, seller_fee, settlement_status, executed_at, exchange_assets(symbol)")
        .gte("executed_at", dayStart.toISOString())
        .order("executed_at", { ascending: false })
        .limit(100),
      db
        .from("exchange_assets")
        .select("id, symbol, name, asset_type, status, is_demo, tick_size, lot_size")
        .order("symbol"),
      db
        .from("exchange_transfers")
        .select("id", { count: "exact", head: true })
        .in("status", ["PENDING", "PROCESSING"]),
      db.from("risk_alerts").select("id, kind, message, created_at").order("created_at", { ascending: false }).limit(50),
      db.from("ledger_entries").select("debit, credit").limit(20000),
      db.from("exchange_markets").select("id, code, name, status, environment, opens_at, closes_at").order("code"),
      db
        .from("exchange_orders")
        .select("id, side, order_type, quantity, remaining_quantity, limit_price, status, created_at, exchange_assets(symbol)")
        .order("created_at", { ascending: false })
        .limit(100),
      db.from("fee_configs").select("id, code, name, percent, fixed, active").order("code"),
      db
        .from("risk_limits")
        .select("id, user_id, max_order_value, max_position_value, max_daily_volume, max_open_orders")
        .limit(50),
      db
        .from("audit_logs")
        .select("id, action, entity, entity_id, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      db.from("market_data").select("asset_id, last_price"),
    ]);

    const { data: ledgerRows } = await db
      .from("ledger_entries")
      .select("id, debit, credit, created_at, ledger_accounts(kind), ledger_transactions(reference, reference_type)")
      .order("created_at", { ascending: false })
      .limit(100);

    let totalDebits = 0;
    let totalCredits = 0;
    for (const e of entriesRes.data ?? []) {
      totalDebits += Number(e.debit);
      totalCredits += Number(e.credit);
    }

    const lastPrices = new Map<string, number>(
      (marketDataRes.data ?? [])
        .filter((r) => r.last_price != null)
        .map((r) => [r.asset_id as string, Number(r.last_price)]),
    );

    const trades = tradesRes.data ?? [];
    return {
      investors: accountsRes.count ?? 0,
      openOrders: openOrdersRes.count ?? 0,
      tradesToday: trades.length,
      volumeToday: Number(trades.reduce((sum, t) => sum + Number(t.gross_value), 0).toFixed(2)),
      assets: (assetsRes.data ?? []).length,
      pendingTransfers: transfersRes.count ?? 0,
      riskAlerts: (alertsRes.data ?? []).length,
      ledgerBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
      totalDebits: Number(totalDebits.toFixed(2)),
      totalCredits: Number(totalCredits.toFixed(2)),
      markets: (marketsRes.data ?? []).map((m) => ({
        id: m.id as string,
        code: m.code as string,
        name: m.name as string,
        status: m.status as string,
        environment: m.environment as string,
        opensAt: m.opens_at as string,
        closesAt: m.closes_at as string,
      })),
      assetRows: (assetsRes.data ?? []).map((a) => ({
        id: a.id as string,
        symbol: a.symbol as string,
        name: a.name as string,
        assetType: a.asset_type as string,
        status: a.status as string,
        isDemo: Boolean(a.is_demo),
        tickSize: Number(a.tick_size),
        lotSize: Number(a.lot_size),
        lastPrice: lastPrices.get(a.id as string) ?? null,
      })),
      orders: (ordersRes.data ?? []).map((o) => ({
        id: o.id as string,
        symbol: (o.exchange_assets as { symbol: string } | null)?.symbol ?? "—",
        side: o.side as string,
        orderType: o.order_type as string,
        quantity: Number(o.quantity),
        remainingQuantity: Number(o.remaining_quantity),
        limitPrice: o.limit_price == null ? null : Number(o.limit_price),
        status: o.status as string,
        createdAt: o.created_at as string,
      })),
      trades: trades.map((t) => ({
        id: t.id as string,
        symbol: (t.exchange_assets as { symbol: string } | null)?.symbol ?? "—",
        price: Number(t.price),
        quantity: Number(t.quantity),
        grossValue: Number(t.gross_value),
        fees: Number(t.buyer_fee) + Number(t.seller_fee),
        settlementStatus: t.settlement_status as string,
        executedAt: t.executed_at as string,
      })),
      ledger: (ledgerRows ?? []).map((e) => {
        const tx = e.ledger_transactions as { reference: string; reference_type: string } | null;
        return {
          id: e.id as string,
          reference: tx?.reference ?? "—",
          referenceType: tx?.reference_type ?? "—",
          createdAt: e.created_at as string,
          debit: Number(e.debit),
          credit: Number(e.credit),
          kind: (e.ledger_accounts as { kind: string } | null)?.kind ?? "—",
        };
      }),
      fees: (feesRes.data ?? []).map((f) => ({
        id: f.id as string,
        code: f.code as string,
        name: f.name as string,
        percent: Number(f.percent),
        fixed: Number(f.fixed),
        active: Boolean(f.active),
      })),
      limits: (limitsRes.data ?? []).map((l) => ({
        id: l.id as string,
        userId: (l.user_id as string | null) ?? null,
        maxOrderValue: Number(l.max_order_value),
        maxPositionValue: Number(l.max_position_value),
        maxDailyVolume: Number(l.max_daily_volume),
        maxOpenOrders: Number(l.max_open_orders),
      })),
      alerts: (alertsRes.data ?? []).map((a) => ({
        id: a.id as string,
        kind: a.kind as string,
        message: a.message as string,
        createdAt: a.created_at as string,
      })),
      audit: (auditRes.data ?? []).map((a) => ({
        id: a.id as string,
        action: a.action as string,
        entity: (a.entity as string | null) ?? null,
        entityId: (a.entity_id as string | null) ?? null,
        createdAt: a.created_at as string,
      })),
    };
  });

export const setMarketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        marketId: z.string().uuid(),
        status: z.enum(["PRE_OPEN", "OPEN", "PAUSED", "CLOSED"]),
        note: z.string().trim().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    const { error } = await db.rpc("exchange_set_market_status", {
      _admin_id: context.userId,
      _market_id: data.marketId,
      _status: data.status,
      _note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { status: data.status };
  });

export const upsertAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        marketId: z.string().uuid().optional(),
        symbol: z.string().trim().min(1).max(20).toUpperCase(),
        name: z.string().trim().min(2).max(120),
        assetType: z.enum(["EQUITY", "BOND", "TREASURY_BOND", "COMMERCIAL_PAPER", "FUND", "OTHER"]),
        status: z.enum(["ACTIVE", "SUSPENDED", "DELISTED"]).default("ACTIVE"),
        tickSize: z.number().positive().max(1000).default(0.01),
        lotSize: z.number().int().positive().max(100000).default(1),
        description: z.string().trim().max(2000).optional(),
        issuerInfo: z.string().trim().max(2000).optional(),
        logoUrl: z.string().trim().url().max(500).optional(),
        isDemo: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);

    let marketId = data.marketId;
    if (!marketId) {
      const { data: market } = await db
        .from("exchange_markets")
        .select("id")
        .eq("code", "SQSX-PAPER")
        .maybeSingle();
      marketId = market?.id as string;
    }

    const payload = {
      market_id: marketId,
      symbol: data.symbol,
      name: data.name,
      asset_type: data.assetType,
      status: data.status,
      tick_size: data.tickSize,
      lot_size: data.lotSize,
      description: data.description ?? null,
      issuer_info: data.issuerInfo ?? null,
      logo_url: data.logoUrl ?? null,
      is_demo: data.isDemo,
      created_by: context.userId,
    };

    const query = data.id
      ? db.from("exchange_assets").update(payload).eq("id", data.id).select("id").maybeSingle()
      : db.from("exchange_assets").insert(payload).select("id").maybeSingle();

    const { data: row, error } = await query;
    if (error) throw new Error(error.message);

    await db.rpc("exchange_audit", {
      _user_id: context.userId,
      _action: data.id ? "asset_updated" : "asset_created",
      _entity: "exchange_assets",
      _entity_id: (row?.id as string) ?? null,
      _metadata: { symbol: data.symbol },
    });

    return { id: row?.id as string };
  });

export const adminCancelOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    const { error } = await db.rpc("exchange_cancel_order", {
      _user_id: context.userId,
      _order_id: data.orderId,
      _admin: true,
    });
    if (error) throw new Error(error.message);
    return { cancelled: true };
  });

export const updateFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        percent: z.number().min(0).max(0.5),
        fixed: z.number().min(0).max(100000),
        active: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    const { error } = await db
      .from("fee_configs")
      .update({ percent: data.percent, fixed: data.fixed, active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await db.rpc("exchange_audit", {
      _user_id: context.userId,
      _action: "admin_action",
      _entity: "fee_configs",
      _entity_id: data.id,
      _metadata: { percent: data.percent, fixed: data.fixed, active: data.active },
    });
    return { ok: true };
  });

export const updateRiskLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        maxOrderValue: z.number().positive().max(100_000_000),
        maxPositionValue: z.number().positive().max(1_000_000_000),
        maxDailyVolume: z.number().positive().max(1_000_000_000),
        maxOpenOrders: z.number().int().positive().max(1000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    const { error } = await db
      .from("risk_limits")
      .update({
        max_order_value: data.maxOrderValue,
        max_position_value: data.maxPositionValue,
        max_daily_volume: data.maxDailyVolume,
        max_open_orders: data.maxOpenOrders,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await db.rpc("exchange_audit", {
      _user_id: context.userId,
      _action: "admin_action",
      _entity: "risk_limits",
      _entity_id: data.id,
      _metadata: {},
    });
    return { ok: true };
  });
