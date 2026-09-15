import { createFileRoute } from "@tanstack/react-router";

/** GET /api/public/v1/market/trades/{symbol}?limit=50 — fita pública de negócios. */
export const Route = createFileRoute("/api/public/v1/market/trades/$symbol")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { apiOptions } = await import("@/lib/developer/api-auth.server");
        return apiOptions();
      },
      GET: async ({ request, params }) => {
        const { authenticateApiRequest, apiJson, apiError, logApiRequest } = await import(
          "@/lib/developer/api-auth.server"
        );
        const auth = await authenticateApiRequest(request);
        if ("response" in auth) return auth.response;
        const limitRaw = Number(new URL(request.url).searchParams.get("limit") ?? 50);
        const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, Math.trunc(limitRaw))) : 50;
        const { publicTrades } = await import("@/lib/developer/market-api.server");
        const tape = await publicTrades(params.symbol, limit);
        if (!tape) {
          await logApiRequest(auth.caller.keyId, `/v1/market/trades/${params.symbol}`, 404);
          return apiError(404, "Instrumento não encontrado.");
        }
        await logApiRequest(auth.caller.keyId, `/v1/market/trades/${params.symbol}`, 200);
        return apiJson({ environment: auth.caller.environment, ...tape });
      },
    },
  },
});
