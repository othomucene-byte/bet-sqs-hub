import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

/**
 * Webhook PayTED (e-Mola) — autoridade para confirmar depósitos e payouts.
 *
 * Assinatura: header `X-Payted-Signature`, HMAC-SHA256 com o webhook secret.
 * A PayTED usa dois formatos documentados:
 *   - `t=<unix>,v1=<hmac hex>` sobre `<t>.<corpo cru>` (padrão Stripe);
 *   - HMAC hex directo sobre o corpo cru.
 * Aceitamos ambos, sempre em comparação de tempo constante e SEMPRE antes de
 * ler o payload. Sem `PAYTED_WEBHOOK_SECRET` respondemos 503: nada é creditado
 * com base em pressupostos.
 *
 * Eventos: payment.completed | payment.failed | payment.cancelled |
 * transfer.completed | transfer.failed (o estado em `data.status` é o fallback).
 *
 * Idempotência: a referência única no ledger (`payted:<ref>`) garante que um
 * reenvio do webhook nunca duplica dinheiro.
 */

const payloadSchema = z
  .object({
    event: z.string().max(120).optional(),
    type: z.string().max(120).optional(),
    timestamp: z.union([z.string(), z.number()]).optional(),
    created_at: z.string().max(60).optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

const TOLERANCE_SECONDS = 600;

function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const stripe = /t=(\d+)\s*,\s*v1=([a-f0-9]+)/i.exec(header);
  if (stripe) {
    const timestamp = Number(stripe[1]);
    const received = (stripe[2] ?? "").toLowerCase();
    if (Number.isFinite(timestamp)) {
      const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
      if (age > TOLERANCE_SECONDS) return false;
    }
    const expected = createHmac("sha256", secret)
      .update(`${stripe[1]}.${rawBody}`)
      .digest("hex");
    return safeEqual(received, expected);
  }
  const received = header.replace(/^sha256=/i, "").trim();
  const hex = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (safeEqual(received.toLowerCase(), hex)) return true;
  const b64 = createHmac("sha256", secret).update(rawBody).digest("base64");
  return safeEqual(received, b64);
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function pickNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : null;
    if (n !== null && Number.isFinite(n)) return n;
  }
  return null;
}

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

async function logEvent(
  admin: AdminClient,
  row: {
    event: string;
    reference: string | null;
    paytedPaymentId: string | null;
    signatureValid: boolean;
    handled: boolean;
    note: string | null;
    payload: unknown;
  },
) {
  const { error } = await admin.from("payted_webhook_events").insert({
    event: row.event,
    reference: row.reference,
    payted_payment_id: row.paytedPaymentId,
    signature_valid: row.signatureValid,
    handled: row.handled,
    note: row.note,
    payload: (row.payload ?? {}) as never,
  });
  if (error) console.error("payted webhook log error", error.message);
}

