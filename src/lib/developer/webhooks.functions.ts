import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EVENTS = ["order.updated", "trade.executed", "price.updated"] as const;

export type WebhookEndpointRow = {
  id: string;
  url: string;
  description: string | null;
  events: string[];
  environment: "SANDBOX" | "LIVE";
  active: boolean;
  failureCount: number;
  lastDeliveryAt: string | null;
  createdAt: string;
};

export type WebhookDeliveryRow = {
  id: string;
  endpointId: string;
  event: string;
  status: string;
  attempts: number;
  responseStatus: number | null;
  error: string | null;
  createdAt: string;
  deliveredAt: string | null;
};

/** Avisos automáticos da conta e últimas entregas. */
export const listWebhooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({ context }): Promise<{ endpoints: WebhookEndpointRow[]; deliveries: WebhookDeliveryRow[] }> => {
      const { supabase, userId } = context;
      const endpointsRes = await supabase
        .from("webhook_endpoints")
        .select("id, url, description, events, environment, active, failure_count, last_delivery_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      const deliveriesRes = await supabase
        .from("webhook_deliveries")
        .select("id, endpoint_id, event, status, attempts, response_status, error, created_at, delivered_at")
        .order("created_at", { ascending: false })
        .limit(25);

      return {
        endpoints: (endpointsRes.data ?? []).map((row) => ({
          id: row.id as string,
          url: row.url as string,
          description: (row.description as string | null) ?? null,
          events: ((row.events as string[] | null) ?? []) as string[],
          environment: row.environment as "SANDBOX" | "LIVE",
          active: row.active === true,
          failureCount: Number(row.failure_count ?? 0),
          lastDeliveryAt: (row.last_delivery_at as string | null) ?? null,
          createdAt: row.created_at as string,
        })),
        deliveries: (deliveriesRes.data ?? []).map((row) => ({
          id: row.id as string,
          endpointId: row.endpoint_id as string,
          event: row.event as string,
          status: row.status as string,
          attempts: Number(row.attempts ?? 0),
          responseStatus: row.response_status == null ? null : Number(row.response_status),
          error: (row.error as string | null) ?? null,
          createdAt: row.created_at as string,
          deliveredAt: (row.delivered_at as string | null) ?? null,
        })),
      };
    },
  );

/** Cria um aviso automático. A chave de assinatura é mostrada uma única vez. */
export const createWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        url: z
          .string()
          .trim()
          .url()
          .max(300)
          .refine((value) => value.startsWith("https://"), "O endereço tem de começar por https://"),
        description: z.string().trim().max(120).optional(),
        events: z.array(z.enum(EVENTS)).min(1),
        environment: z.enum(["SANDBOX", "LIVE"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { randomBytes } = await import("node:crypto");
    const secret = `sqswh_${randomBytes(24).toString("base64url")}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error } = await supabaseAdmin
      .from("webhook_endpoints")
      .insert({
        user_id: context.userId,
        url: data.url,
        description: data.description ?? null,
        events: data.events,
        environment: data.environment,
        secret,
      })
      .select("id, created_at")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string, secret, createdAt: inserted.created_at as string };
  });

/** Activa, desactiva ou apaga um aviso automático da própria conta. */
export const updateWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ id: z.string().uuid(), action: z.enum(["activate", "deactivate", "delete"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.action === "delete") {
      const { error } = await supabase
        .from("webhook_endpoints")
        .delete()
        .eq("id", data.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await supabase
      .from("webhook_endpoints")
      .update({ active: data.action === "activate" })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Envia um evento de teste (ping) para confirmar a ligação e a assinatura. */
export const sendWebhookTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: endpoint } = await supabaseAdmin
      .from("webhook_endpoints")
      .select("id, user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!endpoint || endpoint.user_id !== context.userId) {
      throw new Error("Aviso automático não encontrado.");
    }
    const { error } = await supabaseAdmin.from("webhook_deliveries").insert({
      endpoint_id: data.id,
      event: "order.updated",
      payload: { event: "order.updated", test: true, data: { message: "Teste de ligação Betfcom SQs" } },
    });
    if (error) throw new Error(error.message);

    const { dispatchPendingWebhooks } = await import("./webhooks.server");
    const result = await dispatchPendingWebhooks(5);
    return result;
  });
