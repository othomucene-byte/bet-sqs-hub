/**
 * Arquitetura de integração do SQs Exchange.
 *
 * Todo o encaminhamento de ordens passa por um ExchangeAdapter. Hoje existe
 * apenas o PaperTradingAdapter (ambiente de SIMULAÇÃO, cruzamento interno no
 * PostgreSQL). O BvmExchangeAdapter existe como ponto de integração futura e
 * falha explicitamente enquanto não houver operador/corretora autorizada, com
 * credenciais e API oficial — nunca finge ligação a nenhuma bolsa.
 */

export type ExchangeEnvironment = "PAPER" | "LIVE";

export type SubmitOrderInput = {
  userId: string;
  assetId: string;
  side: "BUY" | "SELL";
  orderType: "MARKET" | "LIMIT";
  quantity: number;
  limitPrice: number | null;
  idempotencyKey: string;
  environment: ExchangeEnvironment;
};

export type AdapterOrder = {
  id: string;
  status: string;
  filledQuantity: number;
  remainingQuantity: number;
  avgFillPrice: number | null;
};

export interface ExchangeAdapter {
  readonly name: string;
  readonly environment: ExchangeEnvironment;
  submitOrder(input: SubmitOrderInput): Promise<AdapterOrder>;
  cancelOrder(userId: string, orderId: string, admin?: boolean): Promise<AdapterOrder>;
  getOrderStatus(userId: string, orderId: string): Promise<AdapterOrder | null>;
  getPositions(userId: string): Promise<
    { assetId: string; quantity: number; reservedQuantity: number; avgPrice: number }[]
  >;
  getAccount(userId: string): Promise<{
    accountId: string;
    available: number;
    reserved: number;
    securities: number;
    currency: string;
  }>;
  settleTrade(tradeId: string): Promise<{ tradeId: string; settlementStatus: string }>;
}

type OrderRow = {
  id: string;
  status: string;
  filled_quantity: number | string;
  remaining_quantity: number | string;
  avg_fill_price: number | string | null;
};

function toAdapterOrder(row: OrderRow): AdapterOrder {
  return {
    id: row.id,
    status: row.status,
    filledQuantity: Number(row.filled_quantity),
    remainingQuantity: Number(row.remaining_quantity),
    avgFillPrice: row.avg_fill_price === null ? null : Number(row.avg_fill_price),
  };
}

/**
 * Motor de mercado da própria plataforma: order engine, matching engine, livro,
 * trades e liquidação correm no PostgreSQL da Betfcom SQs. Serve tanto o
 * ambiente de testes (PAPER) como o mercado real (LIVE).
 */
export class SqsMarketAdapter implements ExchangeAdapter {
  readonly name = "SqsMarketAdapter";
  readonly environment: ExchangeEnvironment = "PAPER";

  constructor(environment: ExchangeEnvironment = "PAPER") {
    this.environment = environment;
  }


  private async admin() {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return supabaseAdmin;
  }

  async submitOrder(input: SubmitOrderInput): Promise<AdapterOrder> {
    const db = await this.admin();
    const { data, error } = await db.rpc("exchange_create_order", {
      _user_id: input.userId,
      _asset_id: input.assetId,
      _side: input.side,
      _order_type: input.orderType,
      _quantity: input.quantity,
      _limit_price: input.limitPrice as number,
      _idempotency_key: input.idempotencyKey,
      _env: input.environment,
    });
    if (error) throw new Error(error.message);
    return toAdapterOrder(data as unknown as OrderRow);
  }

  async cancelOrder(userId: string, orderId: string, admin = false): Promise<AdapterOrder> {
    const db = await this.admin();
    const { data, error } = await db.rpc("exchange_cancel_order", {
      _user_id: userId,
      _order_id: orderId,
      _admin: admin,
    });
    if (error) throw new Error(error.message);
    return toAdapterOrder(data as unknown as OrderRow);
  }

  async getOrderStatus(userId: string, orderId: string): Promise<AdapterOrder | null> {
    const db = await this.admin();
    const { data } = await db
      .from("exchange_orders")
      .select("id, status, filled_quantity, remaining_quantity, avg_fill_price")
      .eq("id", orderId)
      .eq("user_id", userId)
      .maybeSingle();
    return data ? toAdapterOrder(data as unknown as OrderRow) : null;
  }

  async getPositions(userId: string) {
    const db = await this.admin();
    const accountId = await this.accountId(userId);
    const { data } = await db
      .from("positions")
      .select("asset_id, quantity, reserved_quantity, avg_price")
      .eq("account_id", accountId);
    return (data ?? []).map((row) => ({
      assetId: row.asset_id as string,
      quantity: Number(row.quantity),
      reservedQuantity: Number(row.reserved_quantity),
      avgPrice: Number(row.avg_price),
    }));
  }

  async accountId(userId: string): Promise<string> {
    const db = await this.admin();
    const { data, error } = await db.rpc("exchange_ensure_account", {
      _user_id: userId,
      _env: this.environment,
    });
    if (error) throw new Error(error.message);
    return data as unknown as string;
  }

  async getAccount(userId: string) {
    const db = await this.admin();
    const accountId = await this.accountId(userId);
    const { data, error } = await db.rpc("exchange_cash", { _account_id: accountId });
    if (error) throw new Error(error.message);
    const row = (Array.isArray(data) ? data[0] : data) as
      | { available: number | string; reserved: number | string; securities: number | string }
      | undefined;
    return {
      accountId,
      available: Number(row?.available ?? 0),
      reserved: Number(row?.reserved ?? 0),
      securities: Number(row?.securities ?? 0),
      currency: "MZN",
    };
  }

  async settleTrade(tradeId: string) {
    // Em simulação a liquidação é instantânea no próprio cruzamento.
    const db = await this.admin();
    const { data } = await db
      .from("trades")
      .select("id, settlement_status")
      .eq("id", tradeId)
      .maybeSingle();
    return {
      tradeId,
      settlementStatus: (data?.settlement_status as string) ?? "UNKNOWN",
    };
  }
}

export class BvmExchangeAdapter implements ExchangeAdapter {
  readonly name = "BvmExchangeAdapter";
  readonly environment: ExchangeEnvironment = "LIVE";

  private pending(): never {
    throw new Error(
      "Integração com operador/corretora autorizada pendente: sem credenciais e API oficial não são enviadas ordens reais.",
    );
  }

  submitOrder(): Promise<AdapterOrder> {
    this.pending();
  }
  cancelOrder(): Promise<AdapterOrder> {
    this.pending();
  }
  getOrderStatus(): Promise<AdapterOrder | null> {
    this.pending();
  }
  getPositions(): Promise<never[]> {
    this.pending();
  }
  getAccount(): Promise<never> {
    this.pending();
  }
  settleTrade(): Promise<never> {
    this.pending();
  }
}

/** LIVE só é servido por adaptador oficial quando existir; por omissão é PAPER. */
export function getExchangeAdapter(environment: ExchangeEnvironment = "PAPER"): ExchangeAdapter {
  if (environment === "LIVE") {
    if (process.env["EXCHANGE_LIVE_ADAPTER"] === "BVM") return new BvmExchangeAdapter();
    // Sem operador configurado, a conta LIVE existe mas não encaminha ordens.
    return new BvmExchangeAdapter();
  }
  return new PaperTradingAdapter("PAPER");
}
