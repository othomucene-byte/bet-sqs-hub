/**
 * Camada de apresentação da integração NetShop (https://www.netshop.co.mz/api/v1)
 *
 * IMPORTANTE — arquitetura:
 * Este ficheiro contém APENAS metadados de apresentação (catálogo de métodos
 * suportados pela API, mínimos publicados, estados possíveis). Não faz — e
 * nunca deve fazer — chamadas à API NetShop a partir do browser.
 *
 * As credenciais (NETSHOP_WALLET_ID / NETSHOP_API_KEY / NETSHOP_WEBHOOK_SECRET)
 * vivem no servidor. Depósitos e levantamentos são iniciados por server
 * functions que escrevem no ledger imutável e a confirmação chega por webhook
 * assinado (`X-NetShop-Signature`, HMAC-SHA256) em
 * `/api/public/webhooks/netshop`, ou por reconciliação via
 * `GET /charges/{ref}` / `GET /payouts/{ref}`.
 */

export const NETSHOP_API_BASE = "https://www.netshop.co.mz/api/v1";

export type IntegrationStatus = "not_configured" | "live";

export const NETSHOP_STATUS_LABEL: Record<IntegrationStatus, string> = {
  not_configured: "Não configurado",
  live: "Produção",
};

export type PaymentDirection = "deposit" | "withdrawal";

export type NetshopMethodId = "mpesa" | "emola" | "mkesh" | "card";

export type NetshopMethod = {
  id: NetshopMethodId;
  name: string;
  provider: string;
  kind: "mobile_money" | "card";
  currency: "MZN";
  directions: PaymentDirection[];
  /** Mínimo publicado pela NetShop para cobranças (MZN). */
  minDeposit: number;
  /** Formato esperado do identificador do pagador (ajuda de UI, não validação final). */
  identifierHint: string;
  notes: string;
};

/**
 * Métodos efetivamente suportados pela API NetShop v1.
 * Cobranças: card | mpesa | emola | mkesh. Payouts B2C: mpesa | emola.
 */
export const NETSHOP_METHODS: NetshopMethod[] = [
  {
    id: "mpesa",
    name: "M-Pesa",
    provider: "Vodacom",
    kind: "mobile_money",
    currency: "MZN",
    directions: ["deposit", "withdrawal"],
    minDeposit: 10,
    identifierHint: "84xxxxxxx ou 85xxxxxxx",
    notes: "Confirmação por PIN/USSD no telemóvel do titular.",
  },
  {
    id: "emola",
    name: "e-Mola",
    provider: "Movitel",
    kind: "mobile_money",
    currency: "MZN",
    directions: ["deposit", "withdrawal"],
    minDeposit: 10,
    identifierHint: "86xxxxxxx ou 87xxxxxxx",
    notes: "Push de pagamento com confirmação por PIN do titular.",
  },
  {
    id: "mkesh",
    name: "mKesh",
    provider: "Tmcel",
    kind: "mobile_money",
    currency: "MZN",
    directions: ["deposit"],
    minDeposit: 10,
    identifierHint: "82xxxxxxx ou 83xxxxxxx",
    notes: "Depósitos apenas — a NetShop não suporta payout B2C em mKesh.",
  },
  {
    id: "card",
    name: "Cartão Visa / Mastercard",
    provider: "NetShop Checkout",
    kind: "card",
    currency: "MZN",
    directions: ["deposit"],
    minDeposit: 50,
    identifierHint: "Checkout alojado pelo gateway",
    notes: "Sem dados de cartão na plataforma — redirecionamento seguro para o gateway.",
  },
];

/** Secrets que o backend precisa para a integração estar ativa. */
export const NETSHOP_REQUIRED_SECRETS = [
  "NETSHOP_WALLET_ID",
  "NETSHOP_API_KEY",
  "NETSHOP_WEBHOOK_SECRET",
] as const;

export function methodById(id: string): NetshopMethod | undefined {
  return NETSHOP_METHODS.find((m) => m.id === id);
}
