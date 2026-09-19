import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Iniciação e reconciliação de pagamentos NetShop.
 *
 * O frontend nunca credita nem debita: estas funções registam uma intenção
 * `pending`, chamam a API NetShop (`POST /charges` ou `POST /payouts`) e
 * devolvem a referência. O saldo só muda quando o webhook assinado
 * (`/api/public/webhooks/netshop`) ou a reconciliação por
 * `GET /charges|/payouts/{ref}` confirmam o estado terminal.
 *
 * Taxas: 0 MZN para o cliente. A comissão do agregador é custo operacional da
 * plataforma e nunca é descontada ao cliente.
 */

const METHODS = ["mpesa", "emola", "mkesh", "card"] as const;
type Method = (typeof METHODS)[number];

/** Mínimos publicados pela NetShop (MZN). */
const MIN_CHARGE: Record<Method, number> = { mpesa: 10, emola: 10, mkesh: 10, card: 50 };
/** Payout B2C existe apenas em M-Pesa e e-Mola. */
const PAYOUT_METHODS = new Set<Method>(["mpesa", "emola"]);

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
  | "amount_below_minimum"
  | "failed";

type IntentResult =
  | { ok: false; error: IntentError; message?: string | null }
  | {
      ok: true;
      reference: string;
      status: "pending" | "paid";
      checkoutUrl: string | null;
      message?: string | null;
    };

/** Wallet NetShop por método (Visa/cartão, M-Pesa, mKesh, e-Mola). */
const WALLET_ENV: Record<Method, string> = {
  card: "NETSHOP_WALLET_ID_CARD",
  mpesa: "NETSHOP_WALLET_ID_MPESA",
  emola: "NETSHOP_WALLET_ID_EMOLA",
  mkesh: "NETSHOP_WALLET_ID_MKESH",
};

function walletIdFor(method: Method): string | null {
  const own = process.env[WALLET_ENV[method]];
  if (own) return own;
  // Com wallets específicas configuradas, um método sem a sua wallet fica
  // indisponível — reutilizar a wallet de outro método faz a API recusar.
  if (Object.values(WALLET_ENV).some((name) => Boolean(process.env[name]))) return null;
  return process.env["NETSHOP_WALLET_ID"] || null;
}

/** Método utilizável = wallet própria (ou fallback) + API key + webhook secret. */

function isMethodConfigured(method: Method): boolean {
  return Boolean(
    walletIdFor(method) &&
      process.env["NETSHOP_API_KEY"] &&
      process.env["NETSHOP_WEBHOOK_SECRET"],
  );
}

function isConfigured(): boolean {
  return METHODS.some(isMethodConfigured);
}

function makeReference(direction: "deposit" | "withdrawal"): string {
  return `${direction === "deposit" ? "dep" : "wdr"}_${crypto.randomUUID().replace(/-/g, "")}`;
}

/** Prefixos MSISDN por operador em Moçambique. */
const MSISDN_RULE: Record<Method, RegExp | null> = {
  mpesa: /^(?:\+?258)?8[45]\d{7}$/,
  emola: /^(?:\+?258)?8[67]\d{7}$/,
  mkesh: /^(?:\+?258)?8[23]\d{7}$/,
  card: null,
};

/** Normaliza para o formato E.164 aceite pela API (+258…). */
function normalizeMsisdn(method: Method, raw: string): string | null {
  const value = raw.replace(/[\s-]/g, "");
  const rule = MSISDN_RULE[method];
  if (!rule || !rule.test(value)) return null;
  return `+258${value.replace(/^\+?258/, "")}`;
}

/**
 * Payment router: e-Mola é servido pela PayTED; os restantes métodos continuam
 * exactamente como estão, na NetShop.
 */
function paytedHandlesEmola(): boolean {
  return Boolean(
    process.env["PAYTED_SECRET_KEY"] &&
      process.env["PAYTED_APP_ID"] &&
      process.env["PAYTED_WEBHOOK_SECRET"],
  );
}

/** Estado da integração, lido do servidor — nunca presumido no browser. */
export const getPaymentsStatus = createServerFn({ method: "GET" }).handler(async () => {
  const methods = {
    mpesa: isMethodConfigured("mpesa"),
    emola: paytedHandlesEmola() || isMethodConfigured("emola"),
    mkesh: isMethodConfigured("mkesh"),
    card: isMethodConfigured("card"),
  };
  const configured = isConfigured() || paytedHandlesEmola();
  if (!configured) {
    return {
      configured: false,
      gatewayOnline: false,
      methods,
      customerFeePercent: 0,
      currency: "MZN" as const,
    };
  }
  const netshop = await import("@/lib/payments/netshop.server");
  const health = await netshop.ping();
  return {
    configured: true,
    methods,
    gatewayOnline: health.ok && health.canonicalHost,
    customerFeePercent: 0,
    currency: "MZN" as const,
  };
});

