import { createServerFn } from "@tanstack/react-start";

export type FxQuote = { pair: string; rate: number; changePct: number | null };
export type FxResult = { quotes: FxQuote[]; updatedAt: string | null; source: string };

let cache: { at: number; value: FxResult } | null = null;

async function mznRates(tag: string): Promise<Record<string, number>> {
  const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${tag}/v1/currencies/mzn.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${tag} ${res.status}`);
  const json = (await res.json()) as { mzn?: Record<string, number> };
  return json.mzn ?? {};
}

/** Câmbios reais do Metical com variação face ao dia anterior (fonte pública, sem chave). */
export const getFxRates = createServerFn({ method: "GET" }).handler(async (): Promise<FxResult> => {
  if (cache && Date.now() - cache.at < 60 * 60_000) return cache.value;
  try {
    const d = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
    const [now, prev] = await Promise.all([mznRates("latest"), mznRates(d).catch(() => ({}) as Record<string, number>)]);
    const quotes = ["usd", "eur", "zar", "gbp", "cny"]
      .filter((c) => now[c])
      .map((c) => {
        const rate = 1 / now[c]!;
        const old = prev[c] ? 1 / prev[c]! : null;
        return {
          pair: `${c.toUpperCase()}/MZN`,
          rate,
          changePct: old ? Number((((rate - old) / old) * 100).toFixed(2)) : null,
        };
      });
    const value = { quotes, updatedAt: new Date().toISOString(), source: "fawazahmed0 currency-api" };
    cache = { at: Date.now(), value };
    return value;
  } catch (e) {
    console.error("[fx]", e);
    return { quotes: [], updatedAt: null, source: "ExchangeRate-API" };
  }
});
