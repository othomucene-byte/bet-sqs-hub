/**
 * Recolha e validação de dados informativos das empresas listadas.
 *
 * Regras invioláveis:
 *  - a inteligência só escreve em company_data_points (dados informativos);
 *  - cada registo guarda fonte, ligação, data do acontecimento, data de recolha,
 *    modelo usado e grau de confiança;
 *  - nada é apagado: uma atualização marca o registo anterior como 'superseded';
 *  - registos sem fonte verificável ou com confiança baixa ficam 'pending' e
 *    dependem de validação humana na administração.
 */

import { z } from "zod";

import { callMistralJson, MISTRAL_MODEL, type MistralMessage } from "./mistral.server";

const KINDS = ["FINANCIALS", "NEWS", "DIVIDEND", "CORPORATE_EVENT", "PROFILE", "OTHER"] as const;

const ItemSchema = z.object({
  kind: z.enum(KINDS),
  title: z.string().trim().min(3).max(200),
  summary: z.string().trim().max(2000).nullable(),
  metrics: z.record(z.string(), z.union([z.string(), z.number()])).nullable(),
  event_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  source_name: z.string().trim().min(2).max(160),
  source_url: z.string().trim().url().nullable(),
  confidence: z.number().min(0).max(1),
});

const PayloadSchema = z.object({ items: z.array(ItemSchema).max(12) });

export type CollectedItem = z.infer<typeof ItemSchema>;

/** Aprovação automática só com fonte verificável e confiança alta. */
const AUTO_APPROVE_CONFIDENCE = 0.8;

function hash(input: string): string {
  // FNV-1a de 64 bits em hexadecimal — suficiente para deduplicar conteúdo.
  let h = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(input)) {
    h ^= BigInt(byte);
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, "0");
}

function prompt(asset: {
  symbol: string;
  name: string;
  companyName: string | null;
  sector: string | null;
}): MistralMessage[] {
  return [
    {
      role: "system",
      content: [
        "És um analista de informação de mercado do SQs Exchange (Moçambique).",
        "Reúnes apenas factos verificáveis sobre empresas: resultados financeiros, notícias,",
        "dividendos e eventos societários.",
        "REGRAS ABSOLUTAS:",
        "- Nunca inventes números, datas ou fontes. Se não tiveres informação verificável, devolve items: [].",
        "- Nunca produzas cotações, preços de mercado, recomendações de compra/venda nem previsões.",
        "- Cada item precisa de fonte (source_name) e, quando existir, source_url.",
        "- confidence reflete a tua certeza real (0 a 1). Sem fonte oficial, usa valor baixo.",
        'Responde só JSON: {"items":[{"kind","title","summary","metrics","event_date","source_name","source_url","confidence"}]}',
        "kind ∈ FINANCIALS | NEWS | DIVIDEND | CORPORATE_EVENT | PROFILE | OTHER. Escreve em português.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Empresa: ${asset.companyName ?? asset.name}`,
        `Instrumento listado: ${asset.symbol}`,
        asset.sector ? `Setor: ${asset.sector}` : null,
        "Reúne o que houver de mais recente e verificável (últimos 12 meses).",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
}

export type RefreshResult = {
  assetId: string;
  symbol: string;
  inserted: number;
  approved: number;
  pending: number;
  skipped: number;
};

/** Atualiza os dados de um instrumento. Idempotente pelo conteúdo (content_hash). */
export async function refreshAssetData(assetId: string): Promise<RefreshResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: asset, error } = await supabaseAdmin
    .from("exchange_assets")
    .select("id, symbol, name, company_id, companies(name, sector)")
    .eq("id", assetId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!asset) throw new Error("Instrumento inexistente");

  const company = asset.companies as { name: string; sector: string | null } | null;
  const raw = await callMistralJson(
    prompt({
      symbol: asset.symbol as string,
      name: asset.name as string,
      companyName: company?.name ?? null,
      sector: company?.sector ?? null,
    }),
  );

  const parsed = PayloadSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Dados propostos com formato inválido — nada foi guardado.");
  }

  const runId = crypto.randomUUID();
  const result: RefreshResult = {
    assetId,
    symbol: asset.symbol as string,
    inserted: 0,
    approved: 0,
    pending: 0,
    skipped: 0,
  };

  for (const item of parsed.data.items) {
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

    const autoApprove = item.confidence >= AUTO_APPROVE_CONFIDENCE && Boolean(item.source_url);
    const status = autoApprove ? "approved" : "pending";

    const { data: previous } = await supabaseAdmin
      .from("company_data_points")
      .select("id")
      .eq("asset_id", assetId)
      .eq("kind", item.kind)
      .eq("status", "approved")
      .order("collected_at", { ascending: false })
      .limit(1)
      .maybeSingle();

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
        provider: "mistral",
        model: MISTRAL_MODEL,
        run_id: runId,
        content_hash: contentHash,
        ...(autoApprove && previous?.id ? { supersedes_id: previous.id as string } : {}),
        collected_at: new Date().toISOString(),
        ...(autoApprove ? { reviewed_at: new Date().toISOString() } : {}),
        validation_note: autoApprove
          ? "Aprovado automaticamente: fonte com ligação e confiança alta."
          : "À espera de validação humana.",
      })
      .select("id")
      .maybeSingle();
    if (insErr) throw new Error(insErr.message);

    result.inserted += 1;
    if (autoApprove) {
      result.approved += 1;
      // O registo anterior do mesmo tipo passa a histórico, sem ser apagado.
      await supabaseAdmin
        .from("company_data_points")
        .update({ status: "superseded" })
        .eq("asset_id", assetId)
        .eq("kind", item.kind)
        .eq("status", "approved")
        .neq("id", inserted?.id ?? "");
    } else {
      result.pending += 1;
    }
  }

  return result;
}
