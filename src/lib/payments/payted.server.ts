/**
 * PayTED — gateway EXCLUSIVO de e-Mola (server-only).
 *
 * Base URL oficial: https://pay.ted.co.mz/api
 * Endpoints usados (documentação/SDK oficiais):
 *  - POST /debit                              → débito directo e-Mola (push/PIN)
 *  - GET  /debit/status/{pagamento_id}        → estado por id PayTED
 *  - GET  /debit/status-by-reference/{ref}    → estado pela nossa referência
 *  - POST /v1/transfers                       → transferência B2C e-Mola (payout)
 *
 * Autenticação: `Authorization: Bearer <PAYTED_SECRET_KEY>` (pk_prod_/pk_test_).
 * Webhook: `X-Payted-Signature`, HMAC-SHA256 (ver /api/public/webhooks/payted).
 *
 * Regras invioláveis:
 *  - o saldo só muda por confirmação do gateway (webhook ou GET de estado);
 *  - todo o dinheiro passa pela wallet + ledger existentes (`wallet_apply`);
 *  - idempotência pela referência única da intenção;
 *  - taxa do gateway é custo da plataforma: o cliente paga/recebe 0 MZN de taxa.
 *
 * Nada deste módulo pode chegar ao browser.
 */

const API_BASE = "https://pay.ted.co.mz/api";

type Json = Record<string, unknown>;

export type PaytedStatus = "paid" | "pending" | "failed";

export type PaytedOperation = {
  id: string | null;
  status: PaytedStatus;
  providerTransactionId: string | null;
  fee: number;
  netAmount: number | null;
  message: string | null;
};

export type PaytedResult =
  | ({ ok: true } & PaytedOperation)
  | { ok: false; httpStatus: number; code: string | null; message: string | null };

/** Credenciais presentes no servidor? */
export function isPaytedConfigured(): boolean {
  return Boolean(
    process.env["PAYTED_SECRET_KEY"] &&
      process.env["PAYTED_APP_ID"] &&
      process.env["PAYTED_WEBHOOK_SECRET"],
  );
}

export const PAYTED_REQUIRED_SECRETS = [
  "PAYTED_SECRET_KEY",
  "PAYTED_PUBLISH_KEY",
  "PAYTED_APP_ID",
  "PAYTED_WEBHOOK_SECRET",
] as const;

/** Mínimo aceite pela rede e-Mola através da PayTED (MZN). */
export const PAYTED_MIN_AMOUNT = 10;

function asObject(value: unknown): Json | null {
  return value && typeof value === "object" ? (value as Json) : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function num(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : null;
  return n !== null && Number.isFinite(n) ? n : null;
}

function message(data: Json): string | null {
  const error = asObject(data["error"]);
  for (const value of [
    str(data["erro"]),
    str(data["mensagem"]),
    error ? str(error["message"]) : null,
    str(data["message"]),
    str(data["detail"]),
  ]) {
    if (value) return value.slice(0, 200);
  }
  return null;
}

/** Erros de validação estilo Laravel: { message, errors: { campo: [msg] } }. */
function validationDetails(data: Json): string | null {
  const errors = asObject(data["errors"]);
  if (!errors) return null;
  const parts: string[] = [];
  for (const [field, msgs] of Object.entries(errors)) {
    const list = Array.isArray(msgs) ? msgs : [msgs];
    for (const m of list) {
      if (typeof m === "string" && m.trim()) parts.push(`${field}: ${m.trim()}`);
    }
  }
  return parts.length ? parts.join(" | ").slice(0, 400) : null;
}

/** Estados PayTED: `pago`/`completed` pago; `erro`/`failed`/`cancelled` falhado. */
export function normalizePaytedStatus(raw: string | null): PaytedStatus {
  const value = (raw ?? "").toLowerCase();
  if (["pago", "paid", "completed", "success", "sucesso"].includes(value)) return "paid";
  if (["erro", "error", "failed", "falhou", "cancelled", "canceled", "expired"].includes(value)) {
    return "failed";
  }
  return "pending";
}

function parseOperation(data: Json): PaytedOperation {
  const inner = asObject(data["data"]) ?? data;
  const fee = num(inner["taxa"]) ?? num(inner["fee"]) ?? 0;
  const net = num(inner["valor_liquido"]) ?? num(inner["net_amount"]);
  const statusRaw = str(inner["status"]);
  const explicitFailure = inner["success"] === false;
  return {
    id: str(inner["pagamento_id"]) ?? str(inner["id"]),
    status: explicitFailure ? "failed" : normalizePaytedStatus(statusRaw),
    providerTransactionId: str(inner["transacao_id"]) ?? str(inner["transaction_id"]),
    fee,
    netAmount: net,
    message: message(inner) ?? message(data),
  };
}

async function request(
  method: "GET" | "POST",
  path: string,
  options: { body?: Json; idempotencyKey?: string } = {},
): Promise<PaytedResult> {
  const secret = process.env["PAYTED_SECRET_KEY"];
  if (!secret) return { ok: false, httpStatus: 0, code: "not_configured", message: null };

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${secret}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });

    const data = (await res.json().catch(() => ({}))) as Json;
    if (!res.ok) {
      // Nunca registamos chaves nem PIN: apenas rota, código e mensagem.
      console.error("payted api error", method, path, res.status, message(data) ?? "");
      const error = asObject(data["error"]);
      return {
        ok: false,
        httpStatus: res.status,
        code: str(data["codigo_erro"]) ?? (error ? str(error["code"]) : null) ?? str(data["error"]),
        message: message(data),
      };
    }
    return { ok: true, ...parseOperation(data) };
  } catch (err) {
    console.error("payted request failed", path, err instanceof Error ? err.message : err);
    return { ok: false, httpStatus: 0, code: "network_error", message: null };
  }
}

function appId(): number {
  return Number(process.env["PAYTED_APP_ID"] ?? 0);
}

/** Número e-Mola no formato local aceite pela PayTED (86/87 + 7 dígitos). */
export function normalizeEmolaNumber(raw: string): string | null {
  const value = raw.replace(/[\s-]/g, "").replace(/^\+?258/, "");
  return /^8[67]\d{7}$/.test(value) ? value : null;
}

/** Débito directo e-Mola: o cliente confirma com PIN no telemóvel. */
export function createEmolaDebit(input: {
  amount: number;
  reference: string;
  msisdn: string;
  metadata?: Json;
}): Promise<PaytedResult> {
  return request("POST", "/debit", {
    idempotencyKey: input.reference,
    body: {
      app_id: appId(),
      valor_total: Number(input.amount.toFixed(2)),
      referencia_externa: input.reference,
      metodo: "emola",
      numero_cliente: input.msisdn,
      ...(input.metadata ? { metadata: input.metadata } : {}),
    },
  });
}

/** Estado por id PayTED (`TED…`). */
export function getPaytedPayment(paymentId: string): Promise<PaytedResult> {
  return request("GET", `/debit/status/${encodeURIComponent(paymentId)}`);
}

/** Estado pela nossa referência — usado quando o pedido original expirou. */
export function getPaytedPaymentByReference(reference: string): Promise<PaytedResult> {
  return request("GET", `/debit/status-by-reference/${encodeURIComponent(reference)}`);
}

/** Payout (transferência B2C) e-Mola. */
export function createEmolaTransfer(input: {
  amount: number;
  reference: string;
  msisdn: string;
  reason?: string;
}): Promise<PaytedResult> {
  return request("POST", "/v1/transfers", {
    idempotencyKey: input.reference,
    body: {
      amount: Number(input.amount.toFixed(2)),
      currency: "MZN",
      method: "emola",
      to_phone: `258${input.msisdn}`,
      reference: input.reference,
      referencia_externa: input.reference,
      reason: input.reason ?? "Levantamento Betfcom SQs",
    },
  });
}

/* ------------------------------------------------------------------ */
/* Orquestração: intenções, wallet e ledger existentes da Betfcom      */
/* ------------------------------------------------------------------ */

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

export type PaytedIntentResult =
  | {
      ok: false;
      error:
        | "not_configured"
        | "no_wallet"
        | "insufficient_funds"
        | "identifier_required"
        | "invalid_identifier"
        | "amount_below_minimum"
        | "failed";
      message?: string | null;
    }
  | { ok: true; reference: string; status: "pending" | "paid"; checkoutUrl: null; message?: string | null };

function makeReference(direction: "deposit" | "withdrawal"): string {
  return `${direction === "deposit" ? "pdep" : "pwdr"}_${crypto.randomUUID().replace(/-/g, "")}`;
}

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
    console.error("payted wallet create error", error.message);
    return null;
  }
  return (created?.id as string) ?? null;
}

/** Crédito idempotente do depósito (`payted:<ref>`). */
export async function settlePaytedDeposit(
  admin: AdminClient,
  input: {
    reference: string;
    walletId: string;
    userId: string;
    amount: number;
    providerTransactionId: string | null;
    fee?: number;
    netAmount?: number | null;
    source: string;
  },
): Promise<boolean> {
  const { error } = await admin.rpc("wallet_apply", {
    _wallet_id: input.walletId,
    _type: "deposit",
    _amount: input.amount,
    _reference: `payted:${input.reference}`,
    _provider: "payted",
    ...(input.providerTransactionId
      ? { _provider_transaction_id: input.providerTransactionId }
      : {}),
    _metadata: { method: "emola", gateway: "payted", source: input.source },
  });
  if (error && !/duplicate|unique/i.test(error.message)) {
    console.error("payted deposit ledger error", error.message);
    return false;
  }

  await admin
    .from("payment_intents")
    .update({
      status: "succeeded",
      ...(input.providerTransactionId
        ? { provider_transaction_id: input.providerTransactionId }
        : {}),
      ...(typeof input.fee === "number" ? { provider_fee: input.fee } : {}),
      ...(typeof input.netAmount === "number" ? { net_amount: input.netAmount } : {}),
    })
    .eq("reference", input.reference);

  // Bónus de primeiro depósito: idempotente por utilizador.
  const { error: bonusError } = await admin.rpc("grant_first_deposit_bonus", {
    _user_id: input.userId,
    _payment_reference: input.reference,
  });
  if (bonusError) console.error("payted bonus error", bonusError.message);
  return true;
}

/** Devolve a reserva de um payout que não se concluiu (idempotente). */
export async function refundPaytedHold(
  admin: AdminClient,
  walletId: string,
  amount: number,
  reference: string,
): Promise<void> {
  const { error } = await admin.rpc("wallet_apply", {
    _wallet_id: walletId,
    _type: "refund",
    _amount: amount,
    _reference: `payted:${reference}:refund`,
    _provider: "payted",
    _metadata: { gateway: "payted", reason: "payout_not_completed" },
  });
  if (error && !/duplicate|unique/i.test(error.message)) {
    console.error("payted refund error", error.message);
  }
}

