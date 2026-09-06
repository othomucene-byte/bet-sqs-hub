import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Sincronização agendada de desportos.
 *
 *  - Autenticada pelo segredo de cron (Bearer). Sem ele responde 401.
 *  - Sem `ODDS_API_KEY` responde 503 e nada é inventado.
 *  - Atualiza jogos e cotações, depois busca resultados finais e liquida os
 *    bilhetes através das funções de base de dados (ledger imutável).
 */
async function handle(request: Request): Promise<Response> {
  const unauthorized = await authenticateCronRequest(request);
  if (unauthorized) return unauthorized;

  const { oddsApiKey, syncSportsCatalog, syncSportsResults } = await import(
    "@/lib/sports/odds.server"
  );

  if (!oddsApiKey()) {
    return Response.json({ ok: false, error: "ODDS_API_KEY não configurado" }, { status: 503 });
  }

  try {
    const catalog = await syncSportsCatalog();
    const results = await syncSportsResults();
    return Response.json({ ok: true, catalog, results });
  } catch (error) {
    console.error("[sports-sync]", error);
    return Response.json({ ok: false, error: "sincronização falhou" }, { status: 502 });
  }
}

export const Route = createFileRoute("/api/public/cron/sports-sync")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
