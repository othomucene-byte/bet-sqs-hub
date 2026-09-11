import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { SiteHeader } from "@/components/site-header";
import { EnvBadge, ExchangeNav } from "@/components/exchange/exchange-nav";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getMarketOverview } from "@/lib/exchange/market.functions";
import { ASSET_TYPE_LABEL, MARKET_STATUS_LABEL, pct, price } from "@/lib/exchange/format";

export const Route = createFileRoute("/exchange/")({
  head: () => ({
    meta: [
      { title: "SQs Exchange — Mercado Moçambicano | Betfcom SQs" },
      {
        name: "description",
        content:
          "SQs Exchange: mercado de simulação para ações, obrigações e papel comercial moçambicanos, em MZN, com livro de ordens e carteira reais na plataforma Betfcom SQs.",
      },
      { property: "og:title", content: "SQs Exchange — Mercado Moçambicano" },
      {
        property: "og:description",
        content: "Livro de ordens, carteira e ordens em ambiente de simulação (paper trading).",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExchangeMarket,
});

const CATEGORIES = ["Todos", "EQUITY", "BOND", "COMMERCIAL_PAPER", "FUND", "OTHER"] as const;

function ExchangeMarket() {
  const fetchMarket = useServerFn(getMarketOverview);
  const [environment, setEnvironment] = useState<"LIVE" | "PAPER">("LIVE");
  const [autoSwitched, setAutoSwitched] = useState(false);
  const query = useQuery({
    queryKey: ["exchange-market", environment],
    queryFn: () => fetchMarket({ data: { environment } }),
    refetchInterval: 20000,
  });
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState<string>("Todos");

  // Se o mercado real ainda não tem empresas listadas, mostramos logo a simulação
  // para que a lista nunca apareça vazia sem explicação.
  useEffect(() => {
    if (
      environment === "LIVE" &&
      !autoSwitched &&
      query.data &&
      query.data.assets.length === 0
    ) {
      setAutoSwitched(true);
      setEnvironment("PAPER");
    }
  }, [environment, autoSwitched, query.data]);

  const assets = useMemo(() => {
    const rows = query.data?.assets ?? [];
    const t = term.trim().toUpperCase();
    return rows.filter(
      (a) =>
        (category === "Todos" || a.assetType === category) &&
        (t === "" || a.symbol.includes(t) || a.name.toUpperCase().includes(t)),
    );
  }, [query.data, term, category]);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-5">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">SQs Exchange</h1>
            <span className="text-sm text-muted-foreground">🇲🇿 Mercado Moçambicano · MZN</span>
            <EnvBadge environment={environment} />
          </div>
          <div className="flex gap-1 rounded-lg border border-border/60 bg-card/50 p-1">
            {(["LIVE", "PAPER"] as const).map((env) => (
              <button
                key={env}
                type="button"
                onClick={() => setEnvironment(env)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  environment === env
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {env === "LIVE" ? "Mercado real" : "Simulação"}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {query.data
              ? `${query.data.marketName} · ${MARKET_STATUS_LABEL[query.data.marketStatus]} · ${query.data.opensAt}–${query.data.closesAt} (Maputo)`
              : "A carregar estado do mercado…"}
          </p>
        </header>

        <ExchangeNav />

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="space-y-1 p-3 text-xs text-muted-foreground">
            <p className="text-sm font-semibold text-foreground">Como investir em 3 passos</p>
            <p>1. Coloque fundos na carteira de investimentos em Fundos.</p>
            <p>2. Escolha uma empresa da lista abaixo e toque em Investir.</p>
            <p>3. Indique quantas ações quer e a que preço; a ordem é validada e registada no servidor.</p>
          </CardContent>
        </Card>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Pesquisar empresa ou código..."
            className="pl-9"
          />
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs transition-colors ${
                category === c
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {c === "Todos" ? "Todos" : ASSET_TYPE_LABEL[c]}
            </button>
          ))}
        </div>

        {query.isLoading && (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        )}

        {query.isError && (
          <Card>
            <CardContent className="p-6 text-sm text-destructive">
              Não foi possível carregar o mercado. Tente novamente.
            </CardContent>
          </Card>
        )}

        {query.data && assets.length === 0 && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              {(query.data.assets.length ?? 0) === 0 && environment === "LIVE"
                ? "Ainda não há instrumentos listados no mercado real. As empresas aprovadas pela administração aparecem aqui."
                : "Nenhum instrumento corresponde à pesquisa."}
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          {assets.map((a) => {
            const up = (a.changePct ?? 0) >= 0;
            return (
              <Link
                key={a.id}
                to="/exchange/asset/$symbol"
                params={{ symbol: a.symbol }}
                className="block rounded-xl border border-border/60 bg-card/60 p-3 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold">
                    {a.logoUrl ? (
                      <img src={a.logoUrl} alt={a.name} className="size-10 rounded-full object-cover" />
                    ) : (
                      a.symbol.slice(0, 3)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{a.symbol}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {ASSET_TYPE_LABEL[a.assetType] ?? a.assetType}
                      </Badge>
                      {a.status !== "ACTIVE" && (
                        <Badge variant="destructive" className="text-[10px]">
                          Suspenso
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{a.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Compra {price(a.bid)} · Venda {price(a.ask)} · Volume {a.volume}
                    </p>
                  </div>
                  <div className="h-10 w-16 shrink-0">
                    {a.spark.length > 1 && (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={a.spark.map((p, i) => ({ i, p }))}>
                          <Area
                            type="monotone"
                            dataKey="p"
                            stroke={up ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
                            fill={up ? "hsl(var(--primary) / 0.2)" : "hsl(var(--destructive) / 0.2)"}
                            strokeWidth={2}
                            dot={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold">{price(a.lastPrice)}</p>
                    <p
                      className={`flex items-center justify-end gap-1 text-xs ${
                        a.changePct == null
                          ? "text-muted-foreground"
                          : up
                            ? "text-emerald-400"
                            : "text-destructive"
                      }`}
                    >
                      {a.changePct != null &&
                        (up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />)}
                      {pct(a.changePct)}
                    </p>
                    <span className="mt-1 inline-block rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                      Investir
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {environment === "LIVE"
            ? "Mercado próprio da Betfcom SQs em meticais. Os preços resultam exclusivamente de negócios executados entre participantes deste mercado; não são cotações de terceiros. Negociar exige identidade verificada. Investir envolve risco de perda de capital e nenhum retorno é garantido."
            : "Ambiente de simulação (paper trading) com dinheiro fictício, separado do dinheiro real. Os preços resultam apenas de negócios entre participantes da simulação."}
        </p>
      </main>
      <ExchangeNav />
    </div>
  );
}
