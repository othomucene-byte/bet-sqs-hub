/**
 * Motor de rondas do Crash — SERVIDOR APENAS.
 *
 * A máquina de estados é avançada de forma idempotente a partir do relógio do
 * servidor e dos timestamps gravados em `game_rounds`. Qualquer pedido pode
 * avançá-la; transições usam `WHERE status = <esperado>` para que chamadas
 * concorrentes não dupliquem trabalho (os workers são sem estado).
 *
 * WAITING → BETTING → RUNNING → CRASHED → SETTLED → (nova ronda)
 */
import { GAME_CONFIG, msForMultiplier, multiplierAt, sha256Hex } from "./fair";

export type RoundStatus = "WAITING" | "BETTING" | "RUNNING" | "CRASHED" | "SETTLED";

/** Vista da ronda entregue ao cliente. Nunca inclui a semente de rondas em curso. */
export type PublicRound = {
  id: string;
  roundNumber: number;
  status: RoundStatus;
  serverSeedHash: string;
  /** Revelada apenas após CRASHED. */
  serverSeed: string | null;
  clientSeed: string;
  nonce: number;
  /** Revelado apenas após CRASHED. */
  crashMultiplier: number | null;
  houseEdge: number;
  bettingStartedAt: string | null;
  startedAt: string | null;
  crashedAt: string | null;
  /** Multiplicador atual segundo o relógio do servidor. */
  multiplier: number;
  /** Milissegundos restantes na fase atual (0 quando não aplicável). */
  phaseMsRemaining: number;
  /** Instante do servidor, para o cliente alinhar a animação. */
  serverNow: string;
};

type RoundRow = {
  id: string;
  round_number: number;
  status: RoundStatus;
  server_seed_hash: string;
  server_seed: string | null;
  client_seed: string;
  nonce: number;
  crash_multiplier: string | number | null;
  house_edge: string | number;
  betting_started_at: string | null;
  betting_closed_at: string | null;
  started_at: string | null;
  crashed_at: string | null;
  settled_at: string | null;
};

