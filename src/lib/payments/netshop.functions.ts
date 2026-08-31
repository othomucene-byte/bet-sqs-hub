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

const METHODS = ["mpesa", "emola", "mkesh", "card", "bank_transfer"] as const;
type Method = (typeof METHODS)[number];

const intentInput = z.object({
  method: z.enum(METHODS),
  amount: z.number().positive().max(1_000_000),
  payerIdentifier: z.string().min(6).max(64).optional(),
  returnUrl: z.string().url().max(300).optional(),
});

type IntentError =
  | "not_configured"
  | "no_wallet"
  | "insufficient_funds"
  | "identifier_required"
  | "invalid_identifier"
  | "method_unavailable"
  | "failed";

type IntentResult =
  | { ok: false; error: IntentError; message?: string | null }
  | {
      ok: true;
      reference: string;
      status: "pending";
      checkoutUrl: string | null;
      instructions?: string | null;
    };

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

/** Prefixos MSISDN por operador em Moçambique + formato de conta bancária. */
const IDENTIFIER_RULES: Record<Method, RegExp | null> = {
  mpesa: /^(?:\+?258)?8[45]\d{7}$/,
  emola: /^(?:\+?258)?8[67]\d{7}$/,
  mkesh: /^(?:\+?258)?8[23]\d{7}$/,
  bank_transfer: /^[A-Z0-9]{8,34}$/i,
  card: null,
};

function normalizeIdentifier(method: Method, raw: string): string | null {
  const value = raw.replace(/[\s-]/g, "");
  const rule = IDENTIFIER_RULES[method];
  if (!rule) return value;
  if (!rule.test(value)) return null;
  if (method === "bank_transfer") return value.toUpperCase();
  return value.replace(/^\+?258/, "");
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

    // Mobile money e transferência exigem identificador; cartão usa checkout alojado.
    let identifier: string | null = null;
    if (data.method !== "card") {
      if (!data.payerIdentifier) return { ok: false, error: "identifier_required" };
      identifier = normalizeIdentifier(data.method, data.payerIdentifier);
      if (!identifier) return { ok: false, error: "invalid_identifier" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const walletId = await ensureBettingWallet(supabaseAdmin, context.userId);
    if (!walletId) return { ok: false, error: "no_wallet" };

    const reference = makeReference("deposit");

    const { error } = await supabaseAdmin.from("payment_intents").insert({
      user_id: context.userId,
      wallet_id: walletId,
      direction: "deposit",
      method: data.method,
      amount: data.amount,
      reference,
      ...(identifier ? { payer_identifier: identifier } : {}),
    });
    if (error) {
      console.error("deposit intent error", error.message);
      return { ok: false, error: "failed" };
    }

    const netshop = await import("@/lib/payments/netshop.server");
    const charge =
      data.method === "card"
        ? await netshop.initiateCardCheckout({
            amount: data.amount,
            reference,
            ...(data.returnUrl ? { returnUrl: data.returnUrl } : {}),
          })
        : await netshop.initiateCharge({
            method: data.method,
            amount: data.amount,
            reference,
            payerIdentifier: identifier!,
          });

    if (!charge.ok) {
      await supabaseAdmin
        .from("payment_intents")
        .update({ status: "failed" })
        .eq("reference", reference);
      return { ok: false, error: "failed", message: charge.message };
    }

    if (charge.transactionId) {
      await supabaseAdmin
        .from("payment_intents")
        .update({ provider_transaction_id: charge.transactionId })
        .eq("reference", reference);
    }

    return {
      ok: true,
      reference,
      status: "pending",
      checkoutUrl: charge.checkoutUrl,
      instructions: charge.instructions,
    };
  });

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => intentInput.parse(input))
  .handler(async ({ data, context }): Promise<IntentResult> => {
    if (!isConfigured()) return { ok: false, error: "not_configured" };
    // Cartão não suporta payout: reembolso de cartão não é levantamento.
    if (data.method === "card") return { ok: false, error: "method_unavailable" };
    if (!data.payerIdentifier) return { ok: false, error: "identifier_required" };
    const identifier = normalizeIdentifier(data.method, data.payerIdentifier);
    if (!identifier) return { ok: false, error: "invalid_identifier" };

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
      payer_identifier: identifier,
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
      payeeIdentifier: identifier,
    });

    if (!payout.ok) {
      await supabaseAdmin
        .from("payment_intents")
        .update({ status: "failed" })
        .eq("reference", reference);
      await refundHold(supabaseAdmin, wallet.id, data.amount, reference);
      return { ok: false, error: "failed", message: payout.message };
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

/** Garante a carteira de apostas do utilizador antes de qualquer depósito. */
async function ensureBettingWallet(
  admin: AdminClient,
  userId: string,
): Promise<string | null> {
  const { data: existing } = await admin
    .from("wallets")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "betting")
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data: created, error } = await admin
    .from("wallets")
    .insert({ user_id: userId, kind: "betting" })
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("wallet create error", error.message);
    return null;
  }
  return (created?.id as string) ?? null;
}

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
