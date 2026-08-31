import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Iniciação de pagamentos NetShop.
 *
 * O frontend nunca credita nem debita: estas funções registam uma intenção
 * `pending`, chamam a API NetShop (cobrança C2B / checkout de cartão / payout
 * B2C) e devolvem a referência. O saldo só muda quando o webhook assinado
 * (`/api/public/webhooks/netshop`) confirma o pagamento.
 *
 * Taxas: 0 MZN para o cliente em depósitos e levantamentos. A comissão do
 * agregador (atualmente 10% em cobranças C2B) é custo operacional da
 * plataforma e é registada à parte, nunca descontada ao cliente.
 */

const intentInput = z.object({
  method: z.enum(["mpesa", "emola", "mkesh", "card", "bank_transfer"]),
  amount: z.number().positive().max(1_000_000),
  payerIdentifier: z.string().min(6).max(64).optional(),
});

type IntentResult =
  | { ok: false; error: "not_configured" | "no_wallet" | "insufficient_funds" | "identifier_required" | "failed" }
  | { ok: true; reference: string; status: "pending"; checkoutUrl: string | null };

function isConfigured(): boolean {
  return Boolean(
    process.env["NETSHOP_WALLET_ID"] &&
      process.env["NETSHOP_API_KEY"] &&
      process.env["NETSHOP_WEBHOOK_SECRET"],
  );
}

function makeReference(direction: "deposit" | "withdrawal"): string {
  return `${direction === "deposit" ? "dep" : "wdr"}_${crypto.randomUUID().replace(/-/g, "")}`;
}

/** Estado da integração, lido do servidor — nunca presumido no browser. */
export const getPaymentsStatus = createServerFn({ method: "GET" }).handler(async () => ({
  configured: isConfigured(),
  customerFeePercent: 0,
  currency: "MZN" as const,
}));

export const createDepositIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => intentInput.parse(input))
  .handler(async ({ data, context }): Promise<IntentResult> => {
    if (!isConfigured()) return { ok: false, error: "not_configured" };

    // Mobile money exige o número do pagador; cartão usa checkout alojado.
    if (data.method !== "card" && !data.payerIdentifier) {
      return { ok: false, error: "identifier_required" };
    }

    const { data: wallet } = await context.supabase
      .from("wallets")
      .select("id")
      .eq("user_id", context.userId)
      .eq("kind", "betting")
      .maybeSingle();
    if (!wallet) return { ok: false, error: "no_wallet" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const reference = makeReference("deposit");

    const { error } = await supabaseAdmin.from("payment_intents").insert({
      user_id: context.userId,
      wallet_id: wallet.id,
      direction: "deposit",
      method: data.method,
      amount: data.amount,
      reference,
      ...(data.payerIdentifier ? { payer_identifier: data.payerIdentifier } : {}),
    });
    if (error) {
      console.error("deposit intent error", error.message);
      return { ok: false, error: "failed" };
    }

    const netshop = await import("@/lib/payments/netshop.server");
    const charge =
      data.method === "card"
        ? await netshop.initiateCardCheckout({ amount: data.amount, reference })
        : await netshop.initiateCharge({
            method: data.method,
            amount: data.amount,
            reference,
            payerIdentifier: data.payerIdentifier!,
          });

    if (!charge.ok) {
      await supabaseAdmin
        .from("payment_intents")
        .update({ status: "failed" })
        .eq("reference", reference);
      return { ok: false, error: "failed" };
    }

    if (charge.transactionId) {
      await supabaseAdmin
        .from("payment_intents")
        .update({ provider_transaction_id: charge.transactionId })
        .eq("reference", reference);
    }

    return { ok: true, reference, status: "pending", checkoutUrl: charge.checkoutUrl };
  });

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => intentInput.parse(input))
  .handler(async ({ data, context }): Promise<IntentResult> => {
    if (!isConfigured()) return { ok: false, error: "not_configured" };
    if (!data.payerIdentifier) return { ok: false, error: "identifier_required" };

    const { data: wallet } = await context.supabase
      .from("wallets")
      .select("id, balance")
      .eq("user_id", context.userId)
      .eq("kind", "betting")
      .maybeSingle();
    if (!wallet) return { ok: false, error: "no_wallet" };
    if (Number(wallet.balance) < data.amount) return { ok: false, error: "insufficient_funds" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const reference = makeReference("withdrawal");

    // Reserva do valor: sai do disponível, mas não do património do cliente
    // até o payout ser confirmado pelo provedor.
    const { error: holdError } = await supabaseAdmin.rpc("wallet_apply", {
      _wallet_id: wallet.id,
      _type: "withdrawal",
      _amount: -data.amount,
      _reference: `netshop:${reference}:hold`,
      _provider: "netshop",
    });
    if (holdError) {
      console.error("withdrawal hold error", holdError.message);
      return { ok: false, error: "insufficient_funds" };
    }

    const { error } = await supabaseAdmin.from("payment_intents").insert({
      user_id: context.userId,
      wallet_id: wallet.id,
      direction: "withdrawal",
      method: data.method,
      amount: data.amount,
      reference,
      payer_identifier: data.payerIdentifier,
    });
    if (error) {
      console.error("withdrawal intent error", error.message);
      await refundHold(supabaseAdmin, wallet.id, data.amount, reference);
      return { ok: false, error: "failed" };
    }

    const netshop = await import("@/lib/payments/netshop.server");
    const payout = await netshop.initiatePayout({
      method: data.method,
      amount: data.amount,
      reference,
      payeeIdentifier: data.payerIdentifier,
    });

    if (!payout.ok) {
      await supabaseAdmin
        .from("payment_intents")
        .update({ status: "failed" })
        .eq("reference", reference);
      await refundHold(supabaseAdmin, wallet.id, data.amount, reference);
      return { ok: false, error: "failed" };
    }

    if (payout.transactionId) {
      await supabaseAdmin
        .from("payment_intents")
        .update({ provider_transaction_id: payout.transactionId })
        .eq("reference", reference);
    }

    return { ok: true, reference, status: "pending", checkoutUrl: null };
  });

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

/** Reembolsa a reserva quando a intenção falha antes de chegar à NetShop. */
async function refundHold(
  admin: AdminClient,
  walletId: string,
  amount: number,
  reference: string,
): Promise<void> {
  const { error } = await admin.rpc("wallet_apply", {
    _wallet_id: walletId,
    _type: "refund",
    _amount: amount,
    _reference: `netshop:${reference}:refund`,
    _provider: "netshop",
    _metadata: { reason: "initiation_failed" },
  });
  if (error) console.error("withdrawal refund error", error.message);
}
