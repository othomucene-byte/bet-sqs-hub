/**
 * Avisos automáticos (webhooks) da Betfcom SQs.
 *
 * O servidor é a única autoridade: os eventos são criados a partir de factos já
 * gravados (ordens, negócios, preços) e ficam numa fila com tentativas e
 * assinatura HMAC-SHA256 do corpo enviado. Nada é enviado com base em
 * pressupostos do frontend.
 */

import { createHmac } from "node:crypto";

export const WEBHOOK_EVENTS = [
  "order.updated",
  "trade.executed",
  "price.updated",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

const MAX_ATTEMPTS = 6;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export function signPayload(secret: string, timestamp: string, body: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`, "utf8").digest("hex");
}

/**
 * Coloca um evento na fila de entrega para todos os endpoints activos do
 * utilizador que subscreveram o evento. Nunca falha o fluxo principal.
 */
export async function enqueueWebhookEvent(input: {
  userId: string;
  event: WebhookEvent;
  environment: "SANDBOX" | "LIVE";
  payload: Record<string, unknown>;
}): Promise<number> {
  try {
    const db = await admin();
    const { data } = await db
      .from("webhook_endpoints")
      .select("id")
      .eq("user_id", input.userId)
      .eq("active", true)
      .eq("environment", input.environment)
      .contains("events", [input.event]);

    const endpoints = data ?? [];
    if (endpoints.length === 0) return 0;

    await db.from("webhook_deliveries").insert(
      endpoints.map((endpoint) => ({
        endpoint_id: endpoint.id as string,
        event: input.event,
        payload: { event: input.event, environment: input.environment, data: input.payload },
      })),
    );
    // Entrega imediata: a tarefa agendada é apenas a rede de segurança das
    // tentativas seguintes, não o caminho normal.
    void dispatchPendingWebhooks(endpoints.length).catch((error) => {
      console.error("[webhooks] falha na entrega imediata", error);
    });
    return endpoints.length;
  } catch (error) {
    console.error("[webhooks] falha ao enfileirar", error);
    return 0;
  }
}

/** Envia as entregas pendentes. Chamado pela tarefa agendada. */
export async function dispatchPendingWebhooks(limit = 25) {
  const db = await admin();
  const nowIso = new Date().toISOString();
  const { data, error } = await db
    .from("webhook_deliveries")
    .select("id, endpoint_id, event, payload, attempts")
    .eq("status", "pending")
    .lte("next_attempt_at", nowIso)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const deliveries = data ?? [];
  if (deliveries.length === 0) return { processed: 0, delivered: 0, failed: 0 };

  const endpointIds = [...new Set(deliveries.map((d) => d.endpoint_id as string))];
  const { data: endpointRows } = await db
    .from("webhook_endpoints")
    .select("id, url, secret, active, failure_count")
    .in("id", endpointIds);
  const endpoints = new Map((endpointRows ?? []).map((row) => [row.id as string, row]));

  let delivered = 0;
  let failed = 0;

  for (const delivery of deliveries) {
    const endpoint = endpoints.get(delivery.endpoint_id as string);
    const attempts = Number(delivery.attempts ?? 0) + 1;

    if (!endpoint || endpoint.active !== true) {
      await db
        .from("webhook_deliveries")
        .update({ status: "failed", attempts, error: "Endpoint inactivo ou removido." })
        .eq("id", delivery.id as string);
      failed += 1;
      continue;
    }

    const body = JSON.stringify({
      id: delivery.id,
      event: delivery.event,
      created_at: nowIso,
      ...(delivery.payload as Record<string, unknown>),
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();

    let responseStatus: number | null = null;
    let errorText: string | null = null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const response = await fetch(endpoint.url as string, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-sqs-event": delivery.event as string,
          "x-sqs-timestamp": timestamp,
          "x-sqs-signature": signPayload(endpoint.secret as string, timestamp, body),
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);
      responseStatus = response.status;
      if (!response.ok) errorText = `Resposta ${response.status}`;
    } catch (error) {
      errorText = error instanceof Error ? error.message.slice(0, 300) : "Falha de rede";
    }

    if (errorText == null) {
      await db
        .from("webhook_deliveries")
        .update({
          status: "delivered",
          attempts,
          response_status: responseStatus,
          error: null,
          delivered_at: new Date().toISOString(),
        })
        .eq("id", delivery.id as string);
      await db
        .from("webhook_endpoints")
        .update({ last_delivery_at: new Date().toISOString(), failure_count: 0 })
        .eq("id", endpoint.id as string);
      delivered += 1;
      continue;
    }

    const exhausted = attempts >= MAX_ATTEMPTS;
    const backoffSeconds = Math.min(3600, 30 * 2 ** (attempts - 1));
    await db
      .from("webhook_deliveries")
      .update({
        status: exhausted ? "failed" : "pending",
        attempts,
        response_status: responseStatus,
        error: errorText,
        next_attempt_at: new Date(Date.now() + backoffSeconds * 1000).toISOString(),
      })
      .eq("id", delivery.id as string);
    await db
      .from("webhook_endpoints")
      .update({ failure_count: Number(endpoint.failure_count ?? 0) + 1 })
      .eq("id", endpoint.id as string);
    failed += 1;
  }

  return { processed: deliveries.length, delivered, failed };
}
