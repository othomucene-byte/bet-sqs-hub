import { createServerFn } from "@tanstack/react-start";

export type FxQuote = { pair: string; rate: number };
export type FxResult = { quotes: FxQuote[]; updatedAt: string | null; source: string };

let cache: { at: number; value: FxResult } | null = null;

/** Câmbios reais do Metical (fonte pública ExchangeRate-API, atualização diária). */
export const getFxRates = createServerFn({ method: "GET" }).handler(async (): Promise<FxResult> => {
  if (cache && Date.now() - cache.at < 60 * 60_000) return cache.value;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/MZN");
    if (!res.ok) throw new Error(String(res.status));
    const json = (await res.json()) as { rates?: Record<string, number>; time_last_update_utc?: string };
    const r = json.rates ?? {};
    const quotes = ["USD", "EUR", "ZAR", "GBP", "CNY"]
      .filter((c) => r[c])
      .map((c) => ({ pair: `${c}/MZN`, rate: 1 / r[c]! }));
    const value = { quotes, updatedAt: json.time_last_update_utc ?? null, source: "ExchangeRate-API" };
    cache = { at: Date.now(), value };
    return value;
  } catch (e) {
    console.error("[fx]", e);
    return { quotes: [], updatedAt: null, source: "ExchangeRate-API" };
  }
});
