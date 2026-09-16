import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/public/v1/stream/ws?token=... — ligação WebSocket ao mercado.
 *
 * O navegador não envia cabeçalhos no handshake, por isso a credencial vai em
 * `token` (chave de API ou token OAuth com a permissão stream:read). Quando o
 * runtime não suportar WebSocket, responde 501 e indica o fluxo SSE
 * equivalente — nunca finge ligação.
 */
export const Route = createFileRoute("/api/public/v1/stream/ws")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { apiOptions } = await import("@/lib/developer/api-auth.server");
        return apiOptions();
      },
      GET: async ({ request }) => {
        const { authenticateApiRequest, apiError, logApiRequest } = await import(
          "@/lib/developer/api-auth.server"
        );
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        const authRequest = token
          ? new Request(request.url, { headers: { authorization: `Bearer ${token}` } })
          : request;
        const auth = await authenticateApiRequest(authRequest, "stream:read");
        if ("response" in auth) return auth.response;

        if ((request.headers.get("upgrade") ?? "").toLowerCase() !== "websocket") {
          return apiError(400, "Este endereço requer um handshake WebSocket (Upgrade: websocket).");
        }

        const pairFactory = (globalThis as { WebSocketPair?: new () => Record<string, WebSocket> })
          .WebSocketPair;
        if (!pairFactory) {
          return apiError(
            501,
            "WebSocket não disponível neste ambiente. Use o fluxo SSE em /api/public/v1/stream/market.",
          );
        }

        const pair = new pairFactory();
        const client = pair[0] as WebSocket & { accept?: () => void };
        const server = pair[1] as WebSocket & { accept?: () => void };
        server.accept?.();

        const filter = (url.searchParams.get("symbols") ?? "")
          .split(",")
          .map((symbol) => symbol.trim().toUpperCase())
          .filter(Boolean);
        const intervalRaw = Number(url.searchParams.get("interval") ?? 3);
        const intervalMs =
          (Number.isFinite(intervalRaw) ? Math.min(30, Math.max(1, Math.trunc(intervalRaw))) : 3) * 1000;

        await logApiRequest(auth.caller.keyId, "/v1/stream/ws", 101);

        void (async () => {
          const { listAssets } = await import("@/lib/developer/market-api.server");
          const previous = new Map<string, number | null>();
          let open = true;
          server.addEventListener("close", () => {
            open = false;
          });
          server.addEventListener("error", () => {
            open = false;
          });
          const send = (payload: unknown) => {
            try {
              server.send(JSON.stringify(payload));
            } catch {
              open = false;
            }
          };
          send({ type: "ready", environment: auth.caller.environment });

          const started = Date.now();
          while (open && Date.now() - started < 240_000) {
            try {
              const assets = await listAssets();
              for (const asset of assets) {
                if (filter.length > 0 && !filter.includes(asset.symbol)) continue;
                if (previous.get(asset.symbol) === asset.last_price) continue;
                previous.set(asset.symbol, asset.last_price);
                send({
                  type: "quote",
                  symbol: asset.symbol,
                  last_price: asset.last_price,
                  price_basis: asset.price_basis,
                  volume: asset.volume,
                  at: new Date().toISOString(),
                });
              }
            } catch (error) {
              send({
                type: "error",
                message: error instanceof Error ? error.message.slice(0, 200) : "falha de leitura",
              });
            }
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
          }
          try {
            server.close(1000, "fim da sessão");
          } catch {
            /* já fechado */
          }
        })();

        return new Response(null, {
          status: 101,
          // @ts-expect-error webSocket só existe no runtime de edge
          webSocket: client,
        });
      },
    },
  },
});
