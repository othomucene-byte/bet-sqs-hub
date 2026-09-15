/**
 * Autenticação da API pública da Betfcom SQs.
 *
 * Server-only. Aceita dois tipos de credencial no cabeçalho
 * `Authorization: Bearer ...`:
 *  - chave de API da própria conta (`sqs_live_...` / `sqs_test_...`);
 *  - token de acesso OAuth emitido a uma aplicação externa (`sqsat_...`).
 *
 * Nenhum segredo é guardado em claro: só a impressão digital SHA-256.
 * Cada pedido válido actualiza a última utilização e fica registado em
 * api_request_log.
 */

import { createHash } from "node:crypto";

export const API_SCOPES = [
  "market:read",
  "trading:read",
  "trading:write",
  "stream:read",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export type ApiCaller = {
  keyId: string | null;
  tokenId: string | null;
  clientId: string | null;
  userId: string;
  environment: "SANDBOX" | "LIVE";
  scopes: string[];
  /** Ambiente de negociação correspondente ao ambiente da credencial. */
  tradingEnvironment: "PAPER" | "LIVE";
};

export const hashKey = (raw: string) => createHash("sha256").update(raw, "utf8").digest("hex");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, idempotency-key",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

export const apiJson = (body: unknown, status = 200, cache = "public, max-age=5") =>
  Response.json(body, { status, headers: { ...CORS, "Cache-Control": cache } });

export const apiError = (status: number, message: string) =>
  Response.json({ error: message }, { status, headers: { ...CORS, "Cache-Control": "no-store" } });

export const apiOptions = () => new Response(null, { status: 204, headers: CORS });

export const corsHeaders = () => ({ ...CORS });

function tradingEnvironmentFor(environment: "SANDBOX" | "LIVE"): "PAPER" | "LIVE" {
  return environment === "LIVE" ? "LIVE" : "PAPER";
}

/**
 * Valida a credencial enviada. Devolve o autor do pedido ou uma resposta de
 * erro pronta a entregar.
 */
export async function authenticateApiRequest(
  request: Request,
  scope: ApiScope = "market:read",
): Promise<{ caller: ApiCaller } | { response: Response }> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+([A-Za-z0-9_.-]+)$/.exec(header.trim());
  const token = match?.[1];
  if (!token) {
    return {
      response: apiError(401, "Falta a credencial no cabeçalho Authorization: Bearer ..."),
    };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const digest = hashKey(token);

  if (token.startsWith("sqsat_")) {
    const { data, error } = await supabaseAdmin
      .from("oauth_tokens")
      .select("id, client_id, user_id, scopes, environment, expires_at, revoked_at")
      .eq("access_token_hash", digest)
      .maybeSingle();
    if (error) return { response: apiError(500, "Não foi possível validar o token.") };
    if (!data) return { response: apiError(401, "Token de acesso inválido.") };
    if (data.revoked_at) return { response: apiError(401, "Token de acesso revogado.") };
    if (new Date(data.expires_at as string).getTime() <= Date.now()) {
      return { response: apiError(401, "Token de acesso expirado.") };
    }
    const scopes = ((data.scopes as string[] | null) ?? []) as string[];
    if (!scopes.includes(scope)) {
      return { response: apiError(403, `O token não tem a permissão ${scope}.`) };
    }
    await supabaseAdmin
      .from("oauth_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id as string);
    const environment = data.environment as "SANDBOX" | "LIVE";
    return {
      caller: {
        keyId: null,
        tokenId: data.id as string,
        clientId: data.client_id as string,
        userId: data.user_id as string,
        environment,
        scopes,
        tradingEnvironment: tradingEnvironmentFor(environment),
      },
    };
  }

  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, user_id, environment, scopes, revoked_at, request_count")
    .eq("key_hash", digest)
    .maybeSingle();

  if (error) return { response: apiError(500, "Não foi possível validar a chave.") };
  if (!data) return { response: apiError(401, "Chave de API inválida.") };
  if (data.revoked_at) return { response: apiError(401, "Chave de API revogada.") };

  const scopes = (data.scopes as string[] | null) ?? [];
  if (!scopes.includes(scope)) {
    return { response: apiError(403, `A chave não tem a permissão ${scope}.`) };
  }

  await supabaseAdmin
    .from("api_keys")
    .update({
      last_used_at: new Date().toISOString(),
      request_count: Number(data.request_count ?? 0) + 1,
    })
    .eq("id", data.id as string);

  const environment = data.environment as "SANDBOX" | "LIVE";
  return {
    caller: {
      keyId: data.id as string,
      tokenId: null,
      clientId: null,
      userId: data.user_id as string,
      environment,
      scopes,
      tradingEnvironment: tradingEnvironmentFor(environment),
    },
  };
}

/** Registo do pedido (não bloqueia a resposta em caso de falha). */
export async function logApiRequest(keyId: string | null, path: string, status: number) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("api_request_log").insert({ api_key_id: keyId, path, status });
  } catch (error) {
    console.error("[api] falha ao registar pedido", error);
  }
}
