import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SCOPES = ["market:read", "trading:read", "trading:write", "stream:read"] as const;

const createSchema = z.object({
  name: z.string().trim().min(2).max(60),
  environment: z.enum(["SANDBOX", "LIVE"]),
  scopes: z.array(z.enum(SCOPES)).min(1).default(["market:read"]),
});

export type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  environment: "SANDBOX" | "LIVE";
  scopes: string[];
  lastUsedAt: string | null;
  requestCount: number;
  revokedAt: string | null;
  createdAt: string;
};

/** Chaves da conta autenticada (nunca devolve o valor completo). */
export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ keys: ApiKeyRow[]; recent: Array<{ path: string; status: number; createdAt: string }> }> => {
    const { supabase, userId } = context;
    const [keysRes, logRes] = await Promise.all([
      supabase
        .from("api_keys")
        .select("id, name, prefix, environment, scopes, last_used_at, request_count, revoked_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("api_request_log")
        .select("path, status, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    return {
      keys: (keysRes.data ?? []).map((row) => ({
        id: row.id as string,
        name: row.name as string,
        prefix: row.prefix as string,
        environment: row.environment as "SANDBOX" | "LIVE",
        scopes: ((row.scopes as string[] | null) ?? []) as string[],
        lastUsedAt: (row.last_used_at as string | null) ?? null,
        requestCount: Number(row.request_count ?? 0),
        revokedAt: (row.revoked_at as string | null) ?? null,
        createdAt: row.created_at as string,
      })),
      recent: (logRes.data ?? []).map((row) => ({
        path: row.path as string,
        status: Number(row.status),
        createdAt: row.created_at as string,
      })),
    };
  });

/**
 * Cria uma chave. O valor completo é devolvido uma única vez; na base fica
 * apenas a impressão digital SHA-256.
 */
export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { count } = await supabase
      .from("api_keys")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("revoked_at", null);
    if ((count ?? 0) >= 10) {
      throw new Error("Limite de 10 chaves activas atingido. Revogue uma chave antes de criar outra.");
    }

    const { randomBytes, createHash } = await import("node:crypto");
    const env = data.environment === "LIVE" ? "live" : "test";
    const secret = randomBytes(24).toString("base64url");
    const token = `sqs_${env}_${secret}`;
    const prefix = token.slice(0, 16);
    const keyHash = createHash("sha256").update(token, "utf8").digest("hex");

    // A tabela não permite inserção pelo utilizador: as credenciais são
    // sempre criadas pelo servidor, depois de confirmada a sessão.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error } = await supabaseAdmin
      .from("api_keys")
      .insert({
        user_id: userId,
        name: data.name,
        prefix,
        key_hash: keyHash,
        environment: data.environment,
        scopes: data.scopes,
      })
      .select("id, created_at")
      .single();
    if (error) throw new Error(error.message);

    return { id: inserted.id as string, token, prefix, createdAt: inserted.created_at as string };
  });

/** Revoga uma chave da própria conta. */
export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
