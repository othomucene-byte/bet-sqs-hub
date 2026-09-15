/**
 * Agente de pesquisa e atualização dos dados das empresas listadas.
 *
 * Regras invioláveis:
 *  - a inteligência só escreve em company_data_points e ai_run_log (informação),
 *    nunca em saldos, carteira, ordens, negócios ou ledger;
 *  - cada registo guarda a fonte com ligação real devolvida pela pesquisa, a data
 *    do acontecimento, a data de recolha, o modelo usado e o grau de confiança;
 *  - um item sem ligação verificada na pesquisa é descartado (não fica pendente);
 *  - nada é apagado: uma atualização marca o registo anterior como 'superseded';
 *  - divergência entre fontes fica com estado 'conflict' para revisão humana.
 */

import { z } from "zod";

import { AiNotConfigured, extractJson, groundedSearch, type GroundedSource } from "@/lib/ai/gemini-search.server";

const KINDS = ["FINANCIALS", "NEWS", "DIVIDEND", "CORPORATE_EVENT", "PROFILE", "OTHER"] as const;

const nullish = <T extends z.ZodTypeAny>(schema: T) =>
  schema.nullable().optional().transform((value) => value ?? null);

const ItemSchema = z.object({
  kind: z
    .string()
    .transform((value) => value.trim().toUpperCase())
    .transform((value) => ((KINDS as readonly string[]).includes(value) ? value : "OTHER"))
    .pipe(z.enum(KINDS)),
  title: z.string().trim().min(3).max(200),
  summary: nullish(z.string().trim().max(2000)),
  metrics: nullish(
    z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  ),
  event_date: nullish(
    z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}/)
      .transform((value) => value.slice(0, 10)),
  ),
  source_name: z.string().trim().min(2).max(160),
  source_url: nullish(z.string().trim().url()),
  confidence: z.coerce.number().min(0).max(1),
  conflict_note: nullish(z.string().trim().max(500)),
});

const PayloadSchema = z.object({
  items: z.array(z.unknown()).max(30).optional().default([]),
});

export type CollectedItem = z.infer<typeof ItemSchema>;

/** Aprovação automática só com fonte verificada na pesquisa e confiança alta. */
const AUTO_APPROVE_CONFIDENCE = 0.75;

export type AgentConfig = {
  enabled: boolean;
  intervalMinutes: number;
  allowedSources: string[];
  batchSize: number;
};

const DEFAULT_CONFIG: AgentConfig = {
  enabled: true,
  intervalMinutes: 60,
  allowedSources: [],
  batchSize: 5,
};

export const AGENT_JOB_KEY = "company_data_refresh";

export async function loadAgentConfig(): Promise<AgentConfig> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("ai_agent_config")
    .select("enabled, interval_minutes, allowed_sources, batch_size")
    .eq("config_key", AGENT_JOB_KEY)
    .maybeSingle();
  if (!data) return DEFAULT_CONFIG;
  const sources = Array.isArray(data.allowed_sources)
    ? (data.allowed_sources as unknown[]).filter((entry): entry is string => typeof entry === "string")
    : [];
  return {
    enabled: Boolean(data.enabled),
    intervalMinutes: data.interval_minutes === 30 ? 30 : 60,
    allowedSources: sources,
    batchSize: Math.max(1, Math.min(20, Number(data.batch_size ?? 5))),
  };
}

function hash(input: string): string {
  // FNV-1a de 64 bits em hexadecimal — suficiente para deduplicar conteúdo.
  let h = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(input)) {
    h ^= BigInt(byte);
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, "0");
}

const SYSTEM = [
  "És o agente de pesquisa e atualização do SQs Exchange (Moçambique).",
  "Pesquisas na web (tens a ferramenta de pesquisa Google activa) informação pública e verificável",
  "sobre a empresa indicada: resultados financeiros, comunicados, dividendos, eventos societários e notícias.",
  "REGRAS ABSOLUTAS:",
  "- Usa SEMPRE a pesquisa antes de responder. Só reportas o que encontraste em páginas reais.",
  "- Nunca inventes números, datas, fontes ou ligações. Sem resultados verificáveis devolve items: [].",
  "- Nunca produzas cotações, preços de mercado, volumes, recomendações de compra/venda nem previsões.",
  "- source_url tem de ser o endereço exacto da página que consultaste.",
  "- confidence reflecte a certeza real (0 a 1).",
  "- Se duas fontes indicarem valores diferentes para o mesmo facto, preenche conflict_note descrevendo a divergência.",
  'Responde só JSON: {"items":[{"kind","title","summary","metrics","event_date","source_name","source_url","confidence","conflict_note"}]}',
  "kind ∈ FINANCIALS | NEWS | DIVIDEND | CORPORATE_EVENT | PROFILE | OTHER. Escreve em português.",
].join("\n");

