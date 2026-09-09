import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CompanyDataRow = {
  id: string;
  kind: string;
  title: string;
  summary: string | null;
  metrics: Record<string, string | number>;
  eventDate: string | null;
  sourceName: string;
  sourceUrl: string | null;
  confidence: number;
  status: string;
  provider: string;
  model: string | null;
  collectedAt: string;
};

function mapRow(r: Record<string, unknown>): CompanyDataRow {
  return {
    id: r["id"] as string,
    kind: r["kind"] as string,
    title: r["title"] as string,
    summary: (r["summary"] as string | null) ?? null,
    metrics: (r["metrics"] as Record<string, string | number>) ?? {},
    eventDate: (r["event_date"] as string | null) ?? null,
    sourceName: r["source_name"] as string,
    sourceUrl: (r["source_url"] as string | null) ?? null,
    confidence: Number(r["confidence"]),
    status: r["status"] as string,
    provider: r["provider"] as string,
    model: (r["model"] as string | null) ?? null,
    collectedAt: r["collected_at"] as string,
  };
}

const SELECT =
  "id, kind, title, summary, metrics, event_date, source_name, source_url, confidence, status, provider, model, collected_at";

/** Dados validados de uma empresa/instrumento (leitura pública). */
export const getCompanyData = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ assetId: z.string().uuid(), includeHistory: z.boolean().default(false) })
      .parse(input),
  )
  .handler(async ({ data }): Promise<CompanyDataRow[]> => {
    const { publicClient } = await import("@/lib/investments/public-client.server");
    const db = publicClient();
    const statuses = data.includeHistory ? ["approved", "superseded"] : ["approved"];
    const { data: rows } = await db
      .from("company_data_points")
      .select(SELECT)
      .eq("asset_id", data.assetId)
      .in("status", statuses)
      .order("collected_at", { ascending: false })
      .limit(60);
    return (rows ?? []).map((r) => mapRow(r as Record<string, unknown>));
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

export type AiSupervision = {
  job: {
    status: string;
    lastRunAt: string | null;
    lastSuccessAt: string | null;
    lastError: string | null;
    pausedReason: string | null;
    failureCount: number;
  } | null;
  pending: (CompanyDataRow & { symbol: string; assetId: string })[];
  approvedCount: number;
};

/** Supervisão da camada de inteligência: estado do trabalho e fila de validação. */
export const getAiSupervision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AiSupervision> => {
    const db = await requireAdmin(context);
    const [jobRes, pendingRes, approvedRes] = await Promise.all([
      db
        .from("ai_jobs")
        .select("status, last_run_at, last_success_at, last_error, paused_reason, failure_count")
        .eq("job_key", "company_data_refresh")
        .maybeSingle(),
      db
        .from("company_data_points")
        .select(`${SELECT}, asset_id, exchange_assets(symbol)`)
        .eq("status", "pending")
        .order("collected_at", { ascending: false })
        .limit(100),
      db.from("company_data_points").select("id", { count: "exact", head: true }).eq("status", "approved"),
    ]);

    return {
      job: jobRes.data
        ? {
            status: jobRes.data.status as string,
            lastRunAt: (jobRes.data.last_run_at as string | null) ?? null,
            lastSuccessAt: (jobRes.data.last_success_at as string | null) ?? null,
            lastError: (jobRes.data.last_error as string | null) ?? null,
            pausedReason: (jobRes.data.paused_reason as string | null) ?? null,
            failureCount: Number(jobRes.data.failure_count ?? 0),
          }
        : null,
      pending: (pendingRes.data ?? []).map((r) => {
        const row = r as Record<string, unknown>;
        return {
          ...mapRow(row),
          assetId: row["asset_id"] as string,
          symbol: (row["exchange_assets"] as { symbol: string } | null)?.symbol ?? "—",
        };
      }),
      approvedCount: approvedRes.count ?? 0,
    };
  });

/** Validação humana: aprovar ou recusar um dado proposto pela inteligência. */
export const reviewCompanyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        note: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    const { data: row, error } = await db
      .from("company_data_points")
      .update({
        status: data.decision,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        ...(data.note ? { validation_note: data.note } : {}),
      })
      .eq("id", data.id)
      .eq("status", "pending")
      .select("id, asset_id, kind")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Registo já validado ou inexistente.");

    if (data.decision === "approved") {
      await db
        .from("company_data_points")
        .update({ status: "superseded" })
        .eq("asset_id", row.asset_id as string)
        .eq("kind", row.kind as string)
        .eq("status", "approved")
        .neq("id", row.id as string);
    }

    await db.rpc("exchange_audit", {
      _user_id: context.userId,
      _action: `company_data_${data.decision}`,
      _entity: "company_data_points",
      _entity_id: data.id,
      _metadata: { kind: row.kind },
    });
    return { id: row.id as string, status: data.decision };
  });

/** Atualização manual de um instrumento (a pedido da administração). */
export const refreshCompanyDataNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ assetId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { refreshAssetData } = await import("./company-data.server");
    return refreshAssetData(data.assetId);
  });

/** Retoma o trabalho automático depois de uma pausa (créditos, chave, limites). */
export const resumeAiJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await requireAdmin(context);
    const { error } = await db
      .from("ai_jobs")
      .update({ status: "idle", paused_reason: null, last_error: null, failure_count: 0 })
      .eq("job_key", "company_data_refresh");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
