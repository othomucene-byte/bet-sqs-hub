import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type WalletSummary = {
  id: string;
  kind: "betting" | "investment";
  balance: number;
  reserved: number;
  currency: string;
  status: "active" | "frozen" | "closed";
};

/** Saldo lido do servidor. O frontend nunca calcula nem guarda saldo. */
export const getWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WalletSummary | null> => {
    const { data } = await context.supabase
      .from("wallets")
      .select("id, kind, balance, reserved, currency, status")
      .eq("user_id", context.userId)
      .eq("kind", "betting")
      .maybeSingle();

    if (!data) return null;
    return {
      id: data.id as string,
      kind: data.kind as "betting" | "investment",
      balance: Number(data.balance),
      reserved: Number(data.reserved),
      currency: data.currency as string,
      status: data.status as "active" | "frozen" | "closed",
    };
  });

/** Extrato do ledger — histórico imutável de cada movimento. */
export const getTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(100).default(25) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("wallet_transactions")
      .select("id, type, amount, balance_after, reference, status, provider, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    return (rows ?? []).map((row) => ({
      id: row.id as string,
      type: row.type as string,
      amount: Number(row.amount),
      balanceAfter: Number(row.balance_after),
      reference: row.reference as string,
      status: row.status as string,
      provider: row.provider as string | null,
      createdAt: row.created_at as string,
    }));
  });
