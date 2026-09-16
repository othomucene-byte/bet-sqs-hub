import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/public/v1/stream/market?symbols=CDM,TOUCH — fluxo em tempo real
 * (Server-Sent Events). O servidor lê o mercado e envia apenas alterações
 * reais de preço; nunca gera cotações.
 */
export const Route = createFileRoute("/api/public/v1/stream/market")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { apiOptions } = await import("@/lib/developer/api-auth.server");
        return apiOptions();
      },
      GET: async ({ request }) => {
        const { authenticateApiRequest, logApiRequest, corsHeaders } = await import(
          "@/lib/developer/api-auth.server"
        );
        const auth = await authenticateApiRequest(request, "stream:read");
        if ("response" in auth) return auth.response;

        const url = new URL(request.url);
        const filter = (url.searchParams.get("symbols") ?? "")
          .split(",")
          .map((symbol) => symbol.trim().toUpperCase())
          .filter(Boolean);
        const intervalRaw = Number(url.searchParams.get("interval") ?? 3);
        const intervalMs =
          (Number.isFinite(intervalRaw) ? Math.min(30, Math.max(1, Math.trunc(intervalRaw))) : 3) * 1000;

        const { listAssets } = await import("@/lib/developer/market-api.server");
        await logApiRequest(auth.caller.keyId, "/v1/stream/market", 200);

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const send = (event: string, data: unknown) => {
              controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            };
            const previous = new Map<string, number | null>();
            let closed = false;
            const stop = () => {
              closed = true;
              try {
                controller.close();
              } catch {
                /* já fechado */
              }
            };
            request.signal.addEventListener("abort", stop);

            send("ready", {
              environment: auth.caller.environment,
              interval_seconds: intervalMs / 1000,
              symbols: filter.length > 0 ? filter : "all",
            });

            const started = Date.now();
            while (!closed && Date.now() - started < 240_000) {
              try {
                const assets = await listAssets();
                for (const asset of assets) {
                  if (filter.length > 0 && !filter.includes(asset.symbol)) continue;
                  const last = previous.get(asset.symbol);
                  if (last === asset.last_price) continue;
                  previous.set(asset.symbol, asset.last_price);
                  send("quote", {
                    symbol: asset.symbol,
                    name: asset.name,
                    last_price: asset.last_price,
                    price_basis: asset.price_basis,
                    reference_price_source: asset.reference_price_source,
                    volume: asset.volume,
                    day_high: asset.day_high,
                    day_low: asset.day_low,
                    at: new Date().toISOString(),
                  });
                }
                send("heartbeat", { at: new Date().toISOString() });
              } catch (error) {
                send("error", {
                  message: error instanceof Error ? error.message.slice(0, 200) : "falha de leitura",
                });
              }
              await new Promise((resolve) => setTimeout(resolve, intervalMs));
            }
            stop();
          },
        });

        return new Response(stream, {
          headers: {
            ...corsHeaders(),
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-store",
            connection: "keep-alive",
          },
        });
      },
    },
  },
});
