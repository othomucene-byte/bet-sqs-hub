import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Entrega dos avisos automáticos pendentes, com tentativas e assinatura HMAC. */
async function handle(request: Request): Promise<Response> {
  const unauthorized = await authenticateCronRequest(request);
  if (unauthorized) return unauthorized;

  const { dispatchPendingWebhooks } = await import("@/lib/developer/webhooks.server");
  try {
    const result = await dispatchPendingWebhooks(25);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "falha";
    console.error("[webhook-dispatch]", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/cron/webhook-dispatch")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
