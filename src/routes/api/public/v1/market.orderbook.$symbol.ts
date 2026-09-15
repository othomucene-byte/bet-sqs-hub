import { createFileRoute } from "@tanstack/react-router";

/** GET /api/public/v1/market/orderbook/{symbol}?depth=10 — livro agregado. */
export const Route = createFileRoute("/api/public/v1/market/orderbook/$symbol")({
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
        const depthRaw = Number(new URL(request.url).searchParams.get("depth") ?? 10);
        const depth = Number.isFinite(depthRaw) ? Math.min(50, Math.max(1, Math.trunc(depthRaw))) : 10;
        const { orderBook } = await import("@/lib/developer/market-api.server");
        const book = await orderBook(params.symbol, depth);
        if (!book) {
          await logApiRequest(auth.caller.keyId, `/v1/market/orderbook/${params.symbol}`, 404);
          return apiError(404, "Instrumento não encontrado.");
        }
        await logApiRequest(auth.caller.keyId, `/v1/market/orderbook/${params.symbol}`, 200);
        return apiJson({ environment: auth.caller.environment, depth, ...book });
      },
    },
  },
});
