import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InvestmentOrder = {
  id: string;
  side: "buy" | "redeem";
  amount: number;
  executedAmount: number;
  currency: string;
  status: string;
  reference: string;
  failureReason: string | null;
  createdAt: string;
  productName: string | null;
  companyName: string | null;
};

/** Histórico de ordens do próprio utilizador. */
export const listOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(100).default(50) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<InvestmentOrder[]> => {
    const { data: rows } = await context.supabase
      .from("investment_orders")
      .select(
        "id, side, amount, executed_amount, currency, status, reference, failure_reason, created_at, investment_products(name, companies(name))",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    return (rows ?? []).map((row) => {
      const product = row.investment_products as
        | { name: string; companies: { name: string } | null }
        | null;
      return {
        id: row.id,
        side: row.side as "buy" | "redeem",
        amount: Number(row.amount),
        executedAmount: Number(row.executed_amount),
        currency: row.currency,
        status: row.status,
        reference: row.reference,
        failureReason: row.failure_reason,
        createdAt: row.created_at,
        productName: product?.name ?? null,
        companyName: product?.companies?.name ?? null,
      };
    });
  });

/** Subscrição: ordem idempotente, validada e liquidada no servidor. */
export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        productId: z.string().uuid(),
        amount: z.number().positive().max(100_000_000),
        idempotencyKey: z.string().trim().min(8).max(80),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.rpc("place_investment_order", {
      _user_id: context.userId,
      _product_id: data.productId,
      _amount: data.amount,
      _idempotency_key: data.idempotencyKey,
    });
    if (error) throw new Error(error.message);
    const order = row as unknown as { id: string; status: string; reference: string };
    return { id: order.id, status: order.status, reference: order.reference };
  });

/** Resgate: devolve capital + resultado já registado à carteira de investimentos. */
export const redeem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        investmentId: z.string().uuid(),
        idempotencyKey: z.string().trim().min(8).max(80),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.rpc("redeem_investment", {
      _user_id: context.userId,
      _investment_id: data.investmentId,
      _idempotency_key: data.idempotencyKey,
    });
    if (error) throw new Error(error.message);
    const order = row as unknown as { id: string; status: string; reference: string };
    return { id: order.id, status: order.status, reference: order.reference };
  });
