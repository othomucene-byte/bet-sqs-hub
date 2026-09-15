/**
 * Servidor OAuth 2.0 (authorization code + PKCE) da Betfcom SQs.
 *
 * Permite que aplicações externas actuem em nome de um utilizador da
 * plataforma, com as permissões que ele aprovar. Códigos, segredos e tokens
 * ficam guardados apenas como impressão digital SHA-256; o consentimento é
 * dado numa página autenticada da própria plataforma.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const OAUTH_SCOPES = ["market:read", "trading:read", "trading:write", "stream:read"] as const;

export const ACCESS_TOKEN_TTL_SECONDS = 3600;
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
export const CODE_TTL_SECONDS = 300;

export const sha256 = (raw: string) => createHash("sha256").update(raw, "utf8").digest("hex");

const base64url = (bytes: Buffer) => bytes.toString("base64url");

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function normalizeScopes(requested: string | null | undefined, allowed: string[]) {
  const list = (requested ?? "market:read")
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
  const unique = [...new Set(list.length > 0 ? list : ["market:read"])];
  const invalid = unique.filter((scope) => !allowed.includes(scope));
  return { scopes: unique, invalid };
}

export async function getClient(clientId: string) {
  const db = await admin();
  const { data } = await db
    .from("oauth_clients")
    .select("client_id, client_secret_hash, name, redirect_uris, scopes, revoked_at, owner_user_id")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  return {
    clientId: data.client_id as string,
    secretHash: data.client_secret_hash as string,
    name: data.name as string,
    redirectUris: (data.redirect_uris as string[] | null) ?? [],
    scopes: (data.scopes as string[] | null) ?? [],
    ownerUserId: data.owner_user_id as string,
  };
}

/** Cria o código de autorização depois do utilizador aprovar o pedido. */
export async function issueAuthorizationCode(input: {
  clientId: string;
  userId: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge: string | null;
  codeChallengeMethod: "S256" | "plain" | null;
}) {
  const db = await admin();
  const code = `sqsac_${base64url(randomBytes(32))}`;
  const { error } = await db.from("oauth_authorization_codes").insert({
    client_id: input.clientId,
    user_id: input.userId,
    code_hash: sha256(code),
    redirect_uri: input.redirectUri,
    scopes: input.scopes,
    code_challenge: input.codeChallenge,
    code_challenge_method: input.codeChallengeMethod,
    expires_at: new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString(),
  });
  if (error) throw new Error(error.message);
  return code;
}

function verifyPkce(
  challenge: string | null,
  method: string | null,
  verifier: string | null,
): string | null {
  if (!challenge) return null;
  if (!verifier) return "code_verifier obrigatório para este pedido.";
  const computed =
    method === "plain" ? verifier : createHash("sha256").update(verifier, "utf8").digest("base64url");
  return safeEqual(computed, challenge) ? null : "code_verifier inválido.";
}

async function issueTokens(input: {
  clientId: string;
  userId: string;
  scopes: string[];
  environment: "SANDBOX" | "LIVE";
}) {
  const db = await admin();
  const accessToken = `sqsat_${base64url(randomBytes(32))}`;
  const refreshToken = `sqsrt_${base64url(randomBytes(32))}`;
  const { error } = await db.from("oauth_tokens").insert({
    client_id: input.clientId,
    user_id: input.userId,
    access_token_hash: sha256(accessToken),
    refresh_token_hash: sha256(refreshToken),
    scopes: input.scopes,
    environment: input.environment,
    expires_at: new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString(),
  });
  if (error) throw new Error(error.message);
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    scope: input.scopes.join(" "),
    environment: input.environment,
  };
}

/** Troca do código de autorização por tokens. */
export async function exchangeAuthorizationCode(input: {
  code: string;
  clientId: string;
  clientSecret: string | null;
  redirectUri: string;
  codeVerifier: string | null;
}) {
  const client = await getClient(input.clientId);
  if (!client) return { error: "invalid_client" as const };

  const db = await admin();
  const { data } = await db
    .from("oauth_authorization_codes")
    .select("id, client_id, user_id, redirect_uri, scopes, code_challenge, code_challenge_method, expires_at, used_at")
    .eq("code_hash", sha256(input.code))
    .maybeSingle();
  if (!data || data.client_id !== client.clientId) return { error: "invalid_grant" as const };
  if (data.used_at) return { error: "invalid_grant" as const, description: "Código já utilizado." };
  if (new Date(data.expires_at as string).getTime() <= Date.now()) {
    return { error: "invalid_grant" as const, description: "Código expirado." };
  }
  if (data.redirect_uri !== input.redirectUri) {
    return { error: "invalid_grant" as const, description: "redirect_uri não corresponde." };
  }

  const challenge = (data.code_challenge as string | null) ?? null;
  const pkceError = verifyPkce(challenge, (data.code_challenge_method as string | null) ?? null, input.codeVerifier);
  if (pkceError) return { error: "invalid_grant" as const, description: pkceError };

  // Sem PKCE, o segredo do cliente é obrigatório.
  if (!challenge) {
    if (!input.clientSecret || !safeEqual(sha256(input.clientSecret), client.secretHash)) {
      return { error: "invalid_client" as const };
    }
  } else if (input.clientSecret && !safeEqual(sha256(input.clientSecret), client.secretHash)) {
    return { error: "invalid_client" as const };
  }

  await db
    .from("oauth_authorization_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", data.id as string);

  const scopes = ((data.scopes as string[] | null) ?? []) as string[];
  return {
    tokens: await issueTokens({
      clientId: client.clientId,
      userId: data.user_id as string,
      scopes,
      environment: "SANDBOX",
    }),
  };
}

/** Renovação por refresh token (rotação: o antigo é revogado). */
export async function refreshAccessToken(input: {
  refreshToken: string;
  clientId: string;
  clientSecret: string | null;
}) {
  const client = await getClient(input.clientId);
  if (!client) return { error: "invalid_client" as const };
  if (input.clientSecret && !safeEqual(sha256(input.clientSecret), client.secretHash)) {
    return { error: "invalid_client" as const };
  }

  const db = await admin();
  const { data } = await db
    .from("oauth_tokens")
    .select("id, client_id, user_id, scopes, environment, revoked_at, created_at")
    .eq("refresh_token_hash", sha256(input.refreshToken))
    .maybeSingle();
  if (!data || data.client_id !== client.clientId) return { error: "invalid_grant" as const };
  if (data.revoked_at) return { error: "invalid_grant" as const, description: "Autorização revogada." };
  const issuedAt = new Date(data.created_at as string).getTime();
  if (Date.now() - issuedAt > REFRESH_TOKEN_TTL_SECONDS * 1000) {
    return { error: "invalid_grant" as const, description: "Autorização expirada." };
  }

  await db
    .from("oauth_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", data.id as string);

  return {
    tokens: await issueTokens({
      clientId: client.clientId,
      userId: data.user_id as string,
      scopes: ((data.scopes as string[] | null) ?? []) as string[],
      environment: data.environment as "SANDBOX" | "LIVE",
    }),
  };
}

/** Revogação de um token de acesso ou de renovação. */
export async function revokeToken(token: string) {
  const db = await admin();
  const digest = sha256(token);
  const now = new Date().toISOString();
  await db.from("oauth_tokens").update({ revoked_at: now }).eq("access_token_hash", digest);
  await db.from("oauth_tokens").update({ revoked_at: now }).eq("refresh_token_hash", digest);
  return { ok: true };
}
