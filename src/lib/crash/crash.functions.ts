import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

import { GAME_CONFIG } from "./fair";

/**
 * Estado da ronda corrente. Público (o histórico do Crash é público) e é este
 * pedido que faz avançar a máquina de estados no servidor.
 */
export const getCurrentRound = createServerFn({ method: "GET" }).handler(async () => {
  const { advanceRound, toPublicRound } = await import("./engine.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const round = toPublicRound(await advanceRound());

  const { data: history } = await supabaseAdmin
    .from("game_rounds")
    .select("round_number, crash_multiplier, status")
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
});

/** Coloca a aposta. O valor é debitado pelo servidor, dentro do ledger. */
export const placeBet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => placeBetInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: bet, error } = await supabaseAdmin.rpc("place_bet", {
      _user_id: context.userId,
      _round_id: data.roundId,
      _amount: data.amount,
      _auto_cashout: data.autoCashout ?? undefined,
    });

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