export const Route = createFileRoute("/api/public/webhooks/payted")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PAYTED_WEBHOOK_SECRET"];
        if (!secret) {
          return Response.json({ error: "integration_not_configured" }, { status: 503 });
        }

        const rawBody = await request.text();
        const signature =
          request.headers.get("x-payted-signature") ??
          request.headers.get("x-signature") ??
          request.headers.get("x-webhook-signature");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (!verifySignature(rawBody, signature, secret)) {
          await logEvent(supabaseAdmin, {
            event: "invalid_signature",
            reference: null,
            paytedPaymentId: null,
            signatureValid: false,
            handled: false,
            note: `headers: ${[...request.headers.keys()].join(",")}`,
            payload: {},
          });
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

        const envelope = parsed.data;
        const inner = (envelope.data ?? {}) as Record<string, unknown>;
        const eventName = envelope.event ?? envelope.type ?? "unknown";
        const reference = pickString(
          inner["referencia_externa"],
          inner["reference"],
          (envelope as Record<string, unknown>)["referencia_externa"],
          (envelope as Record<string, unknown>)["reference"],
        );
        const paytedPaymentId = pickString(
          inner["pagamento_id"],
          inner["id"],
          inner["transfer_id"],
        );
        const providerTransactionId = pickString(
          inner["transacao_id"],
          inner["transaction_id"],
          paytedPaymentId,
        );
        const fee = pickNumber(inner["taxa"], inner["fee"]);
        const net = pickNumber(inner["valor_liquido"], inner["net_amount"]);

        if (!reference) {
          await logEvent(supabaseAdmin, {
            event: eventName,
            reference: null,
            paytedPaymentId,
            signatureValid: true,
            handled: false,
            note: "sem referência externa",
            payload: body,
          });
          return Response.json({ error: "missing_reference" }, { status: 400 });
        }

        const { normalizePaytedStatus, settlePaytedDeposit, refundPaytedHold } = await import(
          "@/lib/payments/payted.server"
        );

        const statusFromEvent = eventName.endsWith(".completed")
          ? "paid"
          : eventName.endsWith(".failed") ||
              eventName.endsWith(".cancelled") ||
              eventName.endsWith(".canceled")
            ? "failed"
            : normalizePaytedStatus(pickString(inner["status"]));

        if (statusFromEvent === "pending") {
          await logEvent(supabaseAdmin, {
            event: eventName,
            reference,
            paytedPaymentId,
            signatureValid: true,
            handled: true,
            note: "evento intermédio: ledger inalterado",
            payload: body,
          });
          return Response.json({ ok: true });
        }

        const { data: intent } = await supabaseAdmin
          .from("payment_intents")
          .select("id, user_id, wallet_id, direction, provider, method, amount, status")
          .eq("reference", reference)
          .eq("provider", "payted")
          .maybeSingle();

        if (!intent) {
          await logEvent(supabaseAdmin, {
            event: eventName,
            reference,
            paytedPaymentId,
            signatureValid: true,
            handled: false,
            note: "referência desconhecida",
            payload: body,
          });
          return Response.json({ error: "unknown_reference" }, { status: 404 });
        }

        const amount = Number(intent.amount);

        if (statusFromEvent === "failed") {
          if (intent.direction === "withdrawal" && intent.status === "pending") {
            await refundPaytedHold(supabaseAdmin, intent.wallet_id as string, amount, reference);
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
          await logEvent(supabaseAdmin, {
            event: eventName,
            reference,
            paytedPaymentId,
            signatureValid: true,
            handled: true,
            note: intent.direction === "withdrawal" ? "reserva devolvida" : "depósito falhado",
            payload: body,
          });
          return Response.json({ ok: true });
        }

        // Pago. Depósito credita agora (idempotente); no levantamento o débito
        // já foi lançado na reserva, pelo que apenas fechamos a intenção.
        if (intent.direction === "deposit") {
          const settled = await settlePaytedDeposit(supabaseAdmin, {
            reference,
            walletId: intent.wallet_id as string,
            userId: intent.user_id as string,
            amount,
            providerTransactionId,
            ...(fee !== null ? { fee } : {}),
            ...(net !== null ? { netAmount: net } : {}),
            source: "webhook",
          });
          if (!settled) {
            await logEvent(supabaseAdmin, {
              event: eventName,
              reference,
              paytedPaymentId,
              signatureValid: true,
              handled: false,
              note: "falha no lançamento do ledger",
              payload: body,
            });
            return Response.json({ error: "ledger_error" }, { status: 500 });
          }
        } else {
          await supabaseAdmin
            .from("payment_intents")
            .update({
              status: "succeeded",
              ...(providerTransactionId
                ? { provider_transaction_id: providerTransactionId }
                : {}),
              ...(fee !== null ? { provider_fee: fee } : {}),
              ...(net !== null ? { net_amount: net } : {}),
            })
            .eq("id", intent.id);
        }

        await logEvent(supabaseAdmin, {
          event: eventName,
          reference,
          paytedPaymentId,
          signatureValid: true,
          handled: true,
          note: intent.direction === "deposit" ? "depósito creditado" : "payout concluído",
          payload: body,
        });
        return Response.json({ ok: true });
      },
    },
  },
});
