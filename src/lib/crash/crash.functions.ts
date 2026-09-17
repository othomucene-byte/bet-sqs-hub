import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

import { GAME_CONFIG } from "./fair";

/**
 * Estado da ronda corrente. Público (o histórico do Crash é público) e é este
 * pedido que faz avançar a máquina de estados no servidor.
 */
const gameInput = z.object({
  game: z.enum(["aviator", "fish", "navigator", "boost"]).default("aviator"),
});

export const getCurrentRound = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => gameInput.parse(input ?? {}))
  .handler(async ({ data }) => {
  const { advanceRound, toPublicRound } = await import("./engine.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const round = toPublicRound(await advanceRound(data.game));

  const { data: history } = await supabaseAdmin
    .from("game_rounds")
    .select("round_number, crash_multiplier, status")
    .eq("game", data.game)
    .in("status", ["CRASHED", "SETTLED"])
    .order("round_number", { ascending: false })
    .limit(20);

  const { count: playersInRound } = await supabaseAdmin
    .from("game_bets")
    .select("id", { count: "exact", head: true })
    .eq("round_id", round.id);

  return {
    round,
    playersInRound: playersInRound ?? 0,
    history: (history ?? []).map((row) => ({
      roundNumber: row.round_number as number,
      multiplier: row.crash_multiplier === null ? null : Number(row.crash_multiplier),
    })),
    config: {
      minBet: GAME_CONFIG.minBet,
      maxBet: GAME_CONFIG.maxBet,
      houseEdge: GAME_CONFIG.houseEdge,
    },
  };
  });

const placeBetInput = z.object({
  roundId: z.string().uuid(),
  amount: z.number().min(GAME_CONFIG.minBet).max(GAME_CONFIG.maxBet),
  autoCashout: z.number().min(1.01).max(10000).nullable().optional(),
  /** Painel de aposta (1 ou 2): permite duas apostas independentes por ronda. */
  slot: z.union([z.literal(1), z.literal(2)]).default(1),
  /** Origem do valor: saldo real, saldo bónus jogável ou aposta grátis. */
  funding: z.enum(["wallet", "bonus", "free_bet"]).default("wallet"),
  freeBetId: z.string().uuid().nullable().optional(),
});

/** Coloca a aposta. O valor é debitado pelo servidor, dentro do ledger. */
export const placeBet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => placeBetInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const args = {
      _user_id: context.userId,
      _round_id: data.roundId,
      _amount: data.amount,
      _slot: data.slot,
      _funding: data.funding,
      _free_bet_id: data.funding === "free_bet" ? (data.freeBetId ?? null) : null,
      _auto_cashout: data.autoCashout ?? null,
    };

    const { data: bet, error } = await supabaseAdmin.rpc(
      "place_bet",
      args as unknown as { _user_id: string; _round_id: string; _amount: number; _slot: number },
    );

    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, bet };
  });

/**
 * Cash-out. O multiplicador é o do relógio do servidor — o cliente não o envia.
 * Repetições devolvem o mesmo resultado (idempotente via `reference` no ledger).
 */
export const cashout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ betId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { advanceRound } = await import("./engine.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Garante que o estado da ronda está atualizado antes de validar o cash-out.
    await advanceRound();

    const { data: bet, error } = await supabaseAdmin.rpc("cashout_bet", {
      _user_id: context.userId,
      _bet_id: data.betId,
    });

    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, bet };
  });

/** Apostas do utilizador na ronda indicada (um registo por painel). */
export const getMyBets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ roundId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("game_bets")
      .select("id, amount, auto_cashout, cashout_multiplier, payout, status, slot")
      .eq("round_id", data.roundId)
      .eq("user_id", context.userId);

    return (rows ?? []).map((bet) => ({
      id: bet.id as string,
      slot: (Number(bet.slot) === 2 ? 2 : 1) as 1 | 2,
      amount: Number(bet.amount),
      autoCashout: bet.auto_cashout === null ? null : Number(bet.auto_cashout),
      cashoutMultiplier: bet.cashout_multiplier === null ? null : Number(bet.cashout_multiplier),
      payout: bet.payout === null ? null : Number(bet.payout),
      status: bet.status as "active" | "cashed_out" | "lost" | "refunded",
    }));
  });

