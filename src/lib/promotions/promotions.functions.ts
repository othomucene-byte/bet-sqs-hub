import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Promoções — o servidor é a única autoridade.
 *
 * O navegador nunca credita bónus nem decide elegibilidade: apenas lê o estado
 * e pede a atribuição, que é validada pelas funções de base de dados.
 */

export type PromotionView = {
  code: string;
  kind: "first_deposit" | "loss_recovery";
  name: string;
  description: string;
  active: boolean;
};

export type FreeBetView = {
  id: string;
  minAmount: number;
  maxAmount: number;
  expiresAt: string;
};

export type BonusState = {
  promotions: PromotionView[];
  bonusBalance: number;
  bonusExpiresAt: string | null;
  freeBets: FreeBetView[];
  lostToday: number;
  threshold: number;
  hasFirstDepositBonus: boolean;
  eligibleForLossRecovery: boolean;
  cooldownUntil: string | null;
};

function mzDay(): string {
  const now = new Date(Date.now() + 2 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

/** Estado completo das promoções do utilizador autenticado. */
export const getBonusState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BonusState> => {
    const { supabase, userId } = context;

    const [promos, wallet, grants, freeBets, streak] = await Promise.all([
      supabase.from("promotions").select("code, kind, name, description, active").order("code"),
      supabase.from("bonus_wallets").select("balance").eq("user_id", userId).maybeSingle(),
      supabase
        .from("bonus_grants")
        .select("kind, status, expires_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("free_bets")
        .select("id, min_amount, max_amount, expires_at")
        .eq("user_id", userId)
        .eq("status", "available")
        .gt("expires_at", new Date().toISOString())
        .order("expires_at"),
      supabase
        .from("loss_streaks")
        .select("lost_amount")
        .eq("user_id", userId)
        .eq("day", mzDay())
        .maybeSingle(),
    ]);

    const promotions = (promos.data ?? []).map((row) => ({
      code: row.code as string,
      kind: row.kind as "first_deposit" | "loss_recovery",
      name: row.name as string,
      description: row.description as string,
      active: Boolean(row.active),
    }));

    const grantRows = grants.data ?? [];
    const firstDeposit = grantRows.find((row) => row.kind === "first_deposit");
    const lastRecovery = grantRows.find((row) => row.kind === "loss_recovery");
    const cooldownUntil = lastRecovery
      ? new Date(new Date(lastRecovery.created_at as string).getTime() + 7 * 864e5).toISOString()
      : null;

    const lostToday = Number(streak.data?.lost_amount ?? 0);
    const threshold = 200;

    return {
      promotions,
      bonusBalance: Number(wallet.data?.balance ?? 0),
      bonusExpiresAt:
        firstDeposit && firstDeposit.status === "granted"
          ? ((firstDeposit.expires_at as string | null) ?? null)
          : null,
      freeBets: (freeBets.data ?? []).map((row) => ({
        id: row.id as string,
        minAmount: Number(row.min_amount),
        maxAmount: Number(row.max_amount),
        expiresAt: row.expires_at as string,
      })),
      lostToday,
      threshold,
      hasFirstDepositBonus: Boolean(firstDeposit),
      eligibleForLossRecovery:
        lostToday >= threshold && (!cooldownUntil || new Date(cooldownUntil) <= new Date()),
      cooldownUntil,
    };
  });

/** Pede a atribuição das 4 apostas grátis. A elegibilidade é validada no servidor. */
export const claimLossRecovery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin.rpc("maybe_grant_loss_recovery", {
      _user_id: context.userId,
    });

    if (error) return { ok: false as const, error: error.message };
    if (!data) {
      return {
        ok: false as const,
        error:
          "Ainda não reúnes as condições: são necessárias perdas reais de 200 MZN ou mais no mesmo dia e no máximo uma recompensa por semana.",
      };
    }
    return { ok: true as const };
  });
