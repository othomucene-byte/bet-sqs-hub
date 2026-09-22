/**
 * sportsCache — cache em memória por instância, com TTL por tipo de dado.
 *
 * Objetivo: muitos utilizadores em simultâneo nunca chegam ao fornecedor.
 * A base de dados é a fonte de verdade; esta cache só evita repetir leituras
 * e pedidos idênticos dentro da janela de validade.
 */

type Entry<T> = { at: number; value: T };

const store = new Map<string, Entry<unknown>>();

/** TTL (ms) por tipo de dado. */
export const SPORTS_TTL = {
  live: 10_000,
  board: 20_000,
  match: 15_000,
  fixturesByDate: 300_000,
  providerStatus: 120_000,
  competitions: 900_000,
} as const;

export function cacheGet<T>(key: string, ttlMs: number): T | null {
  const entry = store.get(key) as Entry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.at > ttlMs) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function cacheSet<T>(key: string, value: T): T {
  store.set(key, { at: Date.now(), value });
  return value;
}

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key, ttlMs);
  if (hit !== null) return hit;
  return cacheSet(key, await load());
}

export function cacheInvalidatePrefix(prefix: string): void {
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