export const createDepositIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => intentInput.parse(input))
  .handler(async ({ data, context }): Promise<IntentResult> => {
    // e-Mola → PayTED (gateway dedicado). Restantes métodos → NetShop.
    if (data.method === "emola" && paytedHandlesEmola()) {
      const payted = await import("@/lib/payments/payted.server");
      return payted.paytedDeposit({
        userId: context.userId,
        amount: data.amount,
        payerIdentifier: data.payerIdentifier,
      });
    }
    if (!isMethodConfigured(data.method)) return { ok: false, error: "not_configured" };
    if (data.amount < MIN_CHARGE[data.method]) return { ok: false, error: "amount_below_minimum" };

    let msisdn: string | null = null;
    if (data.method !== "card") {
      if (!data.payerIdentifier) return { ok: false, error: "identifier_required" };
      msisdn = normalizeMsisdn(data.method, data.payerIdentifier);
      if (!msisdn) return { ok: false, error: "invalid_identifier" };
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
      ...(msisdn ? { payer_identifier: msisdn } : {}),
    });
    if (error) {
      console.error("deposit intent error", error.message);
      return { ok: false, error: "failed" };
    }

    const netshop = await import("@/lib/payments/netshop.server");
    const charge = await netshop.createCharge({
      method: data.method,
      amount: data.amount,
      reference,
      ...(msisdn ? { msisdn } : {}),
      ...(data.returnUrl ? { returnUrl: data.returnUrl } : {}),
      metadata: { user_id: context.userId, wallet_id: walletId },
    });

    if (!charge.ok) {
      await supabaseAdmin
        .from("payment_intents")
        .update({ status: "failed" })
        .eq("reference", reference);
      return { ok: false, error: "failed", message: charge.message };
    }

    await supabaseAdmin
      .from("payment_intents")
      .update({
        ...(charge.providerTransactionId
          ? { provider_transaction_id: charge.providerTransactionId }
          : charge.id
            ? { provider_transaction_id: charge.id }
            : {}),
      })
      .eq("reference", reference);

    // Resposta síncrona já paga: aplica o crédito com a mesma referência
    // idempotente que o webhook usaria.
    if (charge.status === "paid") {
      await settleDeposit(supabaseAdmin, {
        intentReference: reference,
        walletId,
        amount: data.amount,
        method: data.method,
        providerTransactionId: charge.providerTransactionId ?? charge.id,
      });
      return { ok: true, reference, status: "paid", checkoutUrl: null };
    }

    if (charge.status === "failed") {
      await supabaseAdmin
        .from("payment_intents")
        .update({ status: "failed" })
        .eq("reference", reference);
      return { ok: false, error: "failed", message: charge.message };
    }

    return { ok: true, reference, status: "pending", checkoutUrl: charge.checkoutUrl, message: charge.message };
  });

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => intentInput.parse(input))
  .handler(async ({ data, context }): Promise<IntentResult> => {
    // Levantamento e-Mola → PayTED. M-Pesa e restantes → NetShop, sem alteração.
    if (data.method === "emola" && paytedHandlesEmola()) {
      const payted = await import("@/lib/payments/payted.server");
      return payted.paytedWithdrawal({
        userId: context.userId,
        amount: data.amount,
        payerIdentifier: data.payerIdentifier,
      });
    }
    if (!isMethodConfigured(data.method)) return { ok: false, error: "not_configured" };
    if (!PAYOUT_METHODS.has(data.method)) return { ok: false, error: "method_unavailable" };
    if (!data.payerIdentifier) return { ok: false, error: "identifier_required" };
    const msisdn = normalizeMsisdn(data.method, data.payerIdentifier);
    if (!msisdn) return { ok: false, error: "invalid_identifier" };

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

    // Reserva do valor: sai do disponível, mas só é definitivo quando o
    // provedor confirmar `payout.completed`.
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
      payer_identifier: msisdn,
    });
    if (error) {
      console.error("withdrawal intent error", error.message);
      await refundHold(supabaseAdmin, wallet.id, data.amount, reference);
      return { ok: false, error: "failed" };
    }

    const netshop = await import("@/lib/payments/netshop.server");
    const payout = await netshop.createPayout({
      method: data.method as "mpesa" | "emola",
      amount: data.amount,
      reference,
      msisdn,
      metadata: { user_id: context.userId, wallet_id: wallet.id },
    });

    if (!payout.ok || payout.status === "failed") {
      await supabaseAdmin
        .from("payment_intents")
        .update({ status: "failed" })
        .eq("reference", reference);
      await refundHold(supabaseAdmin, wallet.id, data.amount, reference);
      return {
        ok: false,
        error: "failed",
        message: payout.ok ? payout.message : payout.message,
      };
    }

    const providerId = payout.providerTransactionId ?? payout.id;
    if (providerId) {
      await supabaseAdmin
        .from("payment_intents")
        .update({ provider_transaction_id: providerId })
        .eq("reference", reference);
    }

    if (payout.status === "paid") {
      await supabaseAdmin
        .from("payment_intents")
        .update({ status: "succeeded" })
        .eq("reference", reference);
      return { ok: true, reference, status: "paid", checkoutUrl: null };
    }

    return { ok: true, reference, status: "pending", checkoutUrl: null };
  });

