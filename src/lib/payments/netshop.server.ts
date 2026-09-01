/**
 * Cliente HTTP da API NetShop (server-only) — https://www.netshop.co.mz/api/v1
 *
 * Conforme a documentação oficial:
 *  - Autenticação: `Authorization: Bearer <API key>` + `X-Wallet-ID`.
 *  - Cobranças: POST /charges (card | mpesa | emola | mkesh).
 *  - Payouts B2C: POST /payouts (mpesa | emola).
 *  - Estado: GET /charges/{id|reference} e GET /payouts/{id|reference} —
 *    fonte de verdade para reconciliação.
 *  - Idempotência: header `Idempotency-Key` com a nossa referência única.
 *
 * Nada deste módulo pode chegar ao browser.
 */

const API_BASE = "https://www.netshop.co.mz/api/v1";

export type NetshopMethod = "card" | "mpesa" | "emola" | "mkesh";

type NetshopCredentials = { walletId: string; apiKey: string };

/**
 * Cada método tem a sua própria wallet NetShop (Visa/cartão, M-Pesa, mKesh).
 * `NETSHOP_WALLET_ID` continua a servir de fallback (e-Mola ou instalações
 * com uma única wallet).
 */
const WALLET_ENV: Record<NetshopMethod, string> = {
  card: "NETSHOP_WALLET_ID_CARD",
  mpesa: "NETSHOP_WALLET_ID_MPESA",
  emola: "NETSHOP_WALLET_ID_EMOLA",
  mkesh: "NETSHOP_WALLET_ID_MKESH",
};

export function walletIdFor(method: NetshopMethod): string | null {
  return process.env[WALLET_ENV[method]] || process.env["NETSHOP_WALLET_ID"] || null;
}

/** Métodos com wallet + API key presentes no servidor. */
export function configuredMethods(): Record<NetshopMethod, boolean> {
  const apiKey = Boolean(process.env["NETSHOP_API_KEY"]);
  const of = (m: NetshopMethod) => apiKey && Boolean(walletIdFor(m));
  return { card: of("card"), mpesa: of("mpesa"), emola: of("emola"), mkesh: of("mkesh") };
}

function credentials(method: NetshopMethod): NetshopCredentials | null {
  const walletId = walletIdFor(method);
  const apiKey = process.env["NETSHOP_API_KEY"];
  if (!walletId || !apiKey) return null;
  return { walletId, apiKey };
}

function authHeaders(creds: NetshopCredentials): Record<string, string> {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${creds.apiKey}`,
    "X-Wallet-ID": creds.walletId,
  };
}

type Json = Record<string, unknown>;

function asObject(value: unknown): Json | null {
  return value && typeof value === "object" ? (value as Json) : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/** Mensagem legível: failed_reason > responseDesc > error/message da API. */
function providerMessage(data: Json): string | null {
  const failed = str(data["failed_reason"]);
  if (failed) return failed.slice(0, 200);
  const provider = asObject(data["provider"]);
  const desc = provider ? str(provider["responseDesc"]) : null;
  if (desc) return desc.slice(0, 200);
  for (const key of ["error", "message", "detail"]) {
    const value = str(data[key]);
    if (value) return value.slice(0, 200);
  }
  return null;
}

/** Estado normalizado do lado da nossa plataforma. */
export type NetshopStatus = "paid" | "pending" | "failed";

function normalizeStatus(raw: string | null): NetshopStatus {
  if (raw === "paid" || raw === "completed" || raw === "succeeded") return "paid";
  if (raw === "failed" || raw === "rejected" || raw === "cancelled") return "failed";
  return "pending";
}

export type NetshopOperation = {
  id: string | null;
  status: NetshopStatus;
  providerTransactionId: string | null;
  checkoutUrl: string | null;
  message: string | null;
};

export type NetshopResult =
  | ({ ok: true } & NetshopOperation)
  | { ok: false; httpStatus: number; code: string | null; message: string | null };

function parseOperation(data: Json): NetshopOperation {
  const checkout = asObject(data["checkout"]);
  const provider = asObject(data["provider"]);
  return {
    id: str(data["id"]),
    status: normalizeStatus(str(data["status"])),
    providerTransactionId: provider ? str(provider["transactionID"]) : null,
    checkoutUrl: checkout ? (str(checkout["hosted_url"]) ?? str(checkout["url"])) : null,
    message: providerMessage(data),
  };
}

async function request(
  httpMethod: "GET" | "POST",
  path: string,
  options: { body?: Json; idempotencyKey?: string; walletMethod: NetshopMethod },
): Promise<NetshopResult> {
  const creds = credentials(options.walletMethod);
  if (!creds) return { ok: false, httpStatus: 0, code: "not_configured", message: null };

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: httpMethod,
      headers: {
        ...authHeaders(creds),
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });

    const data = (await res.json().catch(() => ({}))) as Json;
    if (!res.ok) {
      console.error("netshop api error", httpMethod, path, res.status, JSON.stringify(data).slice(0, 300));
      return {
        ok: false,
        httpStatus: res.status,
        code: str(data["error"]),
        message: providerMessage(data),
      };
    }
    return { ok: true, ...parseOperation(data) };
  } catch (err) {
    console.error("netshop request failed", path, err instanceof Error ? err.message : err);
    return { ok: false, httpStatus: 0, code: "network_error", message: null };
  }
}

/** Health-check da Base URL (`GET /ping`). */
export async function ping(): Promise<{ ok: boolean; canonicalHost: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/ping`, { headers: { Accept: "application/json" } });
    const data = (await res.json().catch(() => ({}))) as Json;
    return { ok: res.ok && data["ok"] === true, canonicalHost: data["canonical_host"] === true };
  } catch {
    return { ok: false, canonicalHost: false };
  }
}

/**
 * Cobrança (depósito). `card` devolve `checkout.hosted_url`; carteiras móveis
 * confirmam por PIN/USSD no telemóvel do pagador.
 */
export async function createCharge(input: {
  method: NetshopMethod;
  amount: number;
  reference: string;
  msisdn?: string;
  returnUrl?: string;
  metadata?: Json;
}): Promise<NetshopResult> {
  return request("POST", "/charges", {
    walletMethod: input.method,
    idempotencyKey: input.reference,
    body: {
      amount: input.amount,
      currency: "MZN",
      method: input.method,
      reference: input.reference,
      ...(input.msisdn ? { msisdn: input.msisdn } : {}),
      ...(input.returnUrl ? { return_url: input.returnUrl } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    },
  });
}

/** Payout B2C (levantamento) — apenas M-Pesa e e-Mola. */
export async function createPayout(input: {
  method: "mpesa" | "emola";
  amount: number;
  reference: string;
  msisdn: string;
  metadata?: Json;
}): Promise<NetshopResult> {
  return request("POST", "/payouts", {
    walletMethod: input.method,
    idempotencyKey: input.reference,
    body: {
      amount: input.amount,
      currency: "MZN",
      method: input.method,
      msisdn: input.msisdn,
      reference: input.reference,
      ...(input.metadata ? { metadata: input.metadata } : {}),
    },
  });
}

/** Estado atual de uma cobrança — fonte de verdade para reconciliação. */
export function getCharge(idOrReference: string, method: NetshopMethod): Promise<NetshopResult> {
  return request("GET", `/charges/${encodeURIComponent(idOrReference)}`, { walletMethod: method });
}

/** Estado atual de um payout. */
export function getPayout(idOrReference: string, method: NetshopMethod): Promise<NetshopResult> {
  return request("GET", `/payouts/${encodeURIComponent(idOrReference)}`, { walletMethod: method });
}
