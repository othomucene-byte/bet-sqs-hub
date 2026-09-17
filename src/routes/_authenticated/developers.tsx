import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, KeyRound, Terminal, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Panel, TerminalShell } from "@/components/exchange/terminal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/developer/api-keys.functions";
import { WebhooksPanel } from "@/components/developer/WebhooksPanel";
import { OAuthPanel } from "@/components/developer/OAuthPanel";

export const Route = createFileRoute("/_authenticated/developers")({
  head: () => ({
    meta: [
      { title: "API para developers — Betfcom SQs" },
      {
        name: "description",
        content:
          "Crie chaves de API da Betfcom SQs e leia o mercado moçambicano em meticais: empresas, cotações, livro de ofertas e negócios, com documentação OpenAPI.",
      },
      { property: "og:title", content: "API para developers — Betfcom SQs" },
      {
        property: "og:description",
        content: "Chaves de API, ambiente de teste e documentação da API do mercado Betfcom SQs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DevelopersPage,
});

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/public/v1/market/assets",
    desc: "Catálogo de empresas e instrumentos, com preço, base do preço e fonte.",
  },
  {
    method: "GET",
    path: "/api/public/v1/market/assets/{symbol}",
    desc: "Cotação de um instrumento e informação verificada da empresa, com fonte e data.",
  },
  {
    method: "GET",
    path: "/api/public/v1/market/orderbook/{symbol}?depth=10",
    desc: "Livro de ofertas agregado por preço (compras e vendas).",
  },
  {
    method: "GET",
    path: "/api/public/v1/market/trades/{symbol}?limit=50",
    desc: "Negócios executados, sem qualquer identificação de participantes.",
  },
  {
    method: "GET",
    path: "/api/public/v1/trading/account",
    desc: "Conta de investidor: saldo disponível, reservado e títulos (trading:read).",
  },
  {
    method: "GET",
    path: "/api/public/v1/trading/orders",
    desc: "As suas ordens, do ambiente da chave usada (trading:read).",
  },
  {
    method: "POST",
    path: "/api/public/v1/trading/orders",
    desc: "Cria uma ordem de compra ou venda. Exige Idempotency-Key (trading:write).",
  },
  {
    method: "GET",
    path: "/api/public/v1/trading/orders/{id}",
    desc: "Estado de uma ordem, incluindo quantidade executada (trading:read).",
  },
  {
    method: "DELETE",
    path: "/api/public/v1/trading/orders/{id}",
    desc: "Cancela uma ordem ainda aberta (trading:write).",
  },
  {
    method: "GET",
    path: "/api/public/v1/trading/trades",
    desc: "Os seus negócios executados (trading:read).",
  },
  {
    method: "GET",
    path: "/api/public/v1/stream/market",
    desc: "Cotações em tempo real por SSE (stream:read). Parâmetros: symbols, interval.",
  },
  {
    method: "POST",
    path: "/api/public/v1/oauth/token",
    desc: "Troca de código por token e renovação, para aplicações externas.",
  },
  {
    method: "GET",
    path: "/api/public/v1/openapi.json",
    desc: "Especificação OpenAPI 3.1 completa (aberta, sem chave).",
  },
] as const;

const API_SCOPE_OPTIONS = [
  "market:read",
  "trading:read",
  "trading:write",
  "stream:read",
] as const;
type ApiScope = (typeof API_SCOPE_OPTIONS)[number];

function DevelopersPage() {
  const queryClient = useQueryClient();
  const fetchKeys = useServerFn(listApiKeys);
  const createKey = useServerFn(createApiKey);
  const revoke = useServerFn(revokeApiKey);

  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<"SANDBOX" | "LIVE">("SANDBOX");
  const [scopes, setScopes] = useState<ApiScope[]>(["market:read"]);
  const [issued, setIssued] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const query = useQuery({ queryKey: ["api-keys"], queryFn: () => fetchKeys({}) });

  const create = useMutation({
    mutationFn: () => createKey({ data: { name: name.trim(), environment, scopes } }),
    onSuccess: (result) => {
      setIssued(result.token);
      setName("");
      setCopied(false);
      void queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("Chave criada. Copie-a agora — não voltará a ser mostrada.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("Chave revogada.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const origin = typeof window === "undefined" ? "https://betfcom.com" : window.location.origin;
  const sample = `curl -H "Authorization: Bearer sqs_test_..." \\\n  ${origin}/api/public/v1/market/assets`;

  return (
    <TerminalShell
      title="API para developers"
      badges={
        <Badge variant="outline" className="gap-1 text-[11px]">
          <Terminal className="size-3" /> v1
        </Badge>
      }
      subtitle="Leia o mercado da Betfcom SQs com as suas próprias chaves. Os preços vêm do servidor: negócios deste mercado ou preço de referência com fonte identificada. A API é apenas de leitura — não movimenta saldos nem ordens."
      wide
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          <Panel title="As suas chaves">
            {query.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (query.data?.keys.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-[13px] text-muted-foreground">
                Ainda não criou nenhuma chave.
              </p>
            ) : (
              <div className="space-y-2">
                {query.data?.keys.map((key) => (
                  <div
                    key={key.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2"
                  >
                    <KeyRound className="size-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{key.name}</p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {key.prefix}••••••••
                      </p>
                    </div>
                    <Badge
                      variant={key.environment === "LIVE" ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {key.environment === "LIVE" ? "Real" : "Teste"}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {key.requestCount} pedidos
                    </span>
                    {key.revokedAt ? (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Revogada
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove.mutate(key.id)}
                        disabled={remove.isPending}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Endpoints disponíveis">
            <div className="space-y-2">
              {ENDPOINTS.map((endpoint) => (
                <div
                  key={endpoint.path}
                  className="rounded-lg border border-border/60 bg-background/40 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {endpoint.method}
                    </Badge>
                    <code className="min-w-0 break-all text-[12px]">{endpoint.path}</code>
                  </div>
                  <p className="mt-1 text-[12px] text-muted-foreground">{endpoint.desc}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Exemplo">
            <pre className="overflow-x-auto rounded-lg bg-background/60 p-3 text-[12px] leading-relaxed">
              {sample}
            </pre>
            <p className="mt-2 text-[12px] text-muted-foreground">
              Uma chave de teste devolve os mesmos dados públicos do mercado e marca cada resposta
              com o ambiente, para poder validar a integração antes de passar a real.
            </p>
          </Panel>

          <WebhooksPanel />
          <OAuthPanel />
        </div>

        <div className="space-y-3">
          <Panel title="Criar chave">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="key-name" className="text-[12px]">
                  Nome
                </Label>
                <Input
                  id="key-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="A minha aplicação"
                  maxLength={60}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Ambiente</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["SANDBOX", "LIVE"] as const).map((env) => (
                    <Button
                      key={env}
                      type="button"
                      variant={environment === env ? "default" : "outline"}
                      size="sm"
                      onClick={() => setEnvironment(env)}
                    >
                      {env === "SANDBOX" ? "Teste" : "Real"}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Permissões</Label>
                <div className="flex flex-wrap gap-2">
                  {API_SCOPE_OPTIONS.map((scope) => (
                    <Button
                      key={scope}
                      type="button"
                      size="sm"
                      variant={scopes.includes(scope) ? "default" : "outline"}
                      className="font-mono text-[11px]"
                      onClick={() =>
                        setScopes((current) =>
                          current.includes(scope)
                            ? current.filter((item) => item !== scope)
                            : [...current, scope],
                        )
                      }
                    >
                      {scope}
                    </Button>
                  ))}
                </div>
              </div>
              <Button
                className="w-full"
                disabled={name.trim().length < 2 || scopes.length === 0 || create.isPending}
                onClick={() => create.mutate()}
              >
                {create.isPending ? "A criar..." : "Criar chave"}
              </Button>

              {issued && (
                <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
                  <p className="text-[12px] font-semibold text-primary">
                    Copie agora — não voltamos a mostrar esta chave.
                  </p>
                  <code className="block break-all font-mono text-[12px]">{issued}</code>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      void navigator.clipboard.writeText(issued);
                      setCopied(true);
                      toast.success("Chave copiada.");
                    }}
                  >
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    {copied ? "Copiada" : "Copiar chave"}
                  </Button>
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Últimos pedidos">
            {(query.data?.recent.length ?? 0) === 0 ? (
              <p className="py-4 text-center text-[12px] text-muted-foreground">
                Sem pedidos registados.
              </p>
            ) : (
              <div className="space-y-1">
                {query.data?.recent.map((entry, index) => (
                  <div
                    key={`${entry.createdAt}-${index}`}
                    className="flex items-center gap-2 border-b border-border/40 py-1.5 last:border-0"
                  >
                    <span
                      className={
                        entry.status < 400
                          ? "font-mono text-[11px] text-emerald-400"
                          : "font-mono text-[11px] text-destructive"
                      }
                    >
                      {entry.status}
                    </span>
                    <code className="min-w-0 flex-1 truncate text-[11px]">{entry.path}</code>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleTimeString("pt-MZ", {
                        timeZone: "Africa/Maputo",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Documentação">
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              A especificação completa está em{" "}
              <a
                className="text-primary underline"
                href="/api/public/v1/openapi.json"
                target="_blank"
                rel="noreferrer"
              >
                /api/public/v1/openapi.json
              </a>{" "}
              e funciona em qualquer ferramenta compatível com OpenAPI 3.1.
            </p>
          </Panel>
        </div>
      </div>
    </TerminalShell>
  );
}
