import { createFileRoute } from "@tanstack/react-router";

/** GET /api/public/v1/market/assets — catálogo do mercado (requer chave de API). */
export const Route = createFileRoute("/api/public/v1/market/assets")({
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
        const auth = await authenticateApiRequest(request);
        if ("response" in auth) return auth.response;
        const { listAssets } = await import("@/lib/developer/market-api.server");
        const assets = await listAssets();
        await logApiRequest(auth.caller.keyId, "/v1/market/assets", 200);
        return apiJson({
          environment: auth.caller.environment,
          currency: "MZN",
          count: assets.length,
          assets,
        });
      },
    },
  },
});
