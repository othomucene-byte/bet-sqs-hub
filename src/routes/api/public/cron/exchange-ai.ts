import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Atualização horária dos dados das empresas listadas (camada Mistral AI).
 *
 * Garantias: execução única (lease em ai_jobs), lote limitado por execução,
 * progresso gravado por registo, e disjuntor que pausa o trabalho em recusas
 * terminais (chave inválida, créditos, limites) ou falhas repetidas.
 * A inteligência nunca toca em saldos, ledger, ordens ou negócios.
 */

const BATCH = 5;
const LEASE_SECONDS = 600;

async function handle(request: Request): Promise<Response> {
  const unauthorized = await authenticateCronRequest(request);
  if (unauthorized) return unauthorized;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { MistralDenied, MistralNotConfigured } = await import("@/lib/exchange/mistral.server");
  const { refreshAssetData } = await import("@/lib/exchange/company-data.server");

  const { data: job, error: lockError } = await supabaseAdmin.rpc("ai_job_acquire", {
    _job_key: "company_data_refresh",
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
    .order("id")
    .gt("id", cursor ?? "00000000-0000-0000-0000-000000000000")
    .limit(BATCH);

  let batch = assets ?? [];
  if (batch.length === 0) {
    // Fim da lista: recomeça do início na próxima execução.
    const { data: restart } = await supabaseAdmin
      .from("exchange_assets")
      .select("id")
      .eq("status", "ACTIVE")
      .order("id")
      .limit(BATCH);
    batch = restart ?? [];
  }

  if (batch.length === 0) {
    await supabaseAdmin.rpc("ai_job_release", {
      _job_key: "company_data_refresh",
      _ok: true,
      _error: null as unknown as string,
      _pause: false,
      _processed: 0,
    });
    return Response.json({ ok: true, processed: 0, note: "sem instrumentos listados" });
  }

  let processed = 0;
  const results: unknown[] = [];
  let pause = false;
  let failure: string | null = null;

  for (const asset of batch) {
    try {
      results.push(await refreshAssetData(asset.id as string));
      processed += 1;
      await supabaseAdmin
        .from("ai_jobs")
        .update({ cursor_asset_id: asset.id as string })
        .eq("job_key", "company_data_refresh");
    } catch (e) {
      const err = e as Error;
      failure = err.message.slice(0, 300);
      if (err instanceof MistralNotConfigured) {
        pause = true;
        break;
      }
      if (err instanceof MistralDenied) {
        // 401/402/403 pausam; 429/5xx esperam pela próxima execução horária.
        if ([401, 402, 403].includes(err.status)) pause = true;
        break;
      }
      console.error("[exchange-ai]", failure);
    }
  }

  await supabaseAdmin.rpc("ai_job_release", {
    _job_key: "company_data_refresh",
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
