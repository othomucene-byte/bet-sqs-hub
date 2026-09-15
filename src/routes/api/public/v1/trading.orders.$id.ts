import { createFileRoute } from "@tanstack/react-router";

/**
 * GET    /api/public/v1/trading/orders/{id} — estado de uma ordem.
 * DELETE /api/public/v1/trading/orders/{id} — cancelamento (liberta a reserva).
 */
export const Route = createFileRoute("/api/public/v1/trading/orders/$id")({
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
        const auth = await authenticateApiRequest(request, "trading:read");
        if ("response" in auth) return auth.response;
        const { apiOrder } = await import("@/lib/developer/trading-api.server");
        const order = await apiOrder(auth.caller.userId, auth.caller.tradingEnvironment, params.id);
        await logApiRequest(auth.caller.keyId, "/v1/trading/orders/{id}", order ? 200 : 404);
        return order ? apiJson(order, 200, "no-store") : apiError(404, "Ordem não encontrada.");
      },
      DELETE: async ({ request, params }) => {
        const { authenticateApiRequest, apiJson, apiError, logApiRequest } = await import(
          "@/lib/developer/api-auth.server"
        );
        const auth = await authenticateApiRequest(request, "trading:write");
        if ("response" in auth) return auth.response;
        const { apiCancelOrder } = await import("@/lib/developer/trading-api.server");
        try {
          const order = await apiCancelOrder(
            auth.caller.userId,
            auth.caller.tradingEnvironment,
            params.id,
            auth.caller.environment,
          );
          await logApiRequest(auth.caller.keyId, "/v1/trading/orders/{id}", 200);
          return apiJson(order, 200, "no-store");
        } catch (error) {
          await logApiRequest(auth.caller.keyId, "/v1/trading/orders/{id}", 400);
          return apiError(400, error instanceof Error ? error.message : "Cancelamento recusado.");
        }
      },
    },
  },
});
