import { createFileRoute } from "@tanstack/react-router";

/** GET /api/public/v1/trading/account — saldo e posições da conta autenticada. */
export const Route = createFileRoute("/api/public/v1/trading/account")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { apiOptions } = await import("@/lib/developer/api-auth.server");
        return apiOptions();
      },
      GET: async ({ request }) => {
        const { authenticateApiRequest, apiJson, apiError, logApiRequest } = await import(
          "@/lib/developer/api-auth.server"
        );
        const auth = await authenticateApiRequest(request, "trading:read");
        if ("response" in auth) return auth.response;
        const { apiAccount } = await import("@/lib/developer/trading-api.server");
        try {
          const account = await apiAccount(auth.caller.userId, auth.caller.tradingEnvironment);
          await logApiRequest(auth.caller.keyId, "/v1/trading/account", 200);
          return apiJson(account, 200, "no-store");
        } catch (error) {
          await logApiRequest(auth.caller.keyId, "/v1/trading/account", 400);
          return apiError(400, error instanceof Error ? error.message : "Falha ao ler a conta.");
        }
      },
    },
  },
});
