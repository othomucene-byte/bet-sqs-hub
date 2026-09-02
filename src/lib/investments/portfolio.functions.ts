import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PositionRow = {
  productId: string;
  productName: string;
  companyName: string;
  investedAmount: number;
  currentValue: number;
  realizedResult: number;
  unrealizedResult: number;
};

export type ReturnRow = {
  id: string;
  kind: "PROFIT" | "LOSS";
  amount: number;
  periodStart: string | null;
  periodEnd: string | null;
  settled: boolean;
  createdAt: string;
  productName: string | null;
};

export type HoldingRow = {
  id: string;
  productId: string;
  productName: string;
  companyName: string;
  amount: number;
  accruedReturn: number;
  targetRateAnnual: number;
  status: string;
  reference: string;
  maturesAt: string;
  createdAt: string;
};

export type InvestorOverview = {
  kycStatus: string;
  wallet: { id: string; balance: number; currency: string } | null;
  bettingBalance: number;
  invested: number;
  currentValue: number;
  result: number;
  pendingOrders: number;
  holdings: HoldingRow[];
  positions: PositionRow[];
  returns: ReturnRow[];
  ledger: { date: string; balance: number }[];
  unread: number;
};

/** Visão global do investidor: tudo lido no servidor, nada calculado como autoridade no cliente. */
export const getInvestorOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InvestorOverview> => {
    const { supabase, userId } = context;

    const [kycRes, walletsRes, holdingsRes, positionsRes, returnsRes, ordersRes, notifRes] =
      await Promise.all([
        supabase.from("kyc_profiles").select("status").eq("user_id", userId).maybeSingle(),
        supabase.from("wallets").select("id, kind, balance, currency").eq("user_id", userId),
        supabase
          .from("investments")
          .select(
            "id, product_id, amount, accrued_return, target_rate_annual, status, reference, matures_at, created_at, investment_products(name, companies(name))",
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("investment_positions")
          .select(
            "product_id, invested_amount, current_value, realized_result, unrealized_result, investment_products(name, companies(name))",
          )
          .eq("user_id", userId),
        supabase
          .from("investment_returns")
          .select(
            "id, kind, amount, period_start, period_end, settled, created_at, investment_products(name)",
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("investment_orders")
          .select("id, status")
          .eq("user_id", userId)
          .in("status", ["PENDING", "PROCESSING"]),
        supabase
          .from("notifications")
          .select("id")
          .eq("user_id", userId)
          .is("read_at", null),
      ]);

    const wallets = walletsRes.data ?? [];
    const investmentWallet = wallets.find((w) => w.kind === "investment") ?? null;
    const bettingWallet = wallets.find((w) => w.kind === "betting") ?? null;

    const holdings: HoldingRow[] = (holdingsRes.data ?? []).map((row) => {
      const product = row.investment_products as
        | { name: string; companies: { name: string } | null }
        | null;
      return {
        id: row.id,
        productId: row.product_id,
        productName: product?.name ?? "Produto",
        companyName: product?.companies?.name ?? "—",
        amount: Number(row.amount),
        accruedReturn: Number(row.accrued_return ?? 0),
        targetRateAnnual: Number(row.target_rate_annual),
        status: row.status,
        reference: row.reference,
        maturesAt: row.matures_at,
        createdAt: row.created_at,
      };
    });

    const positions: PositionRow[] = (positionsRes.data ?? []).map((row) => {
      const product = row.investment_products as
        | { name: string; companies: { name: string } | null }
        | null;
      return {
        productId: row.product_id,
        productName: product?.name ?? "Produto",
        companyName: product?.companies?.name ?? "—",
        investedAmount: Number(row.invested_amount),
        currentValue: Number(row.current_value),
        realizedResult: Number(row.realized_result),
        unrealizedResult: Number(row.unrealized_result),
      };
    });

    const returns: ReturnRow[] = (returnsRes.data ?? []).map((row) => {
      const product = row.investment_products as { name: string } | null;
      return {
        id: row.id,
        kind: row.kind as "PROFIT" | "LOSS",
        amount: Number(row.amount),
        periodStart: row.period_start,
        periodEnd: row.period_end,
        settled: row.settled,
        createdAt: row.created_at,
        productName: product?.name ?? null,
      };
    });

    let ledger: { date: string; balance: number }[] = [];
    if (investmentWallet) {
      const { data: tx } = await supabase
        .from("wallet_transactions")
        .select("created_at, balance_after")
        .eq("wallet_id", investmentWallet.id)
        .order("created_at", { ascending: true })
        .limit(200);
      ledger = (tx ?? []).map((t) => ({
        date: t.created_at,
        balance: Number(t.balance_after),
      }));
    }

    const invested = positions.reduce((sum, p) => sum + p.investedAmount, 0);
    const currentValue = positions.reduce((sum, p) => sum + p.currentValue, 0);

    return {
      kycStatus: kycRes.data?.status ?? "not_started",
      wallet: investmentWallet
        ? {
            id: investmentWallet.id,
            balance: Number(investmentWallet.balance),
            currency: investmentWallet.currency,
          }
        : null,
      bettingBalance: bettingWallet ? Number(bettingWallet.balance) : 0,
      invested,
      currentValue,
      result: positions.reduce((sum, p) => sum + p.realizedResult + p.unrealizedResult, 0),
      pendingOrders: (ordersRes.data ?? []).length,
      holdings,
      positions,
      returns,
      ledger,
      unread: (notifRes.data ?? []).length,
    };
  });

/** Extrato do ledger da carteira de investimentos. */
export const getInvestmentStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(200).default(100) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: wallet } = await context.supabase
      .from("wallets")
      .select("id")
      .eq("user_id", context.userId)
      .eq("kind", "investment")
      .maybeSingle();

    if (!wallet) return [];

    const { data: rows } = await context.supabase
      .from("wallet_transactions")
      .select("id, type, amount, balance_after, reference, status, created_at")
      .eq("wallet_id", wallet.id)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    return (rows ?? []).map((row) => ({
      id: row.id,
      type: row.type,
      amount: Number(row.amount),
      balanceAfter: Number(row.balance_after),
      reference: row.reference,
      status: row.status,
      createdAt: row.created_at,
    }));
  });

/** Notificações do utilizador. */
export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("notifications")
      .select("id, category, title, body, read_at, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);

    return (data ?? []).map((row) => ({
      id: row.id,
      category: row.category,
      title: row.title,
      body: row.body,
      readAt: row.read_at,
      createdAt: row.created_at,
    }));
  });

/** Marca notificações como lidas (apenas as do próprio utilizador, por RLS). */
export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).max(100).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("read_at", null);

    if (data.ids && data.ids.length > 0) query = query.in("id", data.ids);

    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });
