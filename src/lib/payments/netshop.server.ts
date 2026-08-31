/**
 * Cliente HTTP da API NetShop (server-only).
 *
 * Todas as chamadas usam a Wallet ID da conta Betfcom + API key; nada deste
 * módulo pode chegar ao browser. O `reference` gerado pelo nosso backend é
 * enviado em cada operação e devolvido pelo webhook — é a chave de
 * idempotência partilhada.
 */

const API_BASE = "https://www.netshop.co.mz/api/v1";

/** Canal do agregador por método — cada um tem endpoint e payload próprios. */
const CHANNEL: Record<string, string> = {
  mpesa: "mpesa",
  emola: "emola",
  mkesh: "mkesh",
  card: "card",
  bank_transfer: "bank",
};

type NetshopCredentials = {
  walletId: string;
  apiKey: string;
};

function credentials(): NetshopCredentials | null {
  const walletId = process.env["NETSHOP_WALLET_ID"];
  const apiKey = process.env["NETSHOP_API_KEY"];
  if (!walletId || !apiKey) return null;
  return { walletId, apiKey };
}

function providerMessage(data: Record<string, unknown>): string | null {
  for (const key of ["message", "error", "detail", "status_description"]) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.slice(0, 200);
  }
  return null;
}

async function netshopRequest(
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const creds = credentials();
  if (!creds) throw new Error("netshop_not_configured");

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${creds.apiKey}`,
      "X-Wallet-Id": creds.walletId,
      // Idempotência do lado do agregador: a mesma referência nunca cobra duas vezes.
      "Idempotency-Key": String(body["reference"] ?? ""),
    },
    body: JSON.stringify({ wallet_id: creds.walletId, ...body }),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    console.error("netshop api error", path, res.status, JSON.stringify(data).slice(0, 300));
  }
  return { ok: res.ok, status: res.status, data };
}

export type ChargeResult =
  | { ok: true; transactionId: string | null; checkoutUrl: string | null; instructions: string | null }
  | { ok: false; message: string | null };

function readString(data: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  const nested = data["data"];
  if (nested && typeof nested === "object") {
    return readString(nested as Record<string, unknown>, ...keys);
  }
  return null;
}

/** Cobrança C2B (M-Pesa / e-Mola / mKesh) — USSD push no telemóvel do pagador. */
export async function initiateCharge(input: {
  method: string;
  amount: number;
  reference: string;
  payerIdentifier: string;
}): Promise<ChargeResult> {
  try {
    const isBank = input.method === "bank_transfer";
    const res = await netshopRequest("/payments/charge", {
      method: CHANNEL[input.method] ?? input.method,
      channel: CHANNEL[input.method] ?? input.method,
      amount: input.amount,
      currency: "MZN",
      reference: input.reference,
      customer: isBank
        ? { account: input.payerIdentifier }
        : { phone: input.payerIdentifier, msisdn: input.payerIdentifier },
    });
    if (!res.ok) return { ok: false, message: providerMessage(res.data) };
    return {
      ok: true,
      transactionId: readString(res.data, "transaction_id", "transactionId", "id"),
      checkoutUrl: readString(res.data, "checkout_url", "checkoutUrl", "redirect_url"),
      instructions: readString(res.data, "instructions", "payment_instructions"),
    };
  } catch (err) {
    console.error("netshop charge failed", err instanceof Error ? err.message : err);
    return { ok: false, message: null };
  }
}

/** Checkout alojado para cartão VISA/Mastercard — devolve URL de redirecionamento. */
export async function initiateCardCheckout(input: {
  amount: number;
  reference: string;
  returnUrl?: string;
}): Promise<ChargeResult> {
  try {
    const res = await netshopRequest("/payments/checkout", {
      method: "card",
      channel: "card",
      amount: input.amount,
      currency: "MZN",
      reference: input.reference,
      ...(input.returnUrl
        ? { return_url: input.returnUrl, callback_url: input.returnUrl }
        : {}),
    });
    if (!res.ok) return { ok: false, message: providerMessage(res.data) };
    return {
      ok: true,
      transactionId: readString(res.data, "transaction_id", "transactionId", "id"),
      checkoutUrl: readString(res.data, "checkout_url", "checkoutUrl", "redirect_url", "url"),
      instructions: null,
    };
  } catch (err) {
    console.error("netshop checkout failed", err instanceof Error ? err.message : err);
    return { ok: false, message: null };
  }
}

/** Payout B2C (levantamento) para carteira móvel ou conta bancária do cliente. */
export async function initiatePayout(input: {
  method: string;
  amount: number;
  reference: string;
  payeeIdentifier: string;
}): Promise<ChargeResult> {
  try {
    const isBank = input.method === "bank_transfer";
    const res = await netshopRequest("/payouts", {
      method: CHANNEL[input.method] ?? input.method,
      channel: CHANNEL[input.method] ?? input.method,
      amount: input.amount,
      currency: "MZN",
      reference: input.reference,
      beneficiary: isBank
        ? { account: input.payeeIdentifier }
        : { phone: input.payeeIdentifier, msisdn: input.payeeIdentifier },
    });
    if (!res.ok) return { ok: false, message: providerMessage(res.data) };
    return {
      ok: true,
      transactionId: readString(res.data, "transaction_id", "transactionId", "id"),
      checkoutUrl: null,
      instructions: null,
    };
  } catch (err) {
    console.error("netshop payout failed", err instanceof Error ? err.message : err);
    return { ok: false, message: null };
  }
}
