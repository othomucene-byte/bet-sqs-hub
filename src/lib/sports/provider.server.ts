/**
 * sportsProvider — única porta de saída para o fornecedor de dados desportivos
 * (API-Football / API-Sports).
 *
 * Regras rígidas:
 *  - A chave `API_FOOTBALL_KEY` é lida dentro das funções, só no servidor.
 *  - Nenhum pedido é feito sem orçamento diário disponível (contado na base de
 *    dados por `sports_consume_requests`), o que protege contra rate-limit.
 *  - Timeout, uma tentativa de repetição e erros registados. Nada é inventado:
 *    quando o fornecedor falha, devolvemos erro e a UI mostra o último estado
 *    válido guardado na base de dados.
 */

import { cached, SPORTS_TTL } from "./cache.server";

const BASE = "https://v3.football.api-sports.io";
const TIMEOUT_MS = 12_000;

export class ProviderError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export class BudgetError extends Error {
  readonly remaining: number;
  constructor(remaining: number) {
    super("Orçamento diário de pedidos ao fornecedor esgotado.");
    this.remaining = remaining;
  }
}

export function providerKey(): string | null {
  const key = process.env["API_FOOTBALL_KEY"];
  return key && key.trim() ? key.trim() : null;
}

export function providerConfigured(): boolean {
  return providerKey() !== null;
}

/** Reserva `count` pedidos no orçamento diário. Lança `BudgetError` se não houver. */
export async function reserveRequests(count: number): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("sports_consume_requests", { _count: count });
  if (error) throw new ProviderError(`orçamento: ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as
    | { allowed: boolean; remaining: number }
    | null;
  if (!row?.allowed) throw new BudgetError(Number(row?.remaining ?? 0));
  return Number(row.remaining);
}

async function rawCall<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = providerKey();
  if (!key) throw new ProviderError("API_FOOTBALL_KEY não configurado", 503);
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const attempt = async (): Promise<T> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url.toString(), {
        headers: { accept: "application/json", "x-apisports-key": key },
        signal: controller.signal,
      });
      if (res.status === 429) throw new ProviderError("fornecedor em rate-limit (429)", 429);
      if (!res.ok) throw new ProviderError(`fornecedor respondeu ${res.status}`, res.status);
      const body = (await res.json().catch(() => null)) as {
        response?: T;
        errors?: Record<string, string> | string[];
      } | null;
      const errors = body?.errors;
      if (errors && (Array.isArray(errors) ? errors.length : Object.keys(errors).length)) {
        const first = Array.isArray(errors) ? errors[0] : Object.values(errors)[0];
        throw new ProviderError(String(first).slice(0, 200));
      }
      return (body?.response ?? ([] as unknown)) as T;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    return await attempt();
  } catch (error) {
    if (error instanceof ProviderError && error.status === 429) throw error;
    await new Promise((resolve) => setTimeout(resolve, 900));
    return attempt();
  }
}

/** Chamada contabilizada: reserva 1 pedido no orçamento antes de sair. */
async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  await reserveRequests(1);
  return rawCall<T>(path, params);
}

// ---------------------------------------------------------------- tipos crus

export type ProviderFixture = {
  fixture: {
    id: number;
    date: string;
    referee?: string | null;
    venue?: { name?: string | null } | null;
    status: { short: string; long?: string; elapsed?: number | null; extra?: number | null };
  };
  league: { id: number; name: string; country?: string; season?: number; round?: string; logo?: string };
  teams: {
    home: { id?: number; name: string; logo?: string | null };
    away: { id?: number; name: string; logo?: string | null };
  };
  goals: { home: number | null; away: number | null };
  events?: Array<{
    time?: { elapsed?: number | null; extra?: number | null };
    team?: { id?: number; name?: string };
    player?: { name?: string | null };
    assist?: { name?: string | null };
    type?: string;
    detail?: string;
    comments?: string | null;
  }>;
  statistics?: Array<{
    team?: { id?: number };
    statistics?: Array<{ type?: string; value?: string | number | null }>;
  }>;
  lineups?: Array<{
    team?: { id?: number; name?: string };
    formation?: string | null;
    startXI?: Array<{ player?: { name?: string | null; number?: number | null; pos?: string | null } }>;
    substitutes?: Array<{ player?: { name?: string | null; number?: number | null; pos?: string | null } }>;
    coach?: { name?: string | null } | null;
  }>;
};

export type ProviderStatus = {
  account?: { firstname?: string; lastname?: string; email?: string };
  subscription?: { plan?: string; end?: string; active?: boolean };
  requests?: { current?: number; limit_day?: number };
};

// ------------------------------------------------------------------ chamadas

/** Todos os jogos a decorrer agora — uma só chamada cobre o mundo inteiro. */
export async function fetchLiveFixtures(): Promise<ProviderFixture[]> {
  return call<ProviderFixture[]>("/fixtures", { live: "all" });
}

/** Jogos de um dia (UTC), com cache para não gastar o mesmo pedido duas vezes. */
export async function fetchFixturesByDate(date: string): Promise<ProviderFixture[]> {
  return cached(`fixtures:${date}`, SPORTS_TTL.fixturesByDate, () =>
    call<ProviderFixture[]>("/fixtures", { date, timezone: "UTC" }),
  );
}

/** Detalhe completo de um jogo (inclui acontecimentos, estatísticas e escalações). */
export async function fetchFixtureById(providerId: string): Promise<ProviderFixture | null> {
  const rows = await call<ProviderFixture[]>("/fixtures", { id: providerId });
  return rows[0] ?? null;
}

/** Estado da conta no fornecedor — não consome o orçamento interno. */
export async function fetchProviderStatus(): Promise<ProviderStatus> {
  return cached(`status`, SPORTS_TTL.providerStatus, async () => {
    const response = await rawCall<ProviderStatus | ProviderStatus[]>("/status", {});
    return (Array.isArray(response) ? response[0] : response) ?? {};
  });
}