/** Aposta do utilizador na ronda indicada, se existir. */
export const getMyBet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ roundId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: bet } = await context.supabase
      .from("game_bets")
      .select("id, amount, auto_cashout, cashout_multiplier, payout, status")
      .eq("round_id", data.roundId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!bet) return null;
    return {
      id: bet.id as string,
      amount: Number(bet.amount),
      autoCashout: bet.auto_cashout === null ? null : Number(bet.auto_cashout),
      cashoutMultiplier: bet.cashout_multiplier === null ? null : Number(bet.cashout_multiplier),
      payout: bet.payout === null ? null : Number(bet.payout),
      status: bet.status as "active" | "cashed_out" | "lost" | "refunded",
    };
  });

/**
 * Estatísticas públicas da ronda e maiores ganhos recentes.
 * Só leitura; os nomes de outros jogadores são mascarados.
 */
export const getRoundStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ roundId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { maskName } = await import("./stats.server");

    const [{ data: roundBets }, { data: topBets }] = await Promise.all([
      supabaseAdmin
        .from("game_bets")
        .select("id, amount, cashout_multiplier, payout, status, user_id")
        .eq("round_id", data.roundId)
        .order("amount", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("game_bets")
        .select("id, amount, cashout_multiplier, payout, user_id")
        .eq("status", "cashed_out")
        .order("payout", { ascending: false })
        .limit(10),
    ]);

    const ids = new Set<string>();
    for (const row of roundBets ?? []) ids.add(row.user_id as string);
    for (const row of topBets ?? []) ids.add(row.user_id as string);

    const { data: profiles } = ids.size
      ? await supabaseAdmin.from("profiles").select("id, display_name").in("id", [...ids])
      : { data: [] as { id: string; display_name: string | null }[] };

    const names = new Map<string, string>();
    for (const p of profiles ?? []) names.set(p.id as string, maskName(p.display_name));

    const map = (row: Record<string, unknown>) => ({
      id: row["id"] as string,
      player: names.get(row["user_id"] as string) ?? "Jogador",
      amount: Number(row["amount"]),
      multiplier: row["cashout_multiplier"] === null ? null : Number(row["cashout_multiplier"]),
      payout: row["payout"] === null ? null : Number(row["payout"]),
      status: (row["status"] as string | undefined) ?? "cashed_out",
    });

    const bets = (roundBets ?? []).map(map);
    const userId = context?.userId ?? "";
    const myBets = bets.filter((row) => (roundBets ?? []).some((raw) => raw.id === row.id && raw.user_id === userId));
    return {
      bets,
      myBets,
      top: (topBets ?? []).map(map),
      totalBets: bets.length,
      totalStaked: bets.reduce((sum, b) => sum + b.amount, 0),
      totalPaid: bets.reduce((sum, b) => sum + (b.payout ?? 0), 0),
    };
  });

/** Dados de verificação de uma ronda terminada (provably fair). */
export const revealRound = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ roundNumber: z.number().int() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("round_reveal", {
      _round_number: data.roundNumber,
    });
    if (error || !rows || rows.length === 0) return null;

    const row = rows[0] as Record<string, unknown>;
    return {
      roundNumber: Number(row["round_number"]),
      serverSeed: row["server_seed"] as string | null,
      serverSeedHash: row["server_seed_hash"] as string,
      clientSeed: row["client_seed"] as string,
      nonce: Number(row["nonce"]),
      crashMultiplier: row["crash_multiplier"] === null ? null : Number(row["crash_multiplier"]),
    };
  });
