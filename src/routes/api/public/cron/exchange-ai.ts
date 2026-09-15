import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Agente de pesquisa e atualização das empresas listadas.
 *
 * O agendador chama esta rota a cada 30 minutos; o intervalo real (30 ou 60 min),
 * o estado ligado/desligado, as fontes e as empresas monitoradas vêm da
 * configuração da administração.
 *
 * Garantias: execução única (lease em ai_jobs), lote limitado por execução,
 * progresso gravado por registo, e disjuntor que pausa o trabalho em recusas
 * terminais (chave inválida, créditos, limites) ou falhas repetidas.
 * A inteligência nunca toca em saldos, ledger, ordens ou negócios.
 */

const LEASE_SECONDS = 600;
const JOB_KEY = "company_data_refresh";

async function handle(request: Request): Promise<Response> {
  const unauthorized = await authenticateCronRequest(request);
  if (unauthorized) return unauthorized;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { AiNotConfigured } = await import("@/lib/ai/search.server");
  const { refreshAssetData, loadAgentConfig } = await import("@/lib/exchange/company-data.server");

  const config = await loadAgentConfig();
  if (!config.enabled) {
    return Response.json({ ok: true, skipped: "monitoramento desligado na administração" });
  }

  // Respeita o intervalo configurado mesmo que o agendador corra mais vezes.
  const { data: state } = await supabaseAdmin
    .from("ai_jobs")
    .select("last_run_at")
    .eq("job_key", JOB_KEY)
    .maybeSingle();
  const lastRunAt = (state?.last_run_at as string | null) ?? null;
  if (lastRunAt) {
    const elapsedMinutes = (Date.now() - new Date(lastRunAt).getTime()) / 60_000;
    if (elapsedMinutes < config.intervalMinutes - 1) {
      return Response.json({
        ok: true,
        skipped: "ainda dentro do intervalo configurado",
        intervalMinutes: config.intervalMinutes,
      });
    }
  }

  const { data: job, error: lockError } = await supabaseAdmin.rpc("ai_job_acquire", {
    _job_key: JOB_KEY,
    _lease_seconds: LEASE_SECONDS,
  });
  if (lockError) {
    return Response.json({ ok: false, error: lockError.message.slice(0, 300) }, { status: 500 });
  }
  if (!job) {
    return Response.json({ ok: true, skipped: "em execução ou pausado" });
  }

  const cursor = (job as unknown as { cursor_asset_id: string | null }).cursor_asset_id;

  const { data: assets } = await supabaseAdmin
    .from("exchange_assets")
    .select("id")
    .eq("status", "ACTIVE")
    .eq("ai_monitored", true)
    .order("id")
    .gt("id", cursor ?? "00000000-0000-0000-0000-000000000000")
    .limit(config.batchSize);

  let batch = assets ?? [];
  if (batch.length === 0) {
    // Fim da lista: recomeça do início na próxima execução.
    const { data: restart } = await supabaseAdmin
      .from("exchange_assets")
      .select("id")
      .eq("status", "ACTIVE")
      .eq("ai_monitored", true)
      .order("id")
      .limit(config.batchSize);
    batch = restart ?? [];
  }

  if (batch.length === 0) {
    await supabaseAdmin.rpc("ai_job_release", {
      _job_key: JOB_KEY,
      _ok: true,
      _error: null as unknown as string,
      _pause: false,
      _processed: 0,
    });
    return Response.json({ ok: true, processed: 0, note: "sem empresas monitoradas" });
  }

  const runId = crypto.randomUUID();
  let processed = 0;
  const results: unknown[] = [];
  let pause = false;
  let failure: string | null = null;

  for (const asset of batch) {
    try {
      results.push(await refreshAssetData(asset.id as string, { trigger: "cron", runId, config }));
      processed += 1;
      await supabaseAdmin
        .from("ai_jobs")
        .update({ cursor_asset_id: asset.id as string })
        .eq("job_key", JOB_KEY);
    } catch (e) {
      const err = e as Error & { status?: number; terminal?: boolean };
      failure = err.message.slice(0, 300);
      if (err instanceof AiNotConfigured) {
        pause = true;
        break;
      }
      if (err.terminal || (err.status !== undefined && [401, 402, 403].includes(err.status))) {
        // Recusas terminais pausam; 429/5xx esperam pela próxima execução.
        pause = true;
        break;
      }
      if (err.status !== undefined) break;
      console.error("[exchange-ai]", failure);
    }
  }

  await supabaseAdmin.rpc("ai_job_release", {
    _job_key: JOB_KEY,
    _ok: failure === null,
    _error: failure as unknown as string,
    _pause: pause,
    _processed: processed,
  });

  return Response.json({ ok: failure === null, processed, paused: pause, failure, results });
}

export const Route = createFileRoute("/api/public/cron/exchange-ai")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
