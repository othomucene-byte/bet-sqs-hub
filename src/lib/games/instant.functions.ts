/**
 * Jogos de jogada individual — Roda da Betfcom, Chicken Choice e Leão Rei da Selva.
 *
 * Toda a decisão é do servidor: o resultado é selado antes da escolha, o valor
 * é debitado e pago dentro do ledger imutável e o cliente recebe apenas o que
 * pode ver. Enquanto a jogada está em curso, as armadilhas nunca saem do servidor.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const INSTANT_GAMES = ["wheel", "chicken", "lion"] as const;
export type InstantGame = (typeof INSTANT_GAMES)[number];

export const INSTANT_LIMITS = { minBet: 3, maxBet: 25_000, rtp: 0.97 } as const;

/** Setores visuais da Roda da Betfcom (a ordem é a mesma que o servidor sorteia). */
export const WHEEL_LAYOUT = [
  0, 1.5, 0, 2, 0, 1.5, 0, 3, 0, 1.5, 0, 2, 0, 5, 0, 1.5, 0, 10, 0, 25,
] as const;

export type InstantRoundView = {
  id: string;
  roundNumber: number;
  game: InstantGame;
  status: "open" | "cashed_out" | "lost";
  stake: number;
  funding: "wallet" | "bonus" | "free_bet";
  step: number;
  multiplier: number;
  payout: number | null;
  picks: number[];
  config: { doors?: number; levels?: number; tiles?: number; traps?: number };
  /** Compromisso publicado antes da jogada. */
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  /** Só depois de a jogada terminar. */
  serverSeed: string | null;
  /** Setor sorteado na roda — só depois de terminar. */
  sector: number | null;
  /** Armadilhas — só depois de terminar. */
  traps: number[] | null;
  /** Próximo multiplicador, se continuar. */
  nextMultiplier: number | null;
  createdAt: string;
  finishedAt: string | null;
};

type Row = Record<string, unknown>;

const num = (value: unknown): number => (value === null || value === undefined ? 0 : Number(value));

/** Multiplicador acumulado do Chicken — réplica de `public.chicken_multiplier`. */
export function chickenMultiplier(doors: number, step: number): number {
  return Math.round(INSTANT_LIMITS.rtp * Math.pow(doors / (doors - 1), step) * 10000) / 10000;
}

/** Multiplicador acumulado do Leão — réplica de `public.lion_multiplier`. */
export function lionMultiplier(tiles: number, traps: number, step: number): number {
  let m = INSTANT_LIMITS.rtp;
  for (let i = 0; i < step; i += 1) m = (m * (tiles - i)) / (tiles - traps - i);
  return Math.round(m * 10000) / 10000;
}

function project(row: Row): InstantRoundView {
  const status = row["status"] as InstantRoundView["status"];
  const finished = status !== "open";
  const game = row["game"] as InstantGame;
  const config = (row["config"] as InstantRoundView["config"] | null) ?? {};
  const outcome = (row["outcome"] as Row | null) ?? {};
  const step = Number(row["step"] ?? 0);

  let nextMultiplier: number | null = null;
  if (!finished) {
    if (game === "chicken" && config.doors) nextMultiplier = chickenMultiplier(config.doors, step + 1);
    if (game === "lion" && config.tiles && config.traps) {
      nextMultiplier = lionMultiplier(config.tiles, config.traps, step + 1);
    }
  }

  return {
    id: row["id"] as string,
    roundNumber: Number(row["round_number"]),
    game,
    status,
    stake: num(row["stake"]),
    funding: row["funding"] as InstantRoundView["funding"],
    step,
    multiplier: num(row["multiplier"]),
    payout: row["payout"] === null || row["payout"] === undefined ? null : num(row["payout"]),
    picks: ((row["picks"] as number[] | null) ?? []).map(Number),
    config,
    serverSeedHash: row["server_seed_hash"] as string,
    clientSeed: row["client_seed"] as string,
    nonce: Number(row["nonce"]),
    serverSeed: finished ? ((row["server_seed"] as string | null) ?? null) : null,
    sector: finished && outcome["sector"] !== undefined ? Number(outcome["sector"]) : null,
    traps: finished && outcome["traps"] ? ((outcome["traps"] as number[]).map(Number)) : null,
    nextMultiplier,
    createdAt: row["created_at"] as string,
    finishedAt: (row["finished_at"] as string | null) ?? null,
  };
}

const gameEnum = z.enum(INSTANT_GAMES);

const startInput = z.object({
  game: gameEnum,
  stake: z.number().min(INSTANT_LIMITS.minBet).max(INSTANT_LIMITS.maxBet),
  funding: z.enum(["wallet", "bonus", "free_bet"]).default("wallet"),
  freeBetId: z.string().uuid().nullable().optional(),
  /** Chicken: 2 a 5 portas. Leão: 1 a 10 armadilhas. */
  doors: z.number().int().min(2).max(5).optional(),
  traps: z.number().int().min(1).max(10).optional(),
});

/** Abre a jogada: sela o resultado e debita a aposta. */
export const startInstantRound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => startInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const config: Record<string, number> = {};
    if (data.game === "chicken") config["doors"] = data.doors ?? 3;
    if (data.game === "lion") config["traps"] = data.traps ?? 3;

    const { data: round, error } = await supabaseAdmin.rpc("instant_start", {
      _user_id: context.userId,
      _game: data.game,
      _stake: data.stake,
      _funding: data.funding,
      _free_bet_id: data.funding === "free_bet" ? (data.freeBetId ?? null) : null,
      _config: config,
    });

    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, round: project(round as unknown as Row) };
  });

/** Escolha do jogador (porta do Chicken ou casa do Leão). */
export const pickInstant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ roundId: z.string().uuid(), pick: z.number().int().min(0).max(24) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: round, error } = await supabaseAdmin.rpc("instant_pick", {
      _user_id: context.userId,
      _round_id: data.roundId,
      _pick: data.pick,
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, round: project(round as unknown as Row) };
  });

/** Levanta o prémio acumulado. */
export const cashoutInstant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ roundId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: round, error } = await supabaseAdmin.rpc("instant_cashout", {
      _user_id: context.userId,
      _round_id: data.roundId,
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, round: project(round as unknown as Row) };
  });

/** Jogada em curso (se existir) e histórico verificável do jogador. */
export const getInstantState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ game: gameEnum }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: open }, { data: history }] = await Promise.all([
      supabaseAdmin
        .from("instant_rounds")
        .select("*")
        .eq("user_id", context.userId)
        .eq("game", data.game)
        .eq("status", "open")
        .maybeSingle(),
      supabaseAdmin
        .from("instant_rounds")
        .select("*")
        .eq("user_id", context.userId)
        .eq("game", data.game)
        .neq("status", "open")
        .order("round_number", { ascending: false })
        .limit(20),
    ]);

    return {
      current: open ? project(open as unknown as Row) : null,
      history: (history ?? []).map((row) => project(row as unknown as Row)),
      limits: INSTANT_LIMITS,
    };
  });