/**
 * Reconciliação: consulta a NetShop pelo estado real da intenção e aplica o
 * ledger se já for terminal. Usado pelo cliente enquanto a intenção está
 * `pending` (polling) e após o regresso do checkout de cartão.
 */
export const syncPaymentIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ reference: z.string().min(6).max(120) }).parse(input),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ status: "pending" | "succeeded" | "failed" | "unknown"; message?: string | null }> => {
      const { data: intent } = await context.supabase
        .from("payment_intents")
        .select(
          "id, wallet_id, direction, method, amount, status, reference, provider_transaction_id",
        )
        .eq("reference", data.reference)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!intent) return { status: "unknown" };
      if (intent.status === "succeeded") return { status: "succeeded" };
      if (intent.status === "expired") return { status: "failed" };

      const netshop = await import("@/lib/payments/netshop.server");
      const lookupIds = [intent.reference as string];
      if (
        typeof intent.provider_transaction_id === "string" &&
        intent.provider_transaction_id &&
        intent.provider_transaction_id !== intent.reference
      ) {
        lookupIds.push(intent.provider_transaction_id);
      }

      // Alguns operadores móveis concluem o débito depois de a cobrança ter
      // recebido `timeout_no_callback`. Nesses casos a NetShop pode atualizar
      // primeiro o identificador da operação e só depois a referência do
      // comerciante. Consultamos ambos e damos precedência ao estado `paid`.
      const remoteResults = await Promise.all(
        lookupIds.map((id) =>
          intent.direction === "deposit"
            ? netshop.getCharge(id, intent.method as Method)
            : netshop.getPayout(id, intent.method as Method),
        ),
      );
      const successfulResults = remoteResults.filter((result) => result.ok);
      const remote =
        successfulResults.find((result) => result.ok && result.status === "paid") ??
        successfulResults.find((result) => result.ok && result.status === "pending") ??
        successfulResults[0];

      if (!remote || !remote.ok) {
        return { status: intent.status === "failed" ? "failed" : "pending" };
      }
      if (remote.status === "pending") return { status: "pending", message: remote.message };

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const amount = Number(intent.amount);
      const walletId = intent.wallet_id as string;
      const providerId = remote.providerTransactionId ?? remote.id;

      if (remote.status === "paid") {
        if (intent.direction === "deposit") {
          await settleDeposit(supabaseAdmin, {
            intentReference: intent.reference as string,
            walletId,
            amount,
            method: intent.method as string,
            providerTransactionId: providerId,
          });
        } else {
          await supabaseAdmin
            .from("payment_intents")
            .update({
              status: "succeeded",
              ...(providerId ? { provider_transaction_id: providerId } : {}),
            })
            .eq("id", intent.id);
        }
        return { status: "succeeded" };
      }

      // Falhou: no levantamento a reserva volta ao disponível.
      if (intent.direction === "withdrawal") {
        await refundHold(supabaseAdmin, walletId, amount, intent.reference as string);
      }
      await supabaseAdmin
        .from("payment_intents")
        .update({
          status: "failed",
          ...(providerId ? { provider_transaction_id: providerId } : {}),
        })
        .eq("id", intent.id)
        .eq("status", "pending");
      return { status: "failed", message: remote.message };
    },
  );

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

/** Crédito de depósito — idempotente pela referência `netshop:<ref>`. */
async function settleDeposit(
  admin: AdminClient,
  input: {
    intentReference: string;
    walletId: string;
    amount: number;
    method: string;
    providerTransactionId: string | null;
  },
): Promise<void> {
  const { error } = await admin.rpc("wallet_apply", {
    _wallet_id: input.walletId,
    _type: "deposit",
    _amount: input.amount,
    _reference: `netshop:${input.intentReference}`,
    _provider: "netshop",
    ...(input.providerTransactionId
      ? { _provider_transaction_id: input.providerTransactionId }
      : {}),
    _metadata: { method: input.method, source: "sync" },
  });
  if (error && !/duplicate|unique/i.test(error.message)) {
    console.error("deposit settle error", error.message);
    return;
  }
  await admin
    .from("payment_intents")
    .update({
      status: "succeeded",
      ...(input.providerTransactionId
        ? { provider_transaction_id: input.providerTransactionId }
        : {}),
    })
    .eq("reference", input.intentReference);
}

/** Garante a carteira de apostas do utilizador antes de qualquer depósito. */
async function ensureBettingWallet(admin: AdminClient, userId: string): Promise<string | null> {
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

/** Devolve a reserva ao disponível — idempotente pela referência de reembolso. */
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
    _metadata: { reason: "payout_not_completed" },
  });
  if (error && !/duplicate|unique/i.test(error.message)) {
    console.error("withdrawal refund error", error.message);
  }
}
