import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { requireSupabaseAuth as Middleware } from "@/integrations/supabase/auth-middleware";

type AuthedContext = {
  supabase: Awaited<ReturnType<typeof Middleware>> extends never ? never : any;
  userId: string;
};

/** Confirma no servidor que o utilizador tem papel de admin antes de qualquer leitura privilegiada. */
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type AdminOverview = {
  users: number;
  kycPending: number;
  investedTotal: number;
  ordersPending: number;
  depositsCompleted: number;
  withdrawalsPending: number;
  walletsBalance: number;
  betsToday: number;
};

/** Indicadores agregados do backoffice. */
export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOverview> => {
    const admin = await assertAdmin(context as unknown as AuthedContext);

    const [profiles, kyc, investments, orders, deposits, withdrawals, wallets, bets] =
      await Promise.all([
        admin.from("profiles").select("id", { count: "exact", head: true }),
        admin
          .from("kyc_profiles")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        admin.from("investments").select("amount, status"),
        admin
          .from("investment_orders")
          .select("id", { count: "exact", head: true })
          .in("status", ["PENDING", "PROCESSING"]),
        admin
          .from("payment_intents")
          .select("id", { count: "exact", head: true })
          .eq("direction", "deposit")
          .eq("status", "completed"),
        admin
          .from("payment_intents")
          .select("id", { count: "exact", head: true })
          .eq("direction", "withdrawal")
          .in("status", ["pending", "processing"]),
        admin.from("wallets").select("balance"),
        admin
          .from("game_bets")
          .select("id", { count: "exact", head: true })
          .gte("placed_at", new Date(Date.now() - 86_400_000).toISOString()),
      ]);

    return {
      users: profiles.count ?? 0,
      kycPending: kyc.count ?? 0,
      investedTotal: (investments.data ?? [])
        .filter((i: { status: string }) => i.status === "active")
        .reduce((sum: number, i: { amount: number }) => sum + Number(i.amount), 0),
      ordersPending: orders.count ?? 0,
      depositsCompleted: deposits.count ?? 0,
      withdrawalsPending: withdrawals.count ?? 0,
      walletsBalance: (wallets.data ?? []).reduce(
        (sum: number, w: { balance: number }) => sum + Number(w.balance),
        0,
      ),
      betsToday: bets.count ?? 0,
    };
  });

/** Fila de KYC para revisão. */
export const listKycQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ status: z.enum(["pending", "approved", "rejected", "all"]).default("pending") })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as unknown as AuthedContext);
    let query = admin
      .from("kyc_profiles")
      .select(
        "id, user_id, full_name, document_type, document_number, province, risk_profile, status, review_notes, created_at",
      )
      .order("created_at", { ascending: true })
      .limit(200);
    if (data.status !== "all") query = query.eq("status", data.status);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      userId: row.user_id as string,
      fullName: row.full_name as string,
      documentType: row.document_type as string,
      documentNumber: row.document_number as string,
      province: (row.province as string | null) ?? null,
      riskProfile: row.risk_profile as string,
      status: row.status as string,
      reviewNotes: (row.review_notes as string | null) ?? null,
      createdAt: row.created_at as string,
    }));
  });

/** Decisão de KYC pelo backoffice. */
export const decideKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        kycId: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        notes: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as unknown as AuthedContext);

    const { data: row, error } = await admin
      .from("kyc_profiles")
      .update({
        status: data.decision,
        review_notes: data.notes ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.kycId)
      .select("user_id, status")
      .single();
    if (error) throw new Error(error.message);

    await admin.from("notifications").insert({
      user_id: row.user_id,
      category: "kyc",
      title: data.decision === "approved" ? "KYC aprovado" : "KYC recusado",
      body:
        data.decision === "approved"
          ? "A tua verificação de identidade foi aprovada. Já podes subscrever produtos."
          : data.notes || "A tua verificação de identidade foi recusada. Revê os dados enviados.",
    });

    return { status: row.status as string };
  });

