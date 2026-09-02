import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Company = {
  id: string;
  slug: string;
  name: string;
  legalName: string | null;
  sector: string;
  description: string;
  headquarters: string | null;
  foundedYear: number | null;
  website: string | null;
  listedBvm: boolean;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  termMonths: number;
  targetRateAnnual: number;
  riskLevel: string;
  minAmount: number;
  capacity: number;
  raised: number;
  currency: string;
  status: string;
  company: { id: string; name: string; sector: string; slug: string } | null;
};

/** Lê empresas publicadas com a chave pública (política TO anon). */
export const listCompanies = createServerFn({ method: "GET" }).handler(async (): Promise<Company[]> => {
  const { publicClient } = await import("./public-client.server");
  const { data } = await publicClient()
    .from("companies")
    .select(
      "id, slug, name, legal_name, sector, description, headquarters, founded_year, website, listed_bvm",
    )
    .eq("status", "published")
    .order("name");

  return (data ?? []).map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    legalName: (row.legal_name as string | null) ?? null,
    sector: row.sector as string,
    description: row.description as string,
    headquarters: (row.headquarters as string | null) ?? null,
    foundedYear: (row.founded_year as number | null) ?? null,
    website: (row.website as string | null) ?? null,
    listedBvm: Boolean(row.listed_bvm),
  }));
});

/** Lê produtos de investimento abertos/fechados (dados declarados, nunca simulados). */
export const listProducts = createServerFn({ method: "GET" }).handler(async (): Promise<Product[]> => {
  const { publicClient } = await import("./public-client.server");
  const { data } = await publicClient()
    .from("investment_products")
    .select(
      "id, slug, name, description, term_months, target_rate_annual, risk_level, min_amount, capacity, raised, currency, status, companies(id, name, sector, slug)",
    )
    .order("target_rate_annual", { ascending: false });

  return (data ?? []).map((row) => {
    const company = row["companies"] as
      | { id: string; name: string; sector: string; slug: string }
      | null;
    return {
      id: row.id as string,
      slug: row.slug as string,
      name: row.name as string,
      description: row.description as string,
      termMonths: Number(row.term_months),
      targetRateAnnual: Number(row.target_rate_annual),
      riskLevel: row.risk_level as string,
      minAmount: Number(row.min_amount),
      capacity: Number(row.capacity),
      raised: Number(row.raised),
      currency: row.currency as string,
      status: row.status as string,
      company,
    };
  });
});

const applicationSchema = z.object({
  companyName: z.string().trim().min(2).max(160),
  nuit: z.string().trim().max(30).optional().or(z.literal("")),
  sector: z.string().trim().min(2).max(80),
  contactName: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email().max(255),
  contactPhone: z.string().trim().max(30).optional().or(z.literal("")),
  website: z.string().trim().max(255).optional().or(z.literal("")),
  fundingGoal: z.number().min(0).max(1_000_000_000).optional(),
  description: z.string().trim().min(30).max(2000),
});

/** Candidatura de empresa — gravada no servidor com validação e estado inicial "submitted". */
export const submitCompanyApplication = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => applicationSchema.parse(input))
  .handler(async ({ data }) => {
    const { publicClient } = await import("./public-client.server");
    // O id é gerado no servidor: a chave pública pode inserir, mas não ler
    // candidaturas (RETURNING seria bloqueado pelas políticas de leitura).
    const id = crypto.randomUUID();
    const { error } = await publicClient()
      .from("company_applications")
      .insert({
        id,
        company_name: data.companyName,
        nuit: data.nuit || null,
        sector: data.sector,
        contact_name: data.contactName,
        contact_email: data.contactEmail,
        contact_phone: data.contactPhone || null,
        website: data.website || null,
        funding_goal: data.fundingGoal ?? null,
        description: data.description,
      });

    if (error) throw new Error(error.message);
    return { id, status: "submitted", createdAt: new Date().toISOString() };
  });

