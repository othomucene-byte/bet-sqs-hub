/**
 * Autenticação da API pública da Betfcom SQs por chave de API.
 *
 * Server-only. A chave completa nunca é guardada: só a impressão digital
 * (SHA-256). Cada pedido válido actualiza a última utilização e o contador,
 * e fica registado em api_request_log.
 */

import { createHash } from "node:crypto";

export type ApiCaller = {
  keyId: string;
  userId: string;
  environment: "SANDBOX" | "LIVE";
  scopes: string[];
};

export const hashKey = (raw: string) => createHash("sha256").update(raw, "utf8").digest("hex");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export const apiJson = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { ...CORS, "Cache-Control": "public, max-age=5" },
  });

export const apiError = (status: number, message: string) =>
  Response.json({ error: message }, { status, headers: CORS });

export const apiOptions = () => new Response(null, { status: 204, headers: CORS });

/**
 * Valida a chave enviada em `Authorization: Bearer sqs_...`.
 * Devolve o autor do pedido ou uma resposta de erro pronta a entregar.
 */
export async function authenticateApiRequest(
  request: Request,
  scope = "market:read",
): Promise<{ caller: ApiCaller } | { response: Response }> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+([A-Za-z0-9_-]+)$/.exec(header.trim());
  const token = match?.[1];
  if (!token) {
    return {
      response: apiError(401, "Falta a chave de API no cabeçalho Authorization: Bearer sqs_..."),
    };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, user_id, environment, scopes, revoked_at, request_count")
    .eq("key_hash", hashKey(token))
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

  return {
    caller: {
      keyId: data.id as string,
      userId: data.user_id as string,
      environment: data.environment as "SANDBOX" | "LIVE",
      scopes,
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
