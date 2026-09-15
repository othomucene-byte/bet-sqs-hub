import { createFileRoute } from "@tanstack/react-router";

/** Especificação OpenAPI pública da API do mercado Betfcom SQs. */
export const Route = createFileRoute("/api/public/v1/openapi.json")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const money = { type: "number", nullable: true } as const;
        return Response.json(
          {
            openapi: "3.1.0",
            info: {
              title: "Betfcom SQs Market API",
              version: "1.0.0",
              description:
                "API de leitura do mercado próprio da Betfcom SQs (Moçambique, MZN). Autenticação por chave de API criada em /developers. Preços resultam de negócios neste mercado ou de preço de referência identificado pela fonte.",
            },
            servers: [{ url: `${origin}/api/public/v1` }],
            components: {
              securitySchemes: {
                apiKey: { type: "http", scheme: "bearer", bearerFormat: "sqs_..." },
              },
              schemas: {
                Asset: {
                  type: "object",
                  properties: {
                    symbol: { type: "string" },
                    name: { type: "string" },
                    asset_type: { type: "string" },
                    status: { type: "string" },
                    currency: { type: "string" },
                    country: { type: "string" },
                    tick_size: { type: "number" },
                    lot_size: { type: "number" },
                    last_price: money,
                    price_basis: { type: "string", enum: ["trade", "reference", "unavailable"] },
                    reference_price: money,
                    reference_price_source: { type: "string", nullable: true },
                    prev_close: money,
                    day_high: money,
                    day_low: money,
                    volume: { type: "number" },
                  },
                },
                BookLevel: {
                  type: "object",
                  properties: {
                    price: { type: "number" },
                    quantity: { type: "number" },
                    orders: { type: "integer" },
                  },
                },
                Trade: {
                  type: "object",
                  properties: {
                    price: { type: "number" },
                    quantity: { type: "number" },
                    executed_at: { type: "string", format: "date-time" },
                  },
                },
              },
            },
            security: [{ apiKey: [] }],
            paths: {
              "/market/assets": {
                get: {
                  summary: "Catálogo de empresas e instrumentos listados",
                  responses: {
                    "200": {
                      description: "Lista de instrumentos",
                      content: {
                        "application/json": {
                          schema: {
                            type: "object",
                            properties: {
                              environment: { type: "string" },
                              currency: { type: "string" },
                              count: { type: "integer" },
                              assets: {
                                type: "array",
                                items: { $ref: "#/components/schemas/Asset" },
                              },
                            },
                          },
                        },
                      },
                    },
                    "401": { description: "Chave ausente, inválida ou revogada" },
                  },
                },
              },
              "/market/assets/{symbol}": {
                get: {
                  summary: "Cotação e informação verificada da empresa",
                  parameters: [
                    { name: "symbol", in: "path", required: true, schema: { type: "string" } },
                  ],
                  responses: {
                    "200": { description: "Instrumento com dados da empresa e fontes" },
                    "404": { description: "Instrumento não encontrado" },
                  },
                },
              },
              "/market/orderbook/{symbol}": {
                get: {
                  summary: "Livro de ofertas agregado",
                  parameters: [
                    { name: "symbol", in: "path", required: true, schema: { type: "string" } },
                    {
                      name: "depth",
                      in: "query",
                      schema: { type: "integer", minimum: 1, maximum: 50, default: 10 },
                    },
                  ],
                  responses: {
                    "200": {
                      description: "Compras e vendas agregadas por preço",
                      content: {
                        "application/json": {
                          schema: {
                            type: "object",
                            properties: {
                              symbol: { type: "string" },
                              bids: { type: "array", items: { $ref: "#/components/schemas/BookLevel" } },
                              asks: { type: "array", items: { $ref: "#/components/schemas/BookLevel" } },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              "/market/trades/{symbol}": {
                get: {
                  summary: "Fita pública de negócios executados",
                  parameters: [
                    { name: "symbol", in: "path", required: true, schema: { type: "string" } },
                    {
                      name: "limit",
                      in: "query",
                      schema: { type: "integer", minimum: 1, maximum: 200, default: 50 },
                    },
                  ],
                  responses: {
                    "200": {
                      description: "Negócios recentes, sem identificadores de participantes",
                      content: {
                        "application/json": {
                          schema: {
                            type: "object",
                            properties: {
                              symbol: { type: "string" },
                              trades: { type: "array", items: { $ref: "#/components/schemas/Trade" } },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          { headers: { "Access-Control-Allow-Origin": "*" } },
        );
      },
    },
  },
});
