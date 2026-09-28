import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Aprova comissões de afiliados cujo período de validação já terminou.
 * Autenticada pelo segredo de cron (Bearer). Sem ele responde 401.
 */
async function handle(request: Request): Promise<Response> {
  const unauthorized = await authenticateCronRequest(request);
  if (unauthorized) return unauthorized;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("affiliate_approve_due", { _limit: 1000 });

  if (error) {
    console.error("[affiliate-approve]", error.message);
    return Response.json({ ok: false, error: error.message.slice(0, 300) }, { status: 500 });
  }
  return Response.json({ ok: true, approved: data ?? 0 });
}

export const Route = createFileRoute("/api/public/cron/affiliate-approve")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
