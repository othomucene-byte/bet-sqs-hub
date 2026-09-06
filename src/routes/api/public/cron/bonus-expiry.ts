import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Expiração agendada de bónus e apostas grátis.
 * Autenticada pelo segredo de cron (Bearer). Sem ele responde 401.
 */
async function handle(request: Request): Promise<Response> {
  const unauthorized = await authenticateCronRequest(request);
  if (unauthorized) return unauthorized;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("expire_bonuses");

  if (error) {
    console.error("[bonus-expiry]", error.message);
    return Response.json({ ok: false, error: error.message.slice(0, 300) }, { status: 500 });
  }
  return Response.json({ ok: true, expiredGrants: data ?? 0 });
}

export const Route = createFileRoute("/api/public/cron/bonus-expiry")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
