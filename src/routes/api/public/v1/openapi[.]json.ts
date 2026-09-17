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
              "/trading/account": {
                get: {
                  summary: "Conta de investidor do titular da credencial (trading:read)",
                  responses: { "200": { description: "Saldo disponível, reservado e títulos" } },
                },
              },
              "/trading/orders": {
                get: {
                  summary: "Lista as ordens do titular no ambiente da credencial (trading:read)",
                  responses: { "200": { description: "Ordens" } },
                },
                post: {
                  summary: "Cria uma ordem (trading:write)",
                  parameters: [
                    {
                      name: "Idempotency-Key",
                      in: "header",
                      required: false,
                      schema: { type: "string", minLength: 8 },
                      description:
                        "Chave de idempotência. Em alternativa, envie idempotency_key no corpo.",
                    },
                  ],
                  requestBody: {
                    required: true,
                    content: {
                      "application/json": {
                        schema: {
                          type: "object",
                          required: ["symbol", "side", "quantity"],
                          properties: {
                            symbol: { type: "string" },
                            side: { type: "string", enum: ["BUY", "SELL"] },
                            order_type: { type: "string", enum: ["LIMIT", "MARKET"], default: "LIMIT" },
                            quantity: { type: "number", minimum: 1 },
                            price: { type: "number", nullable: true },
                            time_in_force: { type: "string", enum: ["DAY", "GTC", "IOC", "FOK"] },
                            idempotency_key: { type: "string", minLength: 8 },
                          },
                        },
                      },
                    },
                  },
                  responses: {
                    "200": { description: "Ordem aceite" },
                    "400": { description: "Pedido inválido ou sem chave de idempotência" },
                    "422": { description: "Ordem recusada por regras de mercado, saldo ou risco" },
                  },
                },
              },
              "/trading/orders/{id}": {
                get: {
                  summary: "Estado de uma ordem (trading:read)",
                  parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                  responses: { "200": { description: "Ordem" }, "404": { description: "Não encontrada" } },
                },
                delete: {
                  summary: "Cancela uma ordem aberta (trading:write)",
                  parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                  responses: { "200": { description: "Cancelada" }, "422": { description: "Não cancelável" } },
                },
              },
              "/trading/trades": {
                get: {
                  summary: "Negócios executados do titular (trading:read)",
                  responses: { "200": { description: "Negócios" } },
                },
              },
              "/stream/market": {
                get: {
                  summary: "Cotações em tempo real por Server-Sent Events (stream:read)",
                  parameters: [
                    {
                      name: "symbols",
                      in: "query",
                      schema: { type: "string" },
                      description: "Lista separada por vírgulas. Vazio devolve todos os instrumentos.",
                    },
                    {
                      name: "interval",
                      in: "query",
                      schema: { type: "integer", minimum: 1, maximum: 30, default: 3 },
                    },
                  ],
                  responses: {
                    "200": {
                      description:
                        "text/event-stream com eventos ready, quote, heartbeat e error. Sessão de 240 segundos; reconecte no fim.",
                    },
                  },
                },
              },
              "/oauth/authorize": {
                get: {
                  summary: "Início do fluxo OAuth 2.0 (authorization_code + PKCE)",
                  security: [],
                  parameters: [
                    { name: "client_id", in: "query", required: true, schema: { type: "string" } },
                    { name: "redirect_uri", in: "query", required: true, schema: { type: "string" } },
                    { name: "response_type", in: "query", required: true, schema: { type: "string", enum: ["code"] } },
                    { name: "scope", in: "query", schema: { type: "string" } },
                    { name: "state", in: "query", schema: { type: "string" } },
                    { name: "code_challenge", in: "query", schema: { type: "string" } },
                    { name: "code_challenge_method", in: "query", schema: { type: "string", enum: ["S256"] } },
                  ],
                  responses: { "302": { description: "Redirecciona para o ecrã de consentimento" } },
                },
              },
              "/oauth/token": {
                post: {
                  summary: "Troca de código por token e renovação",
                  security: [],
                  requestBody: {
                    required: true,
                    content: {
                      "application/x-www-form-urlencoded": {
                        schema: {
                          type: "object",
                          properties: {
                            grant_type: { type: "string", enum: ["authorization_code", "refresh_token"] },
                            code: { type: "string" },
                            code_verifier: { type: "string" },
                            refresh_token: { type: "string" },
                            client_id: { type: "string" },
                            client_secret: { type: "string" },
                            redirect_uri: { type: "string" },
                          },
                        },
                      },
                    },
                  },
                  responses: {
                    "200": { description: "access_token (sqsat_), refresh_token (sqsrt_), expires_in, scope" },
                    "400": { description: "Pedido inválido" },
                  },
                },
              },
              "/oauth/revoke": {
                post: {
                  summary: "Revoga um access token ou refresh token",
                  security: [],
                  responses: { "200": { description: "Revogado" } },
                },
              },
            },
            "x-webhooks": {
              description:
                "Avisos automáticos configurados em /developers. Cada envio POST inclui x-sqs-event, x-sqs-timestamp e x-sqs-signature = HMAC-SHA256 de `${timestamp}.${body}` com a chave do endpoint. Repetimos até 6 vezes com espera crescente.",
              events: ["order.updated", "trade.executed", "price.updated"],
            },
          },
          { headers: { "Access-Control-Allow-Origin": "*" } },
        );
      },
    },
  },
});
