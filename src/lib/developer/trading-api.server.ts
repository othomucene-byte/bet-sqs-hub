/**
 * API de negociação para developers.
 *
 * Toda a validação, reserva de fundos e cruzamento continua a acontecer no
 * PostgreSQL (exchange_create_order / exchange_cancel_order). Esta camada só
 * traduz pedidos HTTP autenticados em chamadas ao motor, com idempotência
 * obrigatória. A credencial define o ambiente: SANDBOX negocia em simulação,
 * LIVE negocia com dinheiro real da conta de mercado.
 */

type Environment = "PAPER" | "LIVE";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function adapterFor(environment: Environment) {
  const { getExchangeAdapter } = await import("@/lib/exchange/adapters.server");
  return getExchangeAdapter(environment);
}

export async function apiAccount(userId: string, environment: Environment) {
  const { PaperTradingAdapter } = await import("@/lib/exchange/adapters.server");
  const account = await new PaperTradingAdapter(environment).getAccount(userId);
  const db = await admin();
  const { data: positions } = await db
    .from("positions")
    .select("quantity, reserved_quantity, avg_price, realized_pnl, exchange_assets(symbol, name)")
    .eq("account_id", account.accountId)
    .gt("quantity", 0);

  return {
    environment,
    currency: account.currency,
    available: account.available,
    reserved: account.reserved,
    positions: (positions ?? []).map((row) => {
      const asset = row.exchange_assets as { symbol: string; name: string } | null;
      return {
        symbol: asset?.symbol ?? null,
        name: asset?.name ?? null,
        quantity: Number(row.quantity),
        reserved_quantity: Number(row.reserved_quantity),
        avg_price: Number(row.avg_price),
        realized_pnl: Number(row.realized_pnl),
      };
    }),
  };
}

export async function apiOrders(userId: string, environment: Environment, limit: number) {
  const db = await admin();
  const { data } = await db
    .from("exchange_orders")
    .select(
      "id, side, order_type, quantity, filled_quantity, remaining_quantity, limit_price, avg_fill_price, status, reserved_amount, created_at, exchange_assets(symbol)",
    )
    .eq("user_id", userId)
    .eq("environment", environment)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    symbol: (row.exchange_assets as { symbol: string } | null)?.symbol ?? null,
    side: row.side as string,
    order_type: row.order_type as string,
    quantity: Number(row.quantity),
    filled_quantity: Number(row.filled_quantity),
    remaining_quantity: Number(row.remaining_quantity),
    limit_price: row.limit_price == null ? null : Number(row.limit_price),
    avg_fill_price: row.avg_fill_price == null ? null : Number(row.avg_fill_price),
    status: row.status as string,
    reserved_amount: Number(row.reserved_amount),
    created_at: row.created_at as string,
  }));
}

export async function apiOrder(userId: string, environment: Environment, orderId: string) {
  const orders = await apiOrders(userId, environment, 200);
  return orders.find((order) => order.id === orderId) ?? null;
}

export async function apiTrades(userId: string, environment: Environment, limit: number) {
  const db = await admin();
  const { data } = await db
    .from("trades")
    .select(
      "id, price, quantity, gross_value, buyer_fee, seller_fee, buyer_id, seller_id, settlement_status, executed_at, exchange_assets(symbol)",
    )
    .eq("environment", environment)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order("executed_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => {
    const isBuyer = row.buyer_id === userId;
    return {
      id: row.id as string,
      symbol: (row.exchange_assets as { symbol: string } | null)?.symbol ?? null,
      side: isBuyer ? "BUY" : "SELL",
      price: Number(row.price),
      quantity: Number(row.quantity),
      gross_value: Number(row.gross_value),
      fee: Number(isBuyer ? row.buyer_fee : row.seller_fee),
      settlement_status: row.settlement_status as string,
      executed_at: row.executed_at as string,
    };
  });
}

export type PlaceOrderInput = {
  symbol: string;
  side: "BUY" | "SELL";
  order_type: "MARKET" | "LIMIT";
  quantity: number;
  limit_price?: number | null | undefined;
  idempotency_key: string;
};

export async function apiPlaceOrder(
  userId: string,
  environment: Environment,
  input: PlaceOrderInput,
  callerEnvironment: "SANDBOX" | "LIVE",
): Promise<{ error: string; status: number } | { order: Record<string, unknown> }> {
  const { findAsset } = await import("./market-api.server");
  const asset = await findAsset(input.symbol, environment);
  if (!asset) return { error: "Instrumento não encontrado." as const, status: 404 };

  const adapter = await adapterFor(environment);
  const order = await adapter.submitOrder({
    userId,
    assetId: asset.id,
    side: input.side,
    orderType: input.order_type,
    quantity: input.quantity,
    limitPrice: input.order_type === "LIMIT" ? (input.limit_price ?? null) : null,
    idempotencyKey: input.idempotency_key,
    environment,
  });

  const { enqueueWebhookEvent } = await import("./webhooks.server");
  await enqueueWebhookEvent({
    userId,
    event: "order.updated",
    environment: callerEnvironment,
    payload: {
      order_id: order.id,
      symbol: asset.symbol,
      status: order.status,
      filled_quantity: order.filledQuantity,
      remaining_quantity: order.remainingQuantity,
      avg_fill_price: order.avgFillPrice,
    },
  });
  if (order.filledQuantity > 0) {
    await enqueueWebhookEvent({
      userId,
      event: "trade.executed",
      environment: callerEnvironment,
      payload: {
        order_id: order.id,
        symbol: asset.symbol,
        quantity: order.filledQuantity,
        avg_fill_price: order.avgFillPrice,
      },
    });
  }

  return {
    order: {
      id: order.id,
      symbol: asset.symbol,
      status: order.status,
      filled_quantity: order.filledQuantity,
      remaining_quantity: order.remainingQuantity,
      avg_fill_price: order.avgFillPrice,
      environment,
    },
  };
}

export async function apiCancelOrder(
  userId: string,
  environment: Environment,
  orderId: string,
  callerEnvironment: "SANDBOX" | "LIVE",
) {
  const adapter = await adapterFor(environment);
  const order = await adapter.cancelOrder(userId, orderId);
  const { enqueueWebhookEvent } = await import("./webhooks.server");
  await enqueueWebhookEvent({
    userId,
    event: "order.updated",
    environment: callerEnvironment,
    payload: { order_id: order.id, status: order.status },
  });
  return {
    id: order.id,
    status: order.status,
    filled_quantity: order.filledQuantity,
    remaining_quantity: order.remainingQuantity,
  };
}
