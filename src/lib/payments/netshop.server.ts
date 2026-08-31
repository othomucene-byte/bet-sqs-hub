/**
 * Cliente HTTP da API NetShop (server-only).
 *
 * Todas as chamadas usam a Wallet ID da conta Betfcom + API key; nada deste
 * módulo pode chegar ao browser. O `reference` gerado pelo nosso backend é
 * enviado em cada operação e devolvido pelo webhook — é a chave de
 * idempotência partilhada.
 */

const API_BASE = "https://www.netshop.co.mz/api/v1";

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
      Authorization: `Bearer ${creds.apiKey}`,
      "X-Wallet-Id": creds.walletId,
    },
    body: JSON.stringify({ wallet_id: creds.walletId, ...body }),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    console.error("netshop api error", res.status, JSON.stringify(data).slice(0, 300));
  }
  return { ok: res.ok, status: res.status, data };
}

export type ChargeResult =
  | { ok: true; transactionId: string | null; checkoutUrl: string | null }
  | { ok: false };

/** Cobrança C2B (M-Pesa / e-Mola / mKesh) — USSD push no telemóvel do pagador. */
export async function initiateCharge(input: {
  method: string;
  amount: number;
  reference: string;
  payerIdentifier: string;
}): Promise<ChargeResult> {
  try {
    const res = await netshopRequest("/payments/charge", {
      method: input.method,
      amount: input.amount,
      currency: "MZN",
      reference: input.reference,
      customer: { phone: input.payerIdentifier },
    });
    if (!res.ok) return { ok: false };
    return {
      ok: true,
      transactionId: typeof res.data["transaction_id"] === "string" ? res.data["transaction_id"] : null,
      checkoutUrl: typeof res.data["checkout_url"] === "string" ? res.data["checkout_url"] : null,
    };
  } catch (err) {
    console.error("netshop charge failed", err instanceof Error ? err.message : err);
    return { ok: false };
  }
}

/** Checkout alojado para cartão VISA/Mastercard — devolve URL de redirecionamento. */
export async function initiateCardCheckout(input: {
  amount: number;
  reference: string;
}): Promise<ChargeResult> {
  try {
    const res = await netshopRequest("/payments/checkout", {
      method: "card",
      amount: input.amount,
      currency: "MZN",
      reference: input.reference,
    });
    if (!res.ok) return { ok: false };
    return {
      ok: true,
      transactionId: typeof res.data["transaction_id"] === "string" ? res.data["transaction_id"] : null,
      checkoutUrl: typeof res.data["checkout_url"] === "string" ? res.data["checkout_url"] : null,
    };
  } catch (err) {
    console.error("netshop checkout failed", err instanceof Error ? err.message : err);
    return { ok: false };
  }
}

/** Payout B2C (levantamento) para carteira móvel do cliente. */
export async function initiatePayout(input: {
  method: string;
  amount: number;
  reference: string;
  payeeIdentifier: string;
}): Promise<ChargeResult> {
  try {
    const res = await netshopRequest("/payouts", {
      method: input.method,
      amount: input.amount,
      currency: "MZN",
      reference: input.reference,
      beneficiary: { phone: input.payeeIdentifier },
    });
    if (!res.ok) return { ok: false };
    return {
      ok: true,
      transactionId: typeof res.data["transaction_id"] === "string" ? res.data["transaction_id"] : null,
      checkoutUrl: null,
    };
  } catch (err) {
    console.error("netshop payout failed", err instanceof Error ? err.message : err);
    return { ok: false };
  }
}
