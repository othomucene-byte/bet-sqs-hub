import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

/**
 * Webhook NetShop — autoridade principal para confirmar pagamentos.
 *
 * Regras:
 *  - Assinatura HMAC-SHA256 sobre o corpo cru no header `X-NetShop-Signature`,
 *    verificada ANTES de qualquer leitura do payload.
 *  - Eventos oficiais: charge.paid | charge.failed | charge.pending |
 *    payout.completed | payout.failed.
 *  - Idempotência garantida pela referência única no ledger (`wallet_apply`).
 *  - Sem `NETSHOP_WEBHOOK_SECRET` a rota responde 503: nada é creditado com
 *    base em pressupostos.
 */

const EVENTS = [
  "charge.paid",
  "charge.failed",
  "charge.pending",
  "payout.completed",
  "payout.failed",
] as const;

const payloadSchema = z
  .object({
    event: z.enum(EVENTS).optional(),
    type: z.enum(EVENTS).optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    id: z.string().max(120).optional(),
    reference: z.string().max(120).optional(),
    amount: z.number().positive().max(10_000_000).optional(),
    provider: z.record(z.string(), z.unknown()).optional(),
    failed_reason: z.string().max(400).nullable().optional(),
  })
  .passthrough();

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * A NetShop pode assinar em hex ou base64, com ou sem prefixo `sha256=`, e
 * (em algumas versões) sobre `<timestamp>.<corpo>`. Aceitamos qualquer um dos
 * esquemas, sempre com HMAC-SHA256 e comparação em tempo constante.
 */
function verifySignature(
  rawBody: string,
  signature: string | null,
  secret: string,
  timestamp?: string | null,
): boolean {
  if (!signature) return false;
  const received = signature.replace(/^sha256=/i, "").trim();
  const payloads = [rawBody, ...(timestamp ? [`${timestamp}.${rawBody}`] : [])];
  for (const payload of payloads) {
    const hex = createHmac("sha256", secret).update(payload).digest("hex");
    if (safeEqual(received.toLowerCase(), hex)) return true;
    const b64 = createHmac("sha256", secret).update(payload).digest("base64");
    if (safeEqual(received, b64)) return true;
  }
  return false;
}



function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

export const Route = createFileRoute("/api/public/webhooks/netshop")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["NETSHOP_WEBHOOK_SECRET"];
        if (!secret) {
          return Response.json({ error: "integration_not_configured" }, { status: 503 });
        }

        const rawBody = await request.text();
        const signature =
          request.headers.get("x-netshop-signature") ??
          request.headers.get("x-signature") ??
          request.headers.get("x-webhook-signature");
        const timestamp =
          request.headers.get("x-netshop-timestamp") ?? request.headers.get("x-timestamp");

        if (!verifySignature(rawBody, signature, secret, timestamp)) {
          console.error(
            "netshop webhook signature mismatch; headers:",
            [...request.headers.keys()].join(","),
          );
          return Response.json({ error: "invalid_signature" }, { status: 401 });
        }


        let body: unknown;
        try {
          body = JSON.parse(rawBody);
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400 });
        }

        const parsed = payloadSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "invalid_payload" }, { status: 400 });
        }

        // A NetShop pode enviar o objeto na raiz ou dentro de `data`.
        const envelope = parsed.data;
        const inner = (envelope.data ?? {}) as Record<string, unknown>;
        const eventName = envelope.event ?? envelope.type;
        if (!eventName) return Response.json({ error: "missing_event" }, { status: 400 });

        const reference = pickString(envelope.reference, inner["reference"]);
        if (!reference) return Response.json({ error: "missing_reference" }, { status: 400 });

        const providerObj = (envelope.provider ??
          (inner["provider"] as Record<string, unknown> | undefined) ??
          {}) as Record<string, unknown>;
        const providerTransactionId = pickString(
          providerObj["transactionID"],
          providerObj["transaction_id"],
          envelope.id,
          inner["id"],
        );

        // Evento intermédio: nada muda no ledger.
        if (eventName === "charge.pending") return Response.json({ ok: true });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: intent } = await supabaseAdmin
          .from("payment_intents")
          .select("id, wallet_id, direction, method, amount, status")
          .eq("reference", reference)
          .maybeSingle();

        if (!intent) {
          return Response.json({ error: "unknown_reference" }, { status: 404 });
        }

        const failed = eventName.endsWith(".failed");
        const amount = Number(intent.amount);

        if (failed) {
          // Payout falhado: o valor reservado volta ao disponível (idempotente
          // pela referência de reembolso).
          if (intent.direction === "withdrawal" && intent.status === "pending") {
            const { error: refundError } = await supabaseAdmin.rpc("wallet_apply", {
              _wallet_id: intent.wallet_id,
              _type: "refund",
              _amount: amount,
              _reference: `netshop:${reference}:refund`,
              _provider: "netshop",
              ...(providerTransactionId
                ? { _provider_transaction_id: providerTransactionId }
                : {}),
              _metadata: { event: eventName, reason: envelope.failed_reason ?? null },
            });
            if (refundError && !/duplicate|unique/i.test(refundError.message)) {
              console.error("netshop webhook refund error", refundError.message);
              return Response.json({ error: "ledger_error" }, { status: 500 });
            }
          }

          await supabaseAdmin
            .from("payment_intents")
            .update({
              status: "failed",
              ...(providerTransactionId
                ? { provider_transaction_id: providerTransactionId }
                : {}),
            })
            .eq("id", intent.id)
            .eq("status", "pending");
          return Response.json({ ok: true });
        }

        // Sucesso. O depósito credita agora; no levantamento o débito já foi
        // lançado na reserva, pelo que a confirmação só fecha a intenção.
        if (intent.direction === "deposit") {
          const { error } = await supabaseAdmin.rpc("wallet_apply", {
            _wallet_id: intent.wallet_id,
            _type: "deposit",
            _amount: amount,
            _reference: `netshop:${reference}`,
            _provider: "netshop",
            ...(providerTransactionId ? { _provider_transaction_id: providerTransactionId } : {}),
            _metadata: { method: intent.method, event: eventName },
          });

          if (error && !/duplicate|unique/i.test(error.message)) {
            console.error("netshop webhook ledger error", error.message);
            return Response.json({ error: "ledger_error" }, { status: 500 });
          }
        }

        await supabaseAdmin
          .from("payment_intents")
          .update({
            status: "succeeded",
            ...(providerTransactionId ? { provider_transaction_id: providerTransactionId } : {}),
          })
          .eq("id", intent.id);

        return Response.json({ ok: true });
      },
    },
  },
});
