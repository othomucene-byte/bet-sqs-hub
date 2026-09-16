import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/public/v1/oauth/authorize — entrada do fluxo OAuth 2.0.
 * Encaminha para o ecrã de consentimento da própria plataforma, onde o
 * utilizador aprova (ou recusa) as permissões pedidas pela aplicação.
 */
export const Route = createFileRoute("/api/public/v1/oauth/authorize")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const responseType = url.searchParams.get("response_type") ?? "code";
        if (responseType !== "code") {
          return Response.json(
            { error: "unsupported_response_type", error_description: "Use response_type=code." },
            { status: 400 },
          );
        }
        if (!url.searchParams.get("client_id") || !url.searchParams.get("redirect_uri")) {
          return Response.json(
            { error: "invalid_request", error_description: "client_id e redirect_uri obrigatórios." },
            { status: 400 },
          );
        }
        const consent = new URL("/oauth/autorizar", url.origin);
        url.searchParams.forEach((value, key) => consent.searchParams.set(key, value));
        return Response.redirect(consent.toString(), 302);
      },
    },
  },
});