function randomHex(bytes: number): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function num(value: string | number | null): number | null {
  if (value === null) return null;
  return typeof value === "number" ? value : Number(value);
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Cria uma ronda nova: semente, compromisso e resultado fixados antes de abrir apostas. */
async function createRound(): Promise<RoundRow> {
  const db = await admin();
  const serverSeed = randomHex(32);
  const serverSeedHash = await sha256Hex(serverSeed);
  const clientSeed = randomHex(8);

  const { data: inserted, error: insertError } = await db
    .from("game_rounds")
    .insert({
      status: "WAITING",
      server_seed: serverSeed,
      server_seed_hash: serverSeedHash,
      client_seed: clientSeed,
      nonce: 0,
      house_edge: GAME_CONFIG.houseEdge,
    })
    .select("*")
    .single();
  if (insertError || !inserted) throw insertError ?? new Error("falha ao criar ronda");

  const row = inserted as RoundRow;
  const nonce = row.round_number;

  // Resultado calculado na base de dados e gravado ANTES de as apostas abrirem.
  const { data: crash, error: crashError } = await db.rpc("crash_result", {
    _server_seed: serverSeed,
    _client_seed: clientSeed,
    _nonce: nonce,
    _house_edge: GAME_CONFIG.houseEdge,
  });
  if (crashError) throw crashError;

  const { data: opened, error: openError } = await db
    .from("game_rounds")
    .update({
      nonce,
      crash_multiplier: crash,
      status: "BETTING",
      betting_started_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("status", "WAITING")
    .select("*")
    .single();
  if (openError || !opened) throw openError ?? new Error("falha ao abrir apostas");

  return opened as RoundRow;
}

async function latestRound(): Promise<RoundRow | null> {
  const db = await admin();
  const { data, error } = await db
    .from("game_rounds")
    .select("*")
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as RoundRow | null) ?? null;
}

/**
 * Avança a máquina de estados e devolve a ronda corrente.
 * Idempotente: seguro chamar em cada pedido de polling.
 */
export async function advanceRound(): Promise<RoundRow> {
  const db = await admin();
  let round = await latestRound();

  if (!round || round.status === "SETTLED") {
    return await createRound();
  }

  // WAITING sobrante (falha a meio da criação) → abrir apostas.
  if (round.status === "WAITING") {
    const { data } = await db
      .from("game_rounds")
      .update({ status: "BETTING", betting_started_at: new Date().toISOString() })
      .eq("id", round.id)
      .eq("status", "WAITING")
      .select("*")
      .maybeSingle();
    round = (data as RoundRow | null) ?? (await latestRound())!;
  }

  if (round.status === "BETTING") {
    const openedAt = round.betting_started_at ? Date.parse(round.betting_started_at) : Date.now();
    if (Date.now() - openedAt >= GAME_CONFIG.bettingMs) {
      const now = new Date().toISOString();
      const { data } = await db
        .from("game_rounds")
        .update({ status: "RUNNING", betting_closed_at: now, started_at: now })
        .eq("id", round.id)
        .eq("status", "BETTING")
        .select("*")
        .maybeSingle();
      round = (data as RoundRow | null) ?? (await latestRound())!;
    }
  }

  if (round.status === "RUNNING") {
    const crash = num(round.crash_multiplier) ?? 1;
    const startedAt = round.started_at ? Date.parse(round.started_at) : Date.now();
    const crashAt = startedAt + msForMultiplier(crash);

    if (Date.now() >= crashAt) {
      const { data } = await db
        .from("game_rounds")
        .update({
          status: "CRASHED",
          crashed_at: new Date(crashAt).toISOString(),
          // semente revelada só agora, permitindo verificação independente
          server_seed: round.server_seed,
        })
        .eq("id", round.id)
        .eq("status", "RUNNING")
        .select("*")
        .maybeSingle();

      if (data) {
        round = data as RoundRow;
        // Liquidação atómica: auto cash-outs pagos, restantes apostas perdidas.
        const { error } = await db.rpc("settle_round", { _round_id: round.id });
        if (error) throw error;
      } else {
        round = (await latestRound())!;
      }
    }
  }

  if (round.status === "CRASHED") {
    const crashedAt = round.crashed_at ? Date.parse(round.crashed_at) : Date.now();
    if (Date.now() - crashedAt >= GAME_CONFIG.crashedMs) {
      await db
        .from("game_rounds")
        .update({ status: "SETTLED", settled_at: new Date().toISOString() })
        .eq("id", round.id)
        .eq("status", "CRASHED");
      return await createRound();
    }
  }

  return round;
}

/** Projeta a ronda para o cliente, mascarando o que ainda não pode ser revelado. */
export function toPublicRound(row: RoundRow): PublicRound {
  const now = Date.now();
  const revealed = row.status === "CRASHED" || row.status === "SETTLED";
  const crash = num(row.crash_multiplier);

  let multiplier = 1;
  let phaseMsRemaining = 0;

  if (row.status === "BETTING") {
    const openedAt = row.betting_started_at ? Date.parse(row.betting_started_at) : now;
    phaseMsRemaining = Math.max(0, openedAt + GAME_CONFIG.bettingMs - now);
  } else if (row.status === "RUNNING") {
    const startedAt = row.started_at ? Date.parse(row.started_at) : now;
    multiplier = multiplierAt(now - startedAt);
    if (crash) {
      phaseMsRemaining = Math.max(0, startedAt + msForMultiplier(crash) - now);
    }
  } else if (revealed && crash) {
    multiplier = crash;
    const crashedAt = row.crashed_at ? Date.parse(row.crashed_at) : now;
    phaseMsRemaining = Math.max(0, crashedAt + GAME_CONFIG.crashedMs - now);
  }

  return {
    id: row.id,
    roundNumber: row.round_number,
    status: row.status,
    serverSeedHash: row.server_seed_hash,
    serverSeed: revealed ? row.server_seed : null,
    clientSeed: row.client_seed,
    nonce: row.nonce,
    crashMultiplier: revealed ? crash : null,
    houseEdge: num(row.house_edge) ?? GAME_CONFIG.houseEdge,
    bettingStartedAt: row.betting_started_at,
    startedAt: row.started_at,
    crashedAt: row.crashed_at,
    multiplier,
    phaseMsRemaining,
    serverNow: new Date(now).toISOString(),
  };
}
