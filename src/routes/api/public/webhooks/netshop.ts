import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

/**
 * Webhook NetShop — única autoridade para confirmar pagamentos.
 *
 * Regras:
 *  - Assinatura HMAC-SHA256 sobre o corpo cru é verificada ANTES de qualquer
 *    leitura do payload.
 *  - Idempotência garantida pelo `reference` único no ledger (`wallet_apply`).
 *  - Sem `NETSHOP_WEBHOOK_SECRET` configurado a rota responde 503: nada é
 *    creditado com base em pressupostos.
 */

const payloadSchema = z.object({
  event: z.enum(["payment.succeeded", "payment.failed", "payout.succeeded", "payout.failed"]),
  reference: z.string().min(6).max(120),
  transaction_id: z.string().min(1).max(120),
  amount: z.number().positive().max(10_000_000),
  currency: z.literal("MZN"),
  method: z.string().min(2).max(40).optional(),
});

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = Buffer.from(signature.replace(/^sha256=/, ""), "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (received.length !== expectedBuf.length) return false;
  return timingSafeEqual(received, expectedBuf);
}

export const Route = createFileRoute("/api/public/webhooks/netshop")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["NETSHOP_WEBHOOK_SECRET"];
        if (!secret) {
          return Response.json(
            { error: "integration_not_configured" },
            { status: 503 },
          );
        }

        const rawBody = await request.text();
        const signature =
          request.headers.get("x-netshop-signature") ?? request.headers.get("x-signature");

        if (!verifySignature(rawBody, signature, secret)) {
          return Response.json({ error: "invalid_signature" }, { status: 401 });
        }

        const parsed = payloadSchema.safeParse(JSON.parse(rawBody));
        if (!parsed.success) {
          return Response.json({ error: "invalid_payload" }, { status: 400 });
        }
        const event = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // A intenção de pagamento foi criada pelo backend com este `reference`.
        const { data: intent } = await supabaseAdmin
          .from("payment_intents")
          .select("id, wallet_id, direction, amount, status")
          .eq("reference", event.reference)
          .maybeSingle();

        if (!intent) {
          return Response.json({ error: "unknown_reference" }, { status: 404 });
        }

        const failed = event.event.endsWith(".failed");

        if (failed) {
          await supabaseAdmin
            .from("payment_intents")
            .update({ status: "failed", provider_transaction_id: event.transaction_id })
            .eq("id", intent.id)
            .eq("status", "pending");
          return Response.json({ ok: true });
        }

        // O depósito credita agora; no levantamento o débito já foi lançado na
        // reserva, pelo que a confirmação só fecha a intenção.
        if (intent.direction === "deposit") {
          const { error } = await supabaseAdmin.rpc("wallet_apply", {
            _wallet_id: intent.wallet_id,
            _type: "deposit",
            _amount: Number(intent.amount),
            _reference: `netshop:${event.reference}`,
            _provider: "netshop",
            _provider_transaction_id: event.transaction_id,
            _metadata: { method: event.method ?? null, event: event.event },
          });

          if (error) {
            console.error("netshop webhook ledger error", error.message);
            return Response.json({ error: "ledger_error" }, { status: 500 });
          }
        }

        await supabaseAdmin
          .from("payment_intents")
          .update({ status: "succeeded", provider_transaction_id: event.transaction_id })
          .eq("id", intent.id);

        return Response.json({ ok: true });
      },
    },
  },
});
