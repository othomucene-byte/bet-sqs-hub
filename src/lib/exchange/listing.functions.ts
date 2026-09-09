import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ListingApplicationRow = {
  id: string;
  companyName: string;
  proposedSymbol: string;
  assetType: string;
  sector: string | null;
  description: string | null;
  website: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  sharesOffered: number | null;
  referencePrice: number | null;
  status: string;
  decisionNote: string | null;
  assetId: string | null;
  createdAt: string;
};

function mapRow(r: Record<string, unknown>): ListingApplicationRow {
  return {
    id: r["id"] as string,
    companyName: r["company_name"] as string,
    proposedSymbol: r["proposed_symbol"] as string,
    assetType: r["asset_type"] as string,
    sector: (r["sector"] as string | null) ?? null,
    description: (r["description"] as string | null) ?? null,
    website: (r["website"] as string | null) ?? null,
    contactEmail: (r["contact_email"] as string | null) ?? null,
    contactPhone: (r["contact_phone"] as string | null) ?? null,
    sharesOffered: r["shares_offered"] == null ? null : Number(r["shares_offered"]),
    referencePrice: r["reference_price"] == null ? null : Number(r["reference_price"]),
    status: r["status"] as string,
    decisionNote: (r["decision_note"] as string | null) ?? null,
    assetId: (r["asset_id"] as string | null) ?? null,
    createdAt: r["created_at"] as string,
  };
}

const SELECT =
  "id, company_name, proposed_symbol, asset_type, sector, description, website, contact_email, contact_phone, shares_offered, reference_price, status, decision_note, asset_id, created_at";

const ASSET_TYPES = [
  "EQUITY",
  "BOND",
  "TREASURY_BOND",
  "COMMERCIAL_PAPER",
  "FUND",
  "OTHER",
] as const;

/** Candidatura de uma empresa à listagem no mercado. A decisão é da administração. */
export const submitListingApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        companyName: z.string().trim().min(2).max(160),
        proposedSymbol: z
          .string()
          .trim()
          .min(2)
          .max(12)
          .regex(/^[A-Za-z0-9.]+$/, "Use apenas letras, números e ponto"),
        assetType: z.enum(ASSET_TYPES),
        sector: z.string().trim().max(120).optional(),
        description: z.string().trim().max(4000).optional(),
        website: z.string().trim().url().max(300).optional(),
        contactEmail: z.string().trim().email().max(200),
        contactPhone: z.string().trim().max(40).optional(),
        sharesOffered: z.number().positive().max(1e12).nullable().default(null),
        referencePrice: z.number().positive().max(1e9).nullable().default(null),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("exchange_listing_applications").insert({
      user_id: context.userId,
      company_name: data.companyName,
      proposed_symbol: data.proposedSymbol.toUpperCase(),
      asset_type: data.assetType,
      sector: data.sector ?? null,
      description: data.description ?? null,
      website: data.website ?? null,
      contact_email: data.contactEmail,
      contact_phone: data.contactPhone ?? null,
      shares_offered: data.sharesOffered,
      reference_price: data.referencePrice,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyListingApplications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ListingApplicationRow[]> => {
    const { data } = await context.supabase
      .from("exchange_listing_applications")
      .select(SELECT)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  });

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

export const listListingApplications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ListingApplicationRow[]> => {
    const db = await requireAdmin(context);
    const { data } = await db
      .from("exchange_listing_applications")
      .select(SELECT)
      .order("created_at", { ascending: false })
      .limit(200);
    return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  });

/**
 * Decisão da administração. Ao aprovar, o instrumento é criado no mercado real
 * (dinheiro real) com lote e passo de preço definidos pela administração.
 */
export const decideListingApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approved", "rejected", "under_review"]),
        note: z.string().trim().max(500).optional(),
        tickSize: z.number().positive().max(1000).default(0.01),
        lotSize: z.number().int().positive().max(100000).default(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);

    const { data: app, error } = await db
      .from("exchange_listing_applications")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!app) throw new Error("Candidatura inexistente");

    let assetId = (app.asset_id as string | null) ?? null;

    if (data.decision === "approved" && !assetId) {
      const { data: market, error: mErr } = await db
        .from("exchange_markets")
        .select("id")
        .eq("code", "SQSX-LIVE")
        .maybeSingle();
      if (mErr) throw new Error(mErr.message);
      if (!market) throw new Error("Mercado real não configurado");

      const { data: asset, error: aErr } = await db
        .from("exchange_assets")
        .insert({
          market_id: market.id as string,
          company_id: (app.company_id as string | null) ?? null,
          symbol: (app.proposed_symbol as string).toUpperCase(),
          name: app.company_name as string,
          asset_type: app.asset_type as string,
          status: "ACTIVE",
          tick_size: data.tickSize,
          lot_size: data.lotSize,
          description: (app.description as string | null) ?? null,
          issuer_info: (app.website as string | null) ?? null,
          is_demo: false,
          environment: "LIVE",
          created_by: context.userId,
        })
        .select("id")
        .maybeSingle();
      if (aErr) throw new Error(aErr.message);
      assetId = (asset?.id as string) ?? null;

      if (assetId) {
        await db.from("market_data").upsert({ asset_id: assetId }, { onConflict: "asset_id" });
      }
    }

    const { error: uErr } = await db
      .from("exchange_listing_applications")
      .update({
        status: data.decision,
        decision_note: data.note ?? null,
        decided_by: context.userId,
        decided_at: new Date().toISOString(),
        ...(assetId ? { asset_id: assetId } : {}),
      })
      .eq("id", data.id);
    if (uErr) throw new Error(uErr.message);

    await db.rpc("exchange_audit", {
      _user_id: context.userId,
      _action: `listing_${data.decision}`,
      _entity: "exchange_listing_applications",
      _entity_id: data.id,
      _metadata: { symbol: app.proposed_symbol, assetId },
    });

    return { id: data.id, status: data.decision, assetId };
  });
