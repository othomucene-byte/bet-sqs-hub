import { createFileRoute } from "@tanstack/react-router";

/** GET /api/public/v1/trading/trades — negócios executados da conta autenticada. */
export const Route = createFileRoute("/api/public/v1/trading/trades")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { apiOptions } = await import("@/lib/developer/api-auth.server");
        return apiOptions();
      },
      GET: async ({ request }) => {
        const { authenticateApiRequest, apiJson, logApiRequest } = await import(
          "@/lib/developer/api-auth.server"
        );
        const auth = await authenticateApiRequest(request, "trading:read");
        if ("response" in auth) return auth.response;
        const limitRaw = Number(new URL(request.url).searchParams.get("limit") ?? 50);
        const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, Math.trunc(limitRaw))) : 50;
        const { apiTrades } = await import("@/lib/developer/trading-api.server");
        const trades = await apiTrades(auth.caller.userId, auth.caller.tradingEnvironment, limit);
        await logApiRequest(auth.caller.keyId, "/v1/trading/trades", 200);
        return apiJson({ environment: auth.caller.tradingEnvironment, trades }, 200, "no-store");
      },
    },
  },
});
