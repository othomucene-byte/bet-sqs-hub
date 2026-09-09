/** Helpers puros do SQs Exchange (sem acesso a rede nem estado). */

export const MZN = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "MZN",
  maximumFractionDigits: 2,
});

export const QTY = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 4 });

export function price(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Dados não disponíveis";
  return `${value.toFixed(2)} MZN`;
}

export function pct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export const ASSET_TYPE_LABEL: Record<string, string> = {
  EQUITY: "Ações",
  BOND: "Obrigações",
  TREASURY_BOND: "Obrigações do Tesouro",
  COMMERCIAL_PAPER: "Papel Comercial",
  FUND: "Fundos",
  OTHER: "Outros",
};

export const MARKET_STATUS_LABEL: Record<string, string> = {
  PRE_OPEN: "Pré-abertura",
  OPEN: "Aberto",
  PAUSED: "Em pausa",
  CLOSED: "Fechado",
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  OPEN: "No livro",
  PARTIALLY_FILLED: "Parcialmente executada",
  FILLED: "Executada",
  CANCELLED: "Cancelada",
  REJECTED: "Recusada",
  EXPIRED: "Expirada",
};

/** Custo estimado de uma ordem de compra, incluindo comissão. */
export function estimatedCost(quantity: number, unitPrice: number, feePct: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return 0;
  return Number((quantity * unitPrice * (1 + feePct)).toFixed(2));
}

/** Produto líquido de uma venda, descontada a comissão. */
export function netProceeds(quantity: number, unitPrice: number, feePct: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return 0;
  return Number((quantity * unitPrice * (1 - feePct)).toFixed(2));
}

export type Level = { side: "BUY" | "SELL"; price: number; quantity: number; orders: number };

/** Agrupa e ordena níveis do livro: compras do maior preço, vendas do menor. */
export function splitBook(levels: Level[]): { bids: Level[]; asks: Level[] } {
  const bids = levels
    .filter((l) => l.side === "BUY")
    .slice()
    .sort((a, b) => b.price - a.price);
  const asks = levels
    .filter((l) => l.side === "SELL")
    .slice()
    .sort((a, b) => a.price - b.price);
  return { bids, asks };
}

/** Quantidade que uma ordem a mercado consegue executar contra o livro. */
export function fillableQuantity(levels: Level[], side: "BUY" | "SELL", quantity: number): number {
  const { bids, asks } = splitBook(levels);
  const book = side === "BUY" ? asks : bids;
  let left = quantity;
  let filled = 0;
  for (const level of book) {
    if (left <= 0) break;
    const take = Math.min(left, level.quantity);
    filled += take;
    left -= take;
  }
  return Number(filled.toFixed(4));
}

/** Lucro/prejuízo não realizado de uma posição. */
export function positionPnl(
  quantity: number,
  avgPrice: number,
  lastPrice: number | null,
): { value: number | null; pct: number | null } {
  if (lastPrice == null || quantity <= 0) return { value: null, pct: null };
  const cost = quantity * avgPrice;
  const value = quantity * lastPrice - cost;
  return {
    value: Number(value.toFixed(2)),
    pct: cost > 0 ? Number(((value / cost) * 100).toFixed(2)) : null,
  };
}
