import { createFileRoute } from "@tanstack/react-router";

/** GET /api/public/v1/market/assets/{symbol} — cotação e dados da empresa. */
export const Route = createFileRoute("/api/public/v1/market/assets/$symbol")({
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
        const { assetDetail } = await import("@/lib/developer/market-api.server");
        const detail = await assetDetail(params.symbol);
        if (!detail) {
          await logApiRequest(auth.caller.keyId, `/v1/market/assets/${params.symbol}`, 404);
          return apiError(404, "Instrumento não encontrado.");
        }
        await logApiRequest(auth.caller.keyId, `/v1/market/assets/${params.symbol}`, 200);
        return apiJson({ environment: auth.caller.environment, asset: detail });
      },
    },
  },
});
