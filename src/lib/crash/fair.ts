/**
 * Provably fair — lado partilhado (browser-safe).
 *
 * As mesmas fórmulas existem na base de dados (`public.crash_result`,
 * `public.crash_multiplier_at`). O cliente usa-as APENAS para desenhar a
 * animação e para o jogador poder verificar uma ronda já terminada.
 * O resultado real é sempre o que está gravado em `game_rounds`.
 */

/** Crescimento do multiplicador: 1.06 por segundo desde o arranque da ronda. */
export const GROWTH_PER_SECOND = 1.06;

export const GAME_CONFIG = {
  /**
   * Margem da casa: 3% → RTP oficial de 97%.
   * Cerca de 3% das rondas explodem imediatamente em 1.00x; nas restantes o
   * resultado é (1 - margem) / (1 - aleatório), pelo que ~50% das rondas
   * terminam abaixo de 2.00x. Nunca é subtraída do cash-out.
   */
  houseEdge: 0.03,
  /** Retorno ao jogador a longo prazo (1 - houseEdge). */
  rtp: 0.97,
  depositFee: 0,
  withdrawalFee: 0,
  /** Duração da fase de apostas. */
  bettingMs: 8_000,
  /** Tempo de exibição do crash antes da ronda seguinte. */
  crashedMs: 4_000,
  minBet: 3,
  maxBet: 25_000,
} as const;

/** Multiplicador no instante `elapsedMs` após o arranque. */
export function multiplierAt(elapsedMs: number): number {
  if (elapsedMs <= 0) return 1;
  const value = Math.pow(GROWTH_PER_SECOND, elapsedMs / 1000);
  return Math.max(1, Math.floor(value * 10000) / 10000);
}

/** Instante (ms após o arranque) em que a ronda atinge `multiplier`. */
export function msForMultiplier(multiplier: number): number {
  if (multiplier <= 1) return 0;
  return (Math.log(multiplier) / Math.log(GROWTH_PER_SECOND)) * 1000;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** SHA-256 hex — usado para o compromisso publicado antes da ronda. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

/** HMAC-SHA256 hex de `message` com `key`. */
export async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(message),
  );
  return bytesToHex(new Uint8Array(signature));
}

/**
 * Resultado da ronda: HMAC_SHA256(serverSeed, `clientSeed:nonce`) → multiplicador.
 * Réplica exata de `public.crash_result`.
 */
export async function crashResult(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  houseEdge: number = GAME_CONFIG.houseEdge,
): Promise<number> {
  const hex = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}`);
  const slice = parseInt(hex.slice(0, 8), 16);
  const float = slice / 2 ** 32;

  // Parte da vantagem da casa: crash imediato em 1.00x.
  if (float < houseEdge) return 1;

  const result = (1 - houseEdge) / (1 - float);
  return Math.round(Math.min(Math.max(result, 1), 10000) * 10000) / 10000;
}
