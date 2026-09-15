/**
 * Configuração e supervisão do agente de pesquisa da IA.
 *
 * Leitura pública: intervalo, estado e histórico das execuções (sem dados pessoais).
 * Escrita: só administração.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const AGENT_JOB_KEY = "company_data_refresh";

export type AgentRun = {
  id: string;
  runId: string;
  symbol: string | null;
  trigger: string;
  status: string;
  inserted: number;
  approved: number;
  pending: number;
  conflicts: number;
  skipped: number;
  sources: Array<{ title: string; url: string; domain: string }>;
  changes: Array<{ kind: string; title: string; change: string; status: string; source_url: string | null }>;
  model: string | null;
  error: string | null;
  finishedAt: string;
};

export type AgentStatus = {
  enabled: boolean;
  intervalMinutes: number;
  allowedSources: string[];
  job: {
    status: string;
    lastRunAt: string | null;
    lastSuccessAt: string | null;
    lastError: string | null;
    pausedReason: string | null;
  } | null;
  nextRunAt: string | null;
  runs: AgentRun[];
};

function mapRun(row: Record<string, unknown>): AgentRun {
  const asset = row["exchange_assets"] as { symbol: string } | null;
  return {
    id: row["id"] as string,
    runId: row["run_id"] as string,
    symbol: asset?.symbol ?? null,
    trigger: (row["trigger"] as string) ?? "cron",
    status: (row["status"] as string) ?? "ok",
    inserted: Number(row["inserted_count"] ?? 0),
    approved: Number(row["approved_count"] ?? 0),
    pending: Number(row["pending_count"] ?? 0),
    conflicts: Number(row["conflict_count"] ?? 0),
    skipped: Number(row["skipped_count"] ?? 0),
    sources: Array.isArray(row["sources"]) ? (row["sources"] as AgentRun["sources"]) : [],
    changes: Array.isArray(row["changes"]) ? (row["changes"] as AgentRun["changes"]) : [],
    model: (row["model"] as string | null) ?? null,
    error: (row["error"] as string | null) ?? null,
    finishedAt: row["finished_at"] as string,
  };
}

const RUN_SELECT =
  "id, run_id, trigger, status, inserted_count, approved_count, pending_count, conflict_count, skipped_count, sources, changes, model, error, finished_at, exchange_assets(symbol)";

/** Estado do agente (leitura pública). Com assetId devolve o histórico dessa empresa. */
export const getAgentStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ assetId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<AgentStatus> => {
    const { publicClient } = await import("@/lib/investments/public-client.server");
    const db = publicClient();

    const [configRes, jobRes] = await Promise.all([
      db
        .from("ai_agent_config")
        .select("enabled, interval_minutes, allowed_sources")
        .eq("config_key", AGENT_JOB_KEY)
        .maybeSingle(),
      db
        .from("ai_jobs")
        .select("status, last_run_at, last_success_at, last_error, paused_reason")
        .eq("job_key", AGENT_JOB_KEY)
        .maybeSingle(),
    ]);

    let runsQuery = db
      .from("ai_run_log")
      .select(RUN_SELECT)
      .order("finished_at", { ascending: false })
      .limit(data.assetId ? 20 : 30);
    if (data.assetId) runsQuery = runsQuery.eq("asset_id", data.assetId);
    const runsRes = await runsQuery;

    const intervalMinutes = configRes.data?.interval_minutes === 30 ? 30 : 60;
    const enabled = configRes.data ? Boolean(configRes.data.enabled) : false;
    const lastRunAt = (jobRes.data?.last_run_at as string | null) ?? null;
    const reference = data.assetId
      ? ((runsRes.data?.[0] as Record<string, unknown> | undefined)?.["finished_at"] as string | undefined) ?? lastRunAt
      : lastRunAt;

    const allowed = Array.isArray(configRes.data?.allowed_sources)
      ? (configRes.data?.allowed_sources as unknown[]).filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [];

    return {
      enabled,
      intervalMinutes,
      allowedSources: allowed,
      job: jobRes.data
        ? {
            status: jobRes.data.status as string,
            lastRunAt,
            lastSuccessAt: (jobRes.data.last_success_at as string | null) ?? null,
            lastError: (jobRes.data.last_error as string | null) ?? null,
            pausedReason: (jobRes.data.paused_reason as string | null) ?? null,
          }
        : null,
      nextRunAt:
        enabled && reference
          ? new Date(new Date(reference).getTime() + intervalMinutes * 60_000).toISOString()
          : null,
      runs: (runsRes.data ?? []).map((row) => mapRun(row as Record<string, unknown>)),
    };
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

export type MonitoredAsset = {
  assetId: string;
  symbol: string;
  name: string;
  companyName: string | null;
  monitored: boolean;
  lastRunAt: string | null;
  approvedCount: number;
};

/** Empresas monitoradas + configuração (administração). */
export const getAgentAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ config: AgentStatus; assets: MonitoredAsset[] }> => {
    const db = await requireAdmin(context);

    const [configRes, jobRes, runsRes, assetsRes] = await Promise.all([
      db
        .from("ai_agent_config")
        .select("enabled, interval_minutes, allowed_sources")
        .eq("config_key", AGENT_JOB_KEY)
        .maybeSingle(),
      db
        .from("ai_jobs")
        .select("status, last_run_at, last_success_at, last_error, paused_reason")
        .eq("job_key", AGENT_JOB_KEY)
        .maybeSingle(),
      db.from("ai_run_log").select(RUN_SELECT).order("finished_at", { ascending: false }).limit(40),
      db
        .from("exchange_assets")
        .select("id, symbol, name, ai_monitored, companies(name)")
        .eq("status", "ACTIVE")
        .order("symbol"),
    ]);

    const runs = (runsRes.data ?? []).map((row) => mapRun(row as Record<string, unknown>));
    const intervalMinutes = configRes.data?.interval_minutes === 30 ? 30 : 60;
    const enabled = configRes.data ? Boolean(configRes.data.enabled) : false;
    const lastRunAt = (jobRes.data?.last_run_at as string | null) ?? null;

    const counts = new Map<string, number>();
    const lastPerAsset = new Map<string, string>();
    const { data: approved } = await db
      .from("company_data_points")
      .select("asset_id")
      .eq("status", "approved")
      .limit(1000);
    for (const row of approved ?? []) {
      const key = row.asset_id as string;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const { data: rawRuns } = await db
      .from("ai_run_log")
      .select("asset_id, finished_at")
      .order("finished_at", { ascending: false })
      .limit(500);
    for (const row of rawRuns ?? []) {
      const key = row.asset_id as string | null;
      if (key && !lastPerAsset.has(key)) lastPerAsset.set(key, row.finished_at as string);
    }

    const allowed = Array.isArray(configRes.data?.allowed_sources)
      ? (configRes.data?.allowed_sources as unknown[]).filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [];

    return {
      config: {
        enabled,
        intervalMinutes,
        allowedSources: allowed,
        job: jobRes.data
          ? {
              status: jobRes.data.status as string,
              lastRunAt,
              lastSuccessAt: (jobRes.data.last_success_at as string | null) ?? null,
              lastError: (jobRes.data.last_error as string | null) ?? null,
              pausedReason: (jobRes.data.paused_reason as string | null) ?? null,
            }
          : null,
        nextRunAt:
          enabled && lastRunAt
            ? new Date(new Date(lastRunAt).getTime() + intervalMinutes * 60_000).toISOString()
            : null,
        runs,
      },
      assets: (assetsRes.data ?? []).map((row) => {
        const record = row as Record<string, unknown>;
        const id = record["id"] as string;
        return {
          assetId: id,
          symbol: record["symbol"] as string,
          name: record["name"] as string,
          companyName: (record["companies"] as { name: string } | null)?.name ?? null,
          monitored: record["ai_monitored"] !== false,
          lastRunAt: lastPerAsset.get(id) ?? null,
          approvedCount: counts.get(id) ?? 0,
        };
      }),
    };
  });