/** Depósito e-Mola via PayTED. Nada é creditado sem confirmação do gateway. */
export async function paytedDeposit(input: {
  userId: string;
  amount: number;
  payerIdentifier?: string | undefined;
}): Promise<PaytedIntentResult> {
  if (!isPaytedConfigured()) return { ok: false, error: "not_configured" };
  if (input.amount < PAYTED_MIN_AMOUNT) return { ok: false, error: "amount_below_minimum" };
  if (!input.payerIdentifier) return { ok: false, error: "identifier_required" };
  const msisdn = normalizeEmolaNumber(input.payerIdentifier);
  if (!msisdn) return { ok: false, error: "invalid_identifier" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const walletId = await ensureBettingWallet(supabaseAdmin, input.userId);
  if (!walletId) return { ok: false, error: "no_wallet" };

  const reference = makeReference("deposit");
  const { error: insertError } = await supabaseAdmin.from("payment_intents").insert({
    user_id: input.userId,
    wallet_id: walletId,
    direction: "deposit",
    provider: "payted",
    method: "emola",
    amount: input.amount,
    reference,
    payer_identifier: `+258${msisdn}`,
  });
  if (insertError) {
    console.error("payted deposit intent error", insertError.message);
    return { ok: false, error: "failed" };
  }

  const debit = await createEmolaDebit({
    amount: input.amount,
    reference,
    msisdn,
    metadata: { user_id: input.userId, wallet_id: walletId },
  });

  if (!debit.ok) {
    await supabaseAdmin
      .from("payment_intents")
      .update({ status: "failed" })
      .eq("reference", reference);
    return { ok: false, error: "failed", message: debit.message };
  }

  const providerId = debit.providerTransactionId ?? debit.id;
  await supabaseAdmin
    .from("payment_intents")
    .update({
      ...(providerId ? { provider_transaction_id: providerId } : {}),
      ...(debit.fee ? { provider_fee: debit.fee } : {}),
      ...(debit.netAmount !== null ? { net_amount: debit.netAmount } : {}),
    })
    .eq("reference", reference);

  if (debit.status === "paid") {
    await settlePaytedDeposit(supabaseAdmin, {
      reference,
      walletId,
      userId: input.userId,
      amount: input.amount,
      providerTransactionId: providerId,
      fee: debit.fee,
      netAmount: debit.netAmount,
      source: "debit_response",
    });
    return { ok: true, reference, status: "paid", checkoutUrl: null };
  }

  if (debit.status === "failed") {
    await supabaseAdmin
      .from("payment_intents")
      .update({ status: "failed" })
      .eq("reference", reference);
    return { ok: false, error: "failed", message: debit.message };
  }

  return { ok: true, reference, status: "pending", checkoutUrl: null, message: debit.message };
}

/** Levantamento e-Mola via PayTED: reserva no ledger antes do payout. */
export async function paytedWithdrawal(input: {
  userId: string;
  amount: number;
  payerIdentifier?: string | undefined;
}): Promise<PaytedIntentResult> {
  if (!isPaytedConfigured()) return { ok: false, error: "not_configured" };
  if (input.amount < PAYTED_MIN_AMOUNT) return { ok: false, error: "amount_below_minimum" };
  if (!input.payerIdentifier) return { ok: false, error: "identifier_required" };
  const msisdn = normalizeEmolaNumber(input.payerIdentifier);
  if (!msisdn) return { ok: false, error: "invalid_identifier" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: wallet } = await supabaseAdmin
    .from("wallets")
    .select("id, balance")
    .eq("user_id", input.userId)
    .eq("kind", "betting")
    .maybeSingle();
  if (!wallet) return { ok: false, error: "no_wallet" };
  if (Number(wallet.balance) < input.amount) return { ok: false, error: "insufficient_funds" };

  const reference = makeReference("withdrawal");
  const walletId = wallet.id as string;

  // Reserva: sai do disponível antes de qualquer chamada ao gateway.
  const { error: holdError } = await supabaseAdmin.rpc("wallet_apply", {
    _wallet_id: walletId,
    _type: "withdrawal",
    _amount: -input.amount,
    _reference: `payted:${reference}:hold`,
    _provider: "payted",
    _metadata: { gateway: "payted", method: "emola" },
  });
  if (holdError) {
    console.error("payted hold error", holdError.message);
    return { ok: false, error: "insufficient_funds" };
  }

  const { error: insertError } = await supabaseAdmin.from("payment_intents").insert({
    user_id: input.userId,
    wallet_id: walletId,
    direction: "withdrawal",
    provider: "payted",
    method: "emola",
    amount: input.amount,
    reference,
    payer_identifier: `+258${msisdn}`,
  });
  if (insertError) {
    console.error("payted withdrawal intent error", insertError.message);
    await refundPaytedHold(supabaseAdmin, walletId, input.amount, reference);
    return { ok: false, error: "failed" };
  }

  const payout = await createEmolaTransfer({ amount: input.amount, reference, msisdn });

  if (!payout.ok || payout.status === "failed") {
    await supabaseAdmin
      .from("payment_intents")
      .update({ status: "failed" })
      .eq("reference", reference);
    await refundPaytedHold(supabaseAdmin, walletId, input.amount, reference);
    return { ok: false, error: "failed", message: payout.message };
  }

  const providerId = payout.providerTransactionId ?? payout.id;
  await supabaseAdmin
    .from("payment_intents")
    .update({
      ...(providerId ? { provider_transaction_id: providerId } : {}),
      ...(payout.fee ? { provider_fee: payout.fee } : {}),
      ...(payout.netAmount !== null ? { net_amount: payout.netAmount } : {}),
      ...(payout.status === "paid" ? { status: "succeeded" } : {}),
    })
    .eq("reference", reference);

  return {
    ok: true,
    reference,
    status: payout.status === "paid" ? "paid" : "pending",
    checkoutUrl: null,
    message: payout.message,
  };
}

/**
 * Reconciliação de uma intenção PayTED contra o gateway. Fonte de verdade:
 * consulta a nossa referência e, se existir, o id PayTED, dando precedência a
 * `paid`. Só aplica o ledger quando o estado é terminal.
 */
export async function syncPaytedIntent(intent: {
  id: string;
  user_id: string;
  wallet_id: string;
  direction: string;
  amount: number | string;
  reference: string;
  status: string;
  provider_transaction_id: string | null;
}): Promise<{ status: "pending" | "succeeded" | "failed"; message?: string | null }> {
  if (!isPaytedConfigured()) return { status: "pending" };

  const lookups: Promise<PaytedResult>[] = [getPaytedPaymentByReference(intent.reference)];
  if (intent.provider_transaction_id) {
    lookups.push(getPaytedPayment(intent.provider_transaction_id));
  }
  const results = (await Promise.all(lookups)).filter((r) => r.ok);
  const remote =
    results.find((r) => r.ok && r.status === "paid") ??
    results.find((r) => r.ok && r.status === "pending") ??
    results[0];

  if (!remote || !remote.ok) return { status: intent.status === "failed" ? "failed" : "pending" };
  if (remote.status === "pending") return { status: "pending", message: remote.message };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const amount = Number(intent.amount);
  const providerId = remote.providerTransactionId ?? remote.id;

  if (remote.status === "paid") {
    if (intent.direction === "deposit") {
      await settlePaytedDeposit(supabaseAdmin, {
        reference: intent.reference,
        walletId: intent.wallet_id,
        userId: intent.user_id,
        amount,
        providerTransactionId: providerId,
        fee: remote.fee,
        netAmount: remote.netAmount,
        source: "sync",
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

  if (intent.direction === "withdrawal") {
    await refundPaytedHold(supabaseAdmin, intent.wallet_id, amount, intent.reference);
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
}
