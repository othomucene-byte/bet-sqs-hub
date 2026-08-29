/**
 * Camada de integração Netshop (https://www.netshop.co.mz/api/v1)
 *
 * IMPORTANTE — arquitetura:
 * Este ficheiro contém APENAS metadados de apresentação (catálogo de métodos,
 * estados possíveis, limites informativos). Não faz — e nunca deve fazer —
 * chamadas à API Netshop a partir do browser.
 *
 * Quando o backend (Lovable Cloud) estiver ativo:
 *  - As credenciais (NETSHOP_API_KEY / NETSHOP_MERCHANT_ID / NETSHOP_WEBHOOK_SECRET)
 *    ficam guardadas como secrets do lado do servidor.
 *  - Depósitos/levantamentos são iniciados por server functions que escrevem no
 *    ledger imutável em estado `pending` e devolvem apenas o `reference`.
 *  - A confirmação de pagamento chega exclusivamente por webhook assinado em
 *    `/api/public/webhooks/netshop`, verificado com HMAC antes de qualquer
 *    movimento de saldo.
 *  - O frontend nunca decide se um pagamento foi concluído: apenas mostra o
 *    estado devolvido pelo backend.
 */

export const NETSHOP_API_BASE = "https://www.netshop.co.mz/api/v1";

export type IntegrationStatus = "not_configured" | "sandbox" | "live";

/** Estado real da integração — só o backend pode reportar `sandbox`/`live`. */
export const NETSHOP_STATUS: IntegrationStatus = "not_configured";

export const NETSHOP_STATUS_LABEL: Record<IntegrationStatus, string> = {
  not_configured: "Não configurado",
  sandbox: "Ambiente de teste",
  live: "Produção",
};

export type PaymentDirection = "deposit" | "withdrawal";

export type NetshopMethod = {
  id: string;
  name: string;
  provider: string;
  kind: "mobile_money" | "card" | "bank_transfer";
  currency: "MZN";
  directions: PaymentDirection[];
  /** Formato esperado do identificador do pagador (ajuda de UI, não validação final). */
  identifierHint: string;
  notes: string;
};

/** Métodos de pagamento em Moçambique cobertos pelo agregador Netshop. */
export const NETSHOP_METHODS: NetshopMethod[] = [
  {
    id: "mpesa",
    name: "M-Pesa",
    provider: "Vodacom",
    kind: "mobile_money",
    currency: "MZN",
    directions: ["deposit", "withdrawal"],
    identifierHint: "84xxxxxxx ou 85xxxxxxx",
    notes: "Confirmação por USSD push no telemóvel do titular.",
  },
  {
    id: "emola",
    name: "e-Mola",
    provider: "Movitel",
    kind: "mobile_money",
    currency: "MZN",
    directions: ["deposit", "withdrawal"],
    identifierHint: "86xxxxxxx ou 87xxxxxxx",
    notes: "Confirmação por USSD push no telemóvel do titular.",
  },
  {
    id: "mkesh",
    name: "mKesh",
    provider: "Tmcel",
    kind: "mobile_money",
    currency: "MZN",
    directions: ["deposit", "withdrawal"],
    identifierHint: "82xxxxxxx ou 83xxxxxxx",
    notes: "Disponibilidade sujeita à cobertura do agregador.",
  },
  {
    id: "card",
    name: "Cartão Visa / Mastercard",
    provider: "Netshop Checkout",
    kind: "card",
    currency: "MZN",
    directions: ["deposit"],
    identifierHint: "Checkout alojado pelo gateway",
    notes: "Sem dados de cartão na plataforma — redirecionamento para o gateway.",
  },
  {
    id: "bank_transfer",
    name: "Transferência bancária",
    provider: "Bancos nacionais",
    kind: "bank_transfer",
    currency: "MZN",
    directions: ["deposit", "withdrawal"],
    identifierHint: "IBAN / NIB do titular",
    notes: "Conciliação por referência única gerada no backend.",
  },
];

/** Secrets que o backend precisa antes de a integração poder ser ativada. */
export const NETSHOP_REQUIRED_SECRETS = [
  "NETSHOP_MERCHANT_ID",
  "NETSHOP_API_KEY",
  "NETSHOP_WEBHOOK_SECRET",
] as const;

export function isNetshopConfigured(status: IntegrationStatus = NETSHOP_STATUS): boolean {
  return status !== "not_configured";
}
