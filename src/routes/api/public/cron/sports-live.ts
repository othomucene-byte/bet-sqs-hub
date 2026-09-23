import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Sincronização agendada dos jogos em direto.
 *  - Autenticada pelo segredo de cron (Bearer).
 *  - Uma chamada ao fornecedor cobre todos os jogos a decorrer.
 *  - Respeita o intervalo e o orçamento diário definidos no painel de admin.
 */
async function handle(request: Request): Promise<Response> {
  const unauthorized = await authenticateCronRequest(request);
  if (unauthorized) return unauthorized;

  const { providerConfigured } = await import("@/lib/sports/provider.server");
  if (!providerConfigured()) {
    return Response.json({ ok: false, error: "API_FOOTBALL_KEY não configurado" }, { status: 503 });
  }

  const { syncLiveMatches } = await import("@/lib/sports/live-sync.server");
  try {
    const result = await syncLiveMatches(true);
    return Response.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    console.error("[sports-live]", error);
    return Response.json(
      { ok: false, error: (error as Error).message.slice(0, 300) },
      { status: 502 },
    );
  }
}

export const Route = createFileRoute("/api/public/cron/sports-live")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