export type PortfolioInvestment = {
  id: string;
  amount: number;
  targetRateAnnual: number;
  status: string;
  reference: string;
  maturesAt: string;
  createdAt: string;
  productName: string;
  companyName: string;
  termMonths: number;
};

export type Portfolio = {
  wallet: { id: string; balance: number; currency: string } | null;
  investments: PortfolioInvestment[];
  invested: number;
  ledger: { date: string; balance: number }[];
};

/** Carteira de investimentos + posições, sempre lidas no servidor. */
export const getPortfolio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Portfolio> => {
    const { supabase, userId } = context;

    const { data: wallet } = await supabase
      .from("wallets")
      .select("id, balance, currency")
      .eq("user_id", userId)
      .eq("kind", "investment")
      .maybeSingle();

    const { data: rows } = await supabase
      .from("investments")
      .select(
        "id, amount, target_rate_annual, status, reference, matures_at, created_at, investment_products(name, term_months, companies(name))",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    const investments: PortfolioInvestment[] = (rows ?? []).map((row) => {
      const product = row["investment_products"] as
        | { name: string; term_months: number; companies: { name: string } | null }
        | null;
      return {
        id: row.id as string,
        amount: Number(row.amount),
        targetRateAnnual: Number(row.target_rate_annual),
        status: row.status as string,
        reference: row.reference as string,
        maturesAt: row.matures_at as string,
        createdAt: row.created_at as string,
        productName: product?.name ?? "Produto",
        companyName: product?.companies?.name ?? "—",
        termMonths: Number(product?.term_months ?? 12),
      };
    });

    let ledger: { date: string; balance: number }[] = [];
    if (wallet) {
      const { data: tx } = await supabase
        .from("wallet_transactions")
        .select("created_at, balance_after")
        .eq("wallet_id", wallet.id)
        .order("created_at", { ascending: true })
        .limit(200);
      ledger = (tx ?? []).map((t) => ({
        date: t.created_at as string,
        balance: Number(t.balance_after),
      }));
    }

    return {
      wallet: wallet
        ? {
            id: wallet.id as string,
            balance: Number(wallet.balance),
            currency: wallet.currency as string,
          }
        : null,
      investments,
      invested: investments
        .filter((i) => i.status === "active")
        .reduce((sum, i) => sum + i.amount, 0),
      ledger,
    };
  });

/** Subscrição validada e liquidada no servidor (debita a carteira e registra no ledger). */
export const invest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ productId: z.string().uuid(), amount: z.number().positive().max(100_000_000) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.rpc("place_investment", {
      _user_id: context.userId,
      _product_id: data.productId,
      _amount: data.amount,
    });
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

/** Cancelamento devolve apenas o capital investido — não há rendimento garantido. */
export const cancelInvestment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ investmentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.rpc("cancel_investment", {
      _user_id: context.userId,
      _investment_id: data.investmentId,
    });
    if (error) throw new Error(error.message);
    return { status: (row as { status: string }).status };
  });

/** Move fundos entre as carteiras do próprio utilizador — os dois lados ficam no ledger. */
export const transferToInvestment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        amount: z.number().positive().max(100_000_000),
        direction: z.enum(["to_investment", "to_betting"]).default("to_investment"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: balance, error } = await supabaseAdmin.rpc("transfer_between_wallets", {
      _user_id: context.userId,
      _from_kind: data.direction === "to_investment" ? "betting" : "investment",
      _to_kind: data.direction === "to_investment" ? "investment" : "betting",
      _amount: data.amount,
    });
    if (error) throw new Error(error.message);
    return { balance: Number(balance) };
  });

/** Saldos das duas carteiras, lidos no servidor. */
export const getWalletBalances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("wallets")
      .select("kind, balance")
      .eq("user_id", context.userId);
    const find = (kind: string) =>
      Number((data ?? []).find((w) => w.kind === kind)?.balance ?? 0);
    return { betting: find("betting"), investment: find("investment") };
  });
