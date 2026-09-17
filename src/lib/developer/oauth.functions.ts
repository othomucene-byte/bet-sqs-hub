import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SCOPES = ["market:read", "trading:read", "trading:write", "stream:read"] as const;

export type OAuthClientRow = {
  id: string;
  clientId: string;
  name: string;
  redirectUris: string[];
  scopes: string[];
  revokedAt: string | null;
  createdAt: string;
};

export type AuthorizationRow = {
  id: string;
  clientId: string;
  clientName: string;
  scopes: string[];
  environment: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
};

/** Aplicações registadas pela conta e autorizações que a conta concedeu. */
export const listOAuthClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ clients: OAuthClientRow[]; authorizations: AuthorizationRow[] }> => {
    const { supabase, userId } = context;
    const [clientsRes, tokensRes] = await Promise.all([
      supabase
        .from("oauth_clients")
        .select("id, client_id, name, redirect_uris, scopes, revoked_at, created_at")
        .eq("owner_user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("oauth_tokens")
        .select("id, client_id, scopes, environment, expires_at, revoked_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    const clientIds = [...new Set((tokensRes.data ?? []).map((row) => row.client_id as string))];
    const names = new Map<string, string>();
    if (clientIds.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await supabaseAdmin
        .from("oauth_clients")
        .select("client_id, name")
        .in("client_id", clientIds);
      for (const row of data ?? []) names.set(row.client_id as string, row.name as string);
    }

    return {
      clients: (clientsRes.data ?? []).map((row) => ({
        id: row.id as string,
        clientId: row.client_id as string,
        name: row.name as string,
        redirectUris: ((row.redirect_uris as string[] | null) ?? []) as string[],
        scopes: ((row.scopes as string[] | null) ?? []) as string[],
        revokedAt: (row.revoked_at as string | null) ?? null,
        createdAt: row.created_at as string,
      })),
      authorizations: (tokensRes.data ?? []).map((row) => ({
        id: row.id as string,
        clientId: row.client_id as string,
        clientName: names.get(row.client_id as string) ?? (row.client_id as string),
        scopes: ((row.scopes as string[] | null) ?? []) as string[],
        environment: row.environment as string,
        expiresAt: row.expires_at as string,
        revokedAt: (row.revoked_at as string | null) ?? null,
        createdAt: row.created_at as string,
      })),
    };
  });

/** Registo de uma aplicação. O segredo é mostrado uma única vez. */
export const createOAuthClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(60),
        redirectUris: z.array(z.string().trim().url().max(300)).min(1).max(5),
        scopes: z.array(z.enum(SCOPES)).min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { randomBytes, createHash } = await import("node:crypto");
    const clientId = `sqscl_${randomBytes(12).toString("hex")}`;
    const clientSecret = `sqscs_${randomBytes(24).toString("base64url")}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error } = await supabaseAdmin
      .from("oauth_clients")
      .insert({
        owner_user_id: context.userId,
        client_id: clientId,
        client_secret_hash: createHash("sha256").update(clientSecret, "utf8").digest("hex"),
        name: data.name,
        redirect_uris: data.redirectUris,
        scopes: data.scopes,
      })
      .select("id, created_at")
      .single();
    if (error) throw new Error(error.message);

    return {
      id: inserted.id as string,
      clientId,
      clientSecret,
      createdAt: inserted.created_at as string,
    };
  });

/** Desactiva a aplicação e revoga todas as autorizações emitidas por ela. */
export const revokeOAuthClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const { data: row, error } = await context.supabase
      .from("oauth_clients")
      .update({ revoked_at: now })
      .eq("id", data.id)
      .eq("owner_user_id", context.userId)
      .select("client_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (row?.client_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("oauth_tokens")
        .update({ revoked_at: now })
        .eq("client_id", row.client_id as string)
        .is("revoked_at", null);
    }
    return { ok: true };
  });

/** A própria conta retira o acesso concedido a uma aplicação. */
export const revokeAuthorization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("oauth_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const authorizeSchema = z.object({
  clientId: z.string().trim().min(6).max(80),
  redirectUri: z.string().trim().url().max(300),
  scope: z.string().trim().max(200).nullable().default(null),
  state: z.string().trim().max(300).nullable().default(null),
  codeChallenge: z.string().trim().max(200).nullable().default(null),
  codeChallengeMethod: z.enum(["S256", "plain"]).nullable().default(null),
});

/** Dados do pedido de autorização para o ecrã de consentimento. */
export const describeAuthorization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => authorizeSchema.parse(input))
  .handler(async ({ data }) => {
    const { getClient, normalizeScopes } = await import("./oauth.server");
    const client = await getClient(data.clientId);
    if (!client) return { error: "Aplicação desconhecida ou desactivada." as const };
    if (!client.redirectUris.includes(data.redirectUri)) {
      return { error: "O endereço de retorno não está registado nesta aplicação." as const };
    }
    const { scopes, invalid } = normalizeScopes(data.scope, client.scopes);
    if (invalid.length > 0) {
      return { error: `Permissões não autorizadas para esta aplicação: ${invalid.join(", ")}` as const };
    }
    return { client: { name: client.name, clientId: client.clientId }, scopes };
  });

/** Aprovação: gera o código de autorização e devolve o endereço de retorno. */
export const approveAuthorization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => authorizeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { getClient, normalizeScopes, issueAuthorizationCode } = await import("./oauth.server");
    const client = await getClient(data.clientId);
    if (!client) throw new Error("Aplicação desconhecida ou desactivada.");
    if (!client.redirectUris.includes(data.redirectUri)) {
      throw new Error("O endereço de retorno não está registado nesta aplicação.");
    }
    const { scopes, invalid } = normalizeScopes(data.scope, client.scopes);
    if (invalid.length > 0) throw new Error("Permissões não autorizadas para esta aplicação.");

    const code = await issueAuthorizationCode({
      clientId: client.clientId,
      userId: context.userId,
      redirectUri: data.redirectUri,
      scopes,
      codeChallenge: data.codeChallenge,
      codeChallengeMethod: data.codeChallengeMethod,
    });

    const url = new URL(data.redirectUri);
    url.searchParams.set("code", code);
    if (data.state) url.searchParams.set("state", data.state);
    return { redirectTo: url.toString() };
  });