function userPrompt(input: {
  symbol: string;
  name: string;
  companyName: string | null;
  sector: string | null;
  allowedSources: string[];
  existing: Array<{ kind: string; title: string; event_date: string | null }>;
}): string {
  return [
    `Empresa: ${input.companyName ?? input.name}`,
    `Instrumento listado: ${input.symbol}`,
    input.sector ? `Setor: ${input.sector}` : null,
    input.allowedSources.length
      ? `Prioriza estas fontes (usa outras só se necessário): ${input.allowedSources.join(", ")}`
      : null,
    "Pesquisa o que houver de mais recente e verificável (últimos 12 meses).",
    input.existing.length
      ? [
          "Já temos registado o seguinte (não repitas se nada mudou; reporta apenas informação nova ou alterada):",
          ...input.existing.map(
            (entry) => `- [${entry.kind}] ${entry.title}${entry.event_date ? ` (${entry.event_date})` : ""}`,
          ),
        ].join("\n")
      : "Ainda não temos nenhum registo desta empresa.",
    `Data de hoje: ${new Date().toISOString().slice(0, 10)}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export type RefreshResult = {
  assetId: string;
  symbol: string;
  inserted: number;
  approved: number;
  pending: number;
  conflicts: number;
  skipped: number;
  sources: GroundedSource[];
  error?: string;
};

function domainOf(url: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function describeChange(
  item: CollectedItem,
  previous: { title: string; summary: string | null; metrics: unknown } | null,
): string {
  if (!previous) return `Nova informação (${item.kind}): ${item.title}`;
  const parts: string[] = [];
  if (previous.title !== item.title) parts.push(`título: "${previous.title}" → "${item.title}"`);
  const before = JSON.stringify(previous.metrics ?? {});
  const after = JSON.stringify(item.metrics ?? {});
  if (before !== after) parts.push("indicadores actualizados");
  if ((previous.summary ?? "") !== (item.summary ?? "")) parts.push("resumo actualizado");
  return parts.length ? `Alterado — ${parts.join("; ")}` : `Reconfirmado: ${item.title}`;
}

/**
 * Pesquisa e atualiza os dados de um instrumento.
 * Idempotente pelo conteúdo (content_hash). Escreve sempre uma linha em ai_run_log.
 */
export async function refreshAssetData(
  assetId: string,
  options: { trigger?: string; runId?: string; config?: AgentConfig } = {},
): Promise<RefreshResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const config = options.config ?? (await loadAgentConfig());
  const runId = options.runId ?? crypto.randomUUID();
  const trigger = options.trigger ?? "cron";
  const startedAt = new Date().toISOString();

  const { data: asset, error } = await supabaseAdmin
    .from("exchange_assets")
    .select("id, symbol, name, company_id, companies(name, sector)")
    .eq("id", assetId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!asset) throw new Error("Instrumento inexistente");

  const company = asset.companies as { name: string; sector: string | null } | null;
  const symbol = asset.symbol as string;

  const result: RefreshResult = {
    assetId,
    symbol,
    inserted: 0,
    approved: 0,
    pending: 0,
    conflicts: 0,
    skipped: 0,
    sources: [],
  };

  const changes: Array<{ kind: string; title: string; change: string; status: string; source_url: string | null }> = [];

  const logRun = async (status: string, extra: { error?: string; provider?: string; model?: string }) => {
    await supabaseAdmin.from("ai_run_log").insert({
      run_id: runId,
      job_key: AGENT_JOB_KEY,
      asset_id: assetId,
      company_id: (asset.company_id as string | null) ?? null,
      trigger,
      status,
      inserted_count: result.inserted,
      approved_count: result.approved,
      pending_count: result.pending,
      conflict_count: result.conflicts,
      skipped_count: result.skipped,
      sources: result.sources as unknown as never,
      changes: changes as unknown as never,
      provider: extra.provider ?? "google",
      model: extra.model ?? null,
      ...(extra.error ? { error: extra.error } : {}),
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });
  };

  const { data: existingRows } = await supabaseAdmin
    .from("company_data_points")
    .select("kind, title, event_date")
    .eq("asset_id", assetId)
    .eq("status", "approved")
    .order("collected_at", { ascending: false })
    .limit(20);

  let search: Awaited<ReturnType<typeof groundedSearch>>;
  try {
    search = await groundedSearch({
      system: SYSTEM,
      prompt: userPrompt({
        symbol,
        name: asset.name as string,
        companyName: company?.name ?? null,
        sector: company?.sector ?? null,
        allowedSources: config.allowedSources,
        existing: (existingRows ?? []) as Array<{ kind: string; title: string; event_date: string | null }>,
      }),
    });
  } catch (err) {
    if (err instanceof AiNotConfigured) {
      await logRun("not_configured", { error: err.message });
      throw err;
    }
    throw err;
  }

  if (!search.ok) {
    await logRun("failed", { error: search.error });
    const failure = new Error(search.error) as Error & { status?: number; terminal?: boolean };
    if (search.status !== undefined) failure.status = search.status;
    failure.terminal = search.terminal;
    throw failure;
  }

  result.sources = search.sources;

  const parsed = PayloadSchema.safeParse(extractJson(search.text));
  if (!parsed.success) {
    await logRun("invalid_payload", { error: "Resposta sem formato utilizável.", model: search.model });
    throw new Error("Dados propostos com formato inválido — nada foi guardado.");
  }

  const groundedUrls = new Set(search.sources.map((source) => source.url));
  const groundedDomains = new Set(search.sources.map((source) => source.domain).filter(Boolean));

  const items: CollectedItem[] = [];
  for (const candidate of parsed.data.items) {
    const item = ItemSchema.safeParse(candidate);
    if (!item.success) {
      result.skipped += 1;
      continue;
    }
    // Sem ligação real confirmada pela pesquisa, o item é descartado.
    const url = item.data.source_url;
    const verified =
      Boolean(url) && (groundedUrls.has(url as string) || groundedDomains.has(domainOf(url)));
    if (!verified) {
      result.skipped += 1;
      changes.push({
        kind: item.data.kind,
        title: item.data.title,
        change: "Descartado: sem ligação verificada na pesquisa.",
        status: "discarded",
        source_url: url,
      });
      continue;
    }
    items.push(item.data);
  }

  // Divergência entre fontes para o mesmo facto (mesmo tipo e mesma data).
  const conflictKeys = new Set<string>();
  for (const item of items) {
    const key = `${item.kind}|${item.event_date ?? ""}`;
    const twin = items.find(
      (other) =>
        other !== item &&
        `${other.kind}|${other.event_date ?? ""}` === key &&
        JSON.stringify(other.metrics ?? {}) !== JSON.stringify(item.metrics ?? {}),
    );
    if (twin && item.event_date) conflictKeys.add(key);
  }

  for (const item of items) {
    const contentHash = hash(
      [item.kind, item.title, item.summary ?? "", item.event_date ?? "", item.source_url ?? ""]
        .join("|")
        .toLowerCase(),
    );

    const { data: existing } = await supabaseAdmin
      .from("company_data_points")
      .select("id")
      .eq("asset_id", assetId)
      .eq("kind", item.kind)
      .eq("content_hash", contentHash)
      .maybeSingle();
    if (existing) {
      result.skipped += 1;
      continue;
    }

    const conflicted =
      Boolean(item.conflict_note) || conflictKeys.has(`${item.kind}|${item.event_date ?? ""}`);
    const autoApprove = !conflicted && item.confidence >= AUTO_APPROVE_CONFIDENCE;
    const status = conflicted ? "conflict" : autoApprove ? "approved" : "pending";

    const { data: previous } = await supabaseAdmin
      .from("company_data_points")
      .select("id, title, summary, metrics")
      .eq("asset_id", assetId)
      .eq("kind", item.kind)
      .eq("status", "approved")
      .order("collected_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const changeSummary = describeChange(
      item,
      previous
        ? {
            title: previous.title as string,
            summary: (previous.summary as string | null) ?? null,
            metrics: previous.metrics,
          }
        : null,
    );

    const itemSources = search.sources.filter(
      (source) => source.url === item.source_url || source.domain === domainOf(item.source_url),
    );

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("company_data_points")
      .insert({
        asset_id: assetId,
        company_id: (asset.company_id as string | null) ?? null,
        kind: item.kind,
        title: item.title,
        summary: item.summary,
        metrics: item.metrics ?? {},
        event_date: item.event_date,
        source_name: item.source_name,
        source_url: item.source_url,
        confidence: item.confidence,
        status,
        provider: "google",
        model: search.model,
        run_id: runId,
        content_hash: contentHash,
        sources: (itemSources.length ? itemSources : search.sources) as unknown as never,
        change_summary: changeSummary,
        ...(item.conflict_note ? { conflict_note: item.conflict_note } : {}),
        ...(conflicted && !item.conflict_note
          ? { conflict_note: "Fontes com valores diferentes para o mesmo período." }
          : {}),
        ...(autoApprove && previous?.id ? { supersedes_id: previous.id as string } : {}),
        collected_at: new Date().toISOString(),
        ...(autoApprove ? { reviewed_at: new Date().toISOString() } : {}),
        validation_note: conflicted
          ? "Inconsistência entre fontes — aguarda revisão humana."
          : autoApprove
            ? "Aprovado automaticamente: fonte verificada na pesquisa e confiança alta."
            : "À espera de validação humana (confiança insuficiente).",
      })
      .select("id")
      .maybeSingle();
    if (insErr) throw new Error(insErr.message);

    result.inserted += 1;
    changes.push({
      kind: item.kind,
      title: item.title,
      change: changeSummary,
      status,
      source_url: item.source_url,
    });

    if (status === "approved") {
      result.approved += 1;
      // O registo anterior do mesmo tipo passa a histórico, sem ser apagado.
      await supabaseAdmin
        .from("company_data_points")
        .update({ status: "superseded" })
        .eq("asset_id", assetId)
        .eq("kind", item.kind)
        .eq("status", "approved")
        .neq("id", inserted?.id ?? "");
    } else if (status === "conflict") {
      result.conflicts += 1;
    } else {
      result.pending += 1;
    }
  }

  await logRun("ok", { model: search.model });
  return result;
}
