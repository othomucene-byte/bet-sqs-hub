/** Rótulos dos mercados de desportos — puro, seguro no cliente e no servidor. */

export type Market = "h2h" | "dc" | "totals" | "btts";

export const MARKET_NAMES: Record<Market, string> = {
  h2h: "Resultado final",
  dc: "Dupla chance",
  totals: "Mais/Menos golos",
  btts: "Ambas marcam",
};

export function selectionLabel(
  market: string,
  selection: string,
  line: number | null,
  homeTeam: string,
  awayTeam: string,
): string {
  if (market === "h2h") {
    if (selection === "HOME") return homeTeam;
    if (selection === "AWAY") return awayTeam;
    return "Empate";
  }
  if (market === "dc") {
    if (selection === "1X") return `${homeTeam} ou Empate`;
    if (selection === "X2") return `Empate ou ${awayTeam}`;
    return `${homeTeam} ou ${awayTeam}`;
  }
  if (market === "totals") {
    const value = line === null ? "" : ` ${line.toFixed(1)}`;
    return selection === "OVER" ? `Mais de${value}` : `Menos de${value}`;
  }
  if (market === "btts") {
    return selection === "YES" ? "Ambas marcam: Sim" : "Ambas marcam: Não";
  }
  return selection;
}

/** Rótulo curto para as pílulas de cotação. */
export function shortLabel(market: string, selection: string, line: number | null): string {
  if (market === "h2h") {
    return selection === "HOME" ? "1" : selection === "DRAW" ? "X" : "2";
  }
  if (market === "dc") return selection;
  if (market === "totals") {
    return `${selection === "OVER" ? "+" : "−"}${line === null ? "" : line.toFixed(1)}`;
  }
  if (market === "btts") return selection === "YES" ? "Sim" : "Não";
  return selection;
}

export const SLIP_LIMITS = {
  minStake: 3,
  maxStake: 25_000,
  maxSelections: 12,
  maxPayout: 500_000,
} as const;
