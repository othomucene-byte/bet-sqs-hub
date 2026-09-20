import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Backoffice PayTED → e-Mola. Só leitura agregada e reconciliação contra o
 * gateway. Nenhum segredo é devolvido ao browser e o número e-Mola é
 * mascarado no servidor.
 */
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function maskMsisdn(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 6) return "•••";
  return `${digits.slice(0, 3)}•••${digits.slice(-2)}`;
}

export type PaytedAdminRow = {
  id: string;
  reference: string;
  direction: "deposit" | "withdrawal";
  status: string;
  amount: number;
  providerFee: number;
  netAmount: number;
  paytedReference: string | null;
  payerMasked: string | null;
  createdAt: string;
  updatedAt: string | null;
  webhookReceived: boolean;
  webhookEvent: string | null;
  reconciled: boolean;
};

export type PaytedAdminSummary = {
  configured: boolean;
  missingSecrets: string[];
  webhookUrl: string;
  deposits: { count: number; gross: number; net: number; fees: number };
  payouts: { count: number; gross: number; net: number; fees: number };
  pending: number;
  completed: number;
  failed: number;
};

/** Operações e-Mola via PayTED com custos e estado de reconciliação. */
export const getPaytedAdminData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ summary: PaytedAdminSummary; rows: PaytedAdminRow[] }> => {
    const admin = await assertAdmin(context as any);
    const { isPaytedConfigured, PAYTED_REQUIRED_SECRETS } = await import(
      "@/lib/payments/payted.server"
    );

    const [{ data: intents }, { data: events }] = await Promise.all([
      admin
        .from("payment_intents")
        .select(
          "id, reference, direction, status, amount, provider_fee, net_amount, provider_transaction_id, payer_identifier, created_at, updated_at",
        )
        .eq("provider", "payted")
        .order("created_at", { ascending: false })
        .limit(200),
      admin
        .from("payted_webhook_events")
        .select("reference, event, handled, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    const webhooks = new Map<string, { event: string; handled: boolean }>();
    for (const event of events ?? []) {
      const reference = (event as any).reference as string | null;
      if (!reference || webhooks.has(reference)) continue;
      webhooks.set(reference, {
        event: (event as any).event as string,
        handled: Boolean((event as any).handled),
      });
    }

    const rows: PaytedAdminRow[] = (intents ?? []).map((row: any) => {
      const hook = webhooks.get(row.reference as string);
      const amount = Number(row.amount);
      const fee = Number(row.provider_fee ?? 0);
      return {
        id: row.id as string,
        reference: row.reference as string,
        direction: row.direction as "deposit" | "withdrawal",
        status: row.status as string,
        amount,
        providerFee: fee,
        netAmount: row.net_amount === null ? amount - fee : Number(row.net_amount),
        paytedReference: (row.provider_transaction_id as string | null) ?? null,
        payerMasked: maskMsisdn((row.payer_identifier as string | null) ?? null),
        createdAt: row.created_at as string,
        updatedAt: (row.updated_at as string | null) ?? null,
        webhookReceived: Boolean(hook),
        webhookEvent: hook?.event ?? null,
        reconciled: row.status === "succeeded" || row.status === "failed",
      };
    });

    const totals = (direction: "deposit" | "withdrawal") => {
      const subset = rows.filter((r) => r.direction === direction && r.status === "succeeded");
      return {
        count: subset.length,
        gross: subset.reduce((sum, r) => sum + r.amount, 0),
        fees: subset.reduce((sum, r) => sum + r.providerFee, 0),
        net: subset.reduce((sum, r) => sum + r.netAmount, 0),
      };
    };

    const missing = PAYTED_REQUIRED_SECRETS.filter((name) => !process.env[name]);

    return {
      summary: {
        configured: isPaytedConfigured(),
        missingSecrets: missing,
        webhookUrl: "https://betfcom.com/api/public/webhooks/payted",
        deposits: totals("deposit"),
        payouts: totals("withdrawal"),
        pending: rows.filter((r) => r.status === "pending").length,
        completed: rows.filter((r) => r.status === "succeeded").length,
        failed: rows.filter((r) => r.status === "failed" || r.status === "expired").length,
      },
      rows,
    };
  });

/** Reconciliação manual de uma operação PayTED contra o gateway. */
export const reconcilePaytedPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ reference: z.string().trim().min(6).max(120) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as any);
    const { data: intent, error } = await admin
      .from("payment_intents")
      .select(
        "id, user_id, wallet_id, direction, amount, reference, status, provider_transaction_id",
      )
      .eq("reference", data.reference)
      .eq("provider", "payted")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!intent) throw new Error("Operação PayTED não encontrada.");

    const { syncPaytedIntent } = await import("@/lib/payments/payted.server");
    return syncPaytedIntent({
      id: intent.id as string,
      user_id: intent.user_id as string,
      wallet_id: intent.wallet_id as string,
      direction: intent.direction as string,
      amount: intent.amount as number,
      reference: intent.reference as string,
      status: intent.status as string,
      provider_transaction_id: (intent.provider_transaction_id as string | null) ?? null,
    });
  });