/** Ordens de investimento de todos os clientes. */
export const listAllOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context as unknown as AuthedContext);
    const { data, error } = await admin
      .from("investment_orders")
      .select(
        "id, user_id, side, amount, executed_amount, status, reference, created_at, investment_products(name)",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: Record<string, any>) => ({
      id: row.id as string,
      userId: row.user_id as string,
      side: row.side as string,
      amount: Number(row.amount),
      executedAmount: Number(row.executed_amount),
      status: row.status as string,
      reference: row.reference as string,
      createdAt: row.created_at as string,
      productName: (row.investment_products?.name as string | undefined) ?? null,
    }));
  });

/** Investimentos activos por cliente, para lançar resultados. */
export const listAllInvestments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context as unknown as AuthedContext);
    const { data, error } = await admin
      .from("investments")
      .select(
        "id, user_id, amount, accrued_return, status, reference, matures_at, created_at, investment_products(name)",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: Record<string, any>) => ({
      id: row.id as string,
      userId: row.user_id as string,
      amount: Number(row.amount),
      accruedReturn: Number(row.accrued_return ?? 0),
      status: row.status as string,
      reference: row.reference as string,
      maturesAt: row.matures_at as string,
      createdAt: row.created_at as string,
      productName: (row.investment_products?.name as string | undefined) ?? null,
    }));
  });

/** Lançamento de rendimento/prejuízo declarado num investimento. */
export const postReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        investmentId: z.string().uuid(),
        kind: z.enum(["PROFIT", "LOSS"]),
        amount: z.number().positive().max(100_000_000),
        reference: z.string().trim().min(6).max(80),
        periodStart: z.string().trim().max(10).optional(),
        periodEnd: z.string().trim().max(10).optional(),
        settle: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as unknown as AuthedContext);
    const { data: row, error } = await admin.rpc("post_investment_return", {
      _investment_id: data.investmentId,
      _kind: data.kind,
      _amount: data.amount,
      _reference: data.reference,
      _period_start: data.periodStart || null,
      _period_end: data.periodEnd || null,
      _settle: data.settle,
    });
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

/** Pagamentos (depósitos e levantamentos) para reconciliação. */
export const listPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context as unknown as AuthedContext);
    const { data, error } = await admin
      .from("payment_intents")
      .select(
        "id, user_id, direction, method, amount, currency, status, reference, provider_transaction_id, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      userId: row.user_id as string,
      direction: row.direction as string,
      method: row.method as string,
      amount: Number(row.amount),
      currency: row.currency as string,
      status: row.status as string,
      reference: row.reference as string,
      providerTransactionId: (row.provider_transaction_id as string | null) ?? null,
      createdAt: row.created_at as string,
    }));
  });

/** Sinais de risco: movimentos elevados no ledger nas últimas 48h. */
export const listRiskSignals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context as unknown as AuthedContext);
    const since = new Date(Date.now() - 48 * 3_600_000).toISOString();
    const { data, error } = await admin
      .from("wallet_transactions")
      .select("id, wallet_id, type, amount, balance_after, reference, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? [])
      .map((row: Record<string, unknown>) => ({
        id: row.id as string,
        walletId: row.wallet_id as string,
        type: row.type as string,
        amount: Number(row.amount),
        balanceAfter: Number(row.balance_after),
        reference: row.reference as string,
        createdAt: row.created_at as string,
      }))
      .filter((row) => Math.abs(row.amount) >= 25_000);
  });

/** Candidaturas de empresas submetidas no site. */
export const listApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context as unknown as AuthedContext);
    const { data, error } = await admin
      .from("company_applications")
      .select(
        "id, company_name, sector, contact_name, contact_email, contact_phone, funding_goal, status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      companyName: row.company_name as string,
      sector: row.sector as string,
      contactName: row.contact_name as string,
      contactEmail: row.contact_email as string,
      contactPhone: (row.contact_phone as string | null) ?? null,
      fundingGoal: row.funding_goal ? Number(row.funding_goal) : null,
      status: row.status as string,
      createdAt: row.created_at as string,
    }));
  });

/** Indica se o utilizador actual é admin (usado apenas para mostrar/esconder navegação). */
export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { admin: Boolean(data) };
  });