/** Intervalo, ligar/desligar e fontes permitidas (administração). */
export const updateAgentConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        enabled: z.boolean().optional(),
        intervalMinutes: z.union([z.literal(30), z.literal(60)]).optional(),
        allowedSources: z.array(z.string().trim().min(3).max(120)).max(60).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    const patch: Record<string, unknown> = { updated_by: context.userId };
    if (data.enabled !== undefined) patch["enabled"] = data.enabled;
    if (data.intervalMinutes !== undefined) patch["interval_minutes"] = data.intervalMinutes;
    if (data.allowedSources !== undefined) {
      patch["allowed_sources"] = Array.from(
        new Set(
          data.allowedSources.map((entry) =>
            entry.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, ""),
          ),
        ),
      ).filter(Boolean);
    }
    const { error } = await db
      .from("ai_agent_config")
      .update(patch as never)
      .eq("config_key", AGENT_JOB_KEY);
    if (error) throw new Error(error.message);
    await db.rpc("exchange_audit", {
      _user_id: context.userId,
      _action: "ai_agent_config_update",
      _entity: "ai_agent_config",
      _entity_id: null as unknown as string,
      _metadata: patch as never,
    });
    return { ok: true };
  });

/** Liga/desliga o monitoramento de uma empresa (administração). */
export const setAssetMonitored = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ assetId: z.string().uuid(), monitored: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    const { error } = await db
      .from("exchange_assets")
      .update({ ai_monitored: data.monitored })
      .eq("id", data.assetId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** "Atualizar agora": uma empresa ou todas as monitoradas (administração). */
export const runAgentNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ assetId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    const { refreshAssetData, loadAgentConfig } = await import("./company-data.server");
    const config = await loadAgentConfig();
    const runId = crypto.randomUUID();

    let ids: string[];
    if (data.assetId) {
      ids = [data.assetId];
    } else {
      const { data: rows } = await db
        .from("exchange_assets")
        .select("id")
        .eq("status", "ACTIVE")
        .eq("ai_monitored", true)
        .order("symbol")
        .limit(config.batchSize);
      ids = (rows ?? []).map((row) => row.id as string);
    }

    const results: Array<{ symbol: string; inserted: number; conflicts: number; error?: string }> = [];
    for (const id of ids) {
      try {
        const result = await refreshAssetData(id, { trigger: "manual", runId, config });
        results.push({ symbol: result.symbol, inserted: result.inserted, conflicts: result.conflicts });
      } catch (error) {
        results.push({
          symbol: id.slice(0, 8),
          inserted: 0,
          conflicts: 0,
          error: error instanceof Error ? error.message : "Falha desconhecida",
        });
      }
    }
    return { runId, results };
  });
