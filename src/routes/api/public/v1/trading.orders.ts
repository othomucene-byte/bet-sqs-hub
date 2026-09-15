import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const placeSchema = z.object({
  symbol: z.string().trim().min(1).max(20),
  side: z.enum(["BUY", "SELL"]),
  order_type: z.enum(["MARKET", "LIMIT"]),
  quantity: z.number().positive().max(10_000_000),
  limit_price: z.number().positive().max(10_000_000).nullable().optional(),
  idempotency_key: z.string().trim().min(8).max(80).optional(),
});

/**
 * GET  /api/public/v1/trading/orders — ordens da conta autenticada.
 * POST /api/public/v1/trading/orders — nova ordem (validação e cruzamento no
 * motor da plataforma; idempotência obrigatória).
 */
export const Route = createFileRoute("/api/public/v1/trading/orders")({
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
        const { apiOrders } = await import("@/lib/developer/trading-api.server");
        const orders = await apiOrders(auth.caller.userId, auth.caller.tradingEnvironment, limit);
        await logApiRequest(auth.caller.keyId, "/v1/trading/orders", 200);
        return apiJson({ environment: auth.caller.tradingEnvironment, orders }, 200, "no-store");
      },
      POST: async ({ request }) => {
        const { authenticateApiRequest, apiJson, apiError, logApiRequest } = await import(
          "@/lib/developer/api-auth.server"
        );
        const auth = await authenticateApiRequest(request, "trading:write");
        if ("response" in auth) return auth.response;

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return apiError(400, "Corpo do pedido inválido (JSON esperado).");
        }
        const parsed = placeSchema.safeParse(body);
        if (!parsed.success) {
          await logApiRequest(auth.caller.keyId, "/v1/trading/orders", 422);
          return apiError(422, parsed.error.issues[0]?.message ?? "Dados da ordem inválidos.");
        }
        if (parsed.data.order_type === "LIMIT" && parsed.data.limit_price == null) {
          return apiError(422, "Ordem LIMIT exige limit_price.");
        }

        const idempotencyKey =
          parsed.data.idempotency_key ?? request.headers.get("idempotency-key") ?? "";
        if (idempotencyKey.trim().length < 8) {
          return apiError(
            422,
            "Envie idempotency_key (ou cabeçalho Idempotency-Key) com pelo menos 8 caracteres.",
          );
        }

        const { apiPlaceOrder } = await import("@/lib/developer/trading-api.server");
        try {
          const result = await apiPlaceOrder(
            auth.caller.userId,
            auth.caller.tradingEnvironment,
            { ...parsed.data, idempotency_key: idempotencyKey.trim() },
            auth.caller.environment,
          );
          if ("error" in result) {
            await logApiRequest(auth.caller.keyId, "/v1/trading/orders", result.status);
            return apiError(result.status, result.error);
          }
          await logApiRequest(auth.caller.keyId, "/v1/trading/orders", 201);
          return apiJson(result.order, 201, "no-store");
        } catch (error) {
          await logApiRequest(auth.caller.keyId, "/v1/trading/orders", 400);
          return apiError(400, error instanceof Error ? error.message : "Ordem recusada.");
        }
      },
    },
  },
});
