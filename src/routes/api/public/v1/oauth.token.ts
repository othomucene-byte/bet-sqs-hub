import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/public/v1/oauth/token — emissão de tokens OAuth 2.0.
 * Suporta grant_type=authorization_code (com PKCE) e refresh_token.
 */
export const Route = createFileRoute("/api/public/v1/oauth/token")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { apiOptions } = await import("@/lib/developer/api-auth.server");
        return apiOptions();
      },
      POST: async ({ request }) => {
        const { corsHeaders } = await import("@/lib/developer/api-auth.server");
        const headers = { ...corsHeaders(), "Cache-Control": "no-store" };
        const fail = (error: string, description?: string, status = 400) =>
          Response.json({ error, error_description: description }, { status, headers });

        let params: URLSearchParams;
        const contentType = request.headers.get("content-type") ?? "";
        try {
          if (contentType.includes("application/json")) {
            const body = (await request.json()) as Record<string, unknown>;
            params = new URLSearchParams(
              Object.entries(body).map(([key, value]) => [key, String(value ?? "")]),
            );
          } else {
            params = new URLSearchParams(await request.text());
          }
        } catch {
          return fail("invalid_request", "Corpo do pedido inválido.");
        }

        // Credenciais do cliente podem vir em Basic auth.
        let clientId = params.get("client_id") ?? "";
        let clientSecret = params.get("client_secret");
        const basic = request.headers.get("authorization") ?? "";
        if (basic.toLowerCase().startsWith("basic ")) {
          try {
            const decoded = Buffer.from(basic.slice(6).trim(), "base64").toString("utf8");
            const index = decoded.indexOf(":");
            if (index > 0) {
              clientId = clientId || decoded.slice(0, index);
              clientSecret = clientSecret ?? decoded.slice(index + 1);
            }
          } catch {
            return fail("invalid_client", "Cabeçalho Basic inválido.", 401);
          }
        }
        if (!clientId) return fail("invalid_request", "client_id obrigatório.");

        const grantType = params.get("grant_type") ?? "";
        const oauth = await import("@/lib/developer/oauth.server");

        if (grantType === "authorization_code") {
          const code = params.get("code");
          const redirectUri = params.get("redirect_uri");
          if (!code || !redirectUri) return fail("invalid_request", "code e redirect_uri obrigatórios.");
          const result = await oauth.exchangeAuthorizationCode({
            code,
            clientId,
            clientSecret,
            redirectUri,
            codeVerifier: params.get("code_verifier"),
          });
          if ("error" in result) {
            return fail(result.error, result.description, result.error === "invalid_client" ? 401 : 400);
          }
          return Response.json(result.tokens, { headers });
        }

        if (grantType === "refresh_token") {
          const refreshToken = params.get("refresh_token");
          if (!refreshToken) return fail("invalid_request", "refresh_token obrigatório.");
          const result = await oauth.refreshAccessToken({ refreshToken, clientId, clientSecret });
          if ("error" in result) {
            return fail(result.error, result.description, result.error === "invalid_client" ? 401 : 400);
          }
          return Response.json(result.tokens, { headers });
        }

        return fail("unsupported_grant_type", "Use authorization_code ou refresh_token.");
      },
    },
  },
});
