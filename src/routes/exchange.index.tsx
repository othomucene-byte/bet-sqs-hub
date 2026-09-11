import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";

import { EnvBadge } from "@/components/exchange/exchange-nav";
import { Chips, Panel, Spark, StatTile, TerminalShell } from "@/components/exchange/terminal";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getMarketOverview } from "@/lib/exchange/market.functions";
import { ASSET_TYPE_LABEL, MARKET_STATUS_LABEL, MZN, pct, price } from "@/lib/exchange/format";

export const Route = createFileRoute("/exchange/")({
  head: () => ({
    meta: [
      { title: "SQs Exchange — Mercado Moçambicano | Betfcom SQs" },
      {
        name: "description",
        content:
          "SQs Exchange: mercado moçambicano em meticais, com livro de ordens, carteira e ordens validadas no servidor, na plataforma Betfcom SQs.",
      },
      { property: "og:title", content: "SQs Exchange — Mercado Moçambicano" },
      {
        property: "og:description",
        content: "Livro de ordens, carteira e ordens em meticais na Betfcom SQs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExchangeMarket,
});

const CATEGORIES = ["Todos", "EQUITY", "BOND", "COMMERCIAL_PAPER", "FUND", "OTHER"] as const;
const CATEGORY_LABELS: Record<string, string> = { Todos: "Todos", ...ASSET_TYPE_LABEL };

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
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("Todos");

  // Se o mercado real ainda não tem empresas listadas, mostramos logo a simulação
  // para que a lista nunca apareça vazia sem explicação.
  useEffect(() => {
    if (environment === "LIVE" && !autoSwitched && query.data && query.data.assets.length === 0) {
      setAutoSwitched(true);
      setEnvironment("PAPER");
    }
  }, [environment, autoSwitched, query.data]);

  const rows = query.data?.assets ?? [];
  const assets = useMemo(() => {
    const t = term.trim().toUpperCase();
    return rows.filter(
      (a) =>
        (category === "Todos" || a.assetType === category) &&
        (t === "" || a.symbol.includes(t) || a.name.toUpperCase().includes(t)),
    );
  }, [rows, term, category]);

  const traded = rows.filter((a) => !a.isReferenceOnly && a.lastPrice != null);
  const gainers = traded.filter((a) => (a.changePct ?? 0) > 0).length;
  const losers = traded.filter((a) => (a.changePct ?? 0) < 0).length;
  const totalVolume = rows.reduce((s, a) => s + a.volume, 0);
  const lastUpdate = query.dataUpdatedAt
    ? new Intl.DateTimeFormat("pt-PT", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Africa/Maputo",
      }).format(new Date(query.dataUpdatedAt))
    : "—";

  return (
    <TerminalShell
      wide
      title="SQs Exchange"
      badges={
        <>
          <span className="text-xs text-muted-foreground">🇲🇿 Moçambique · MZN</span>
          <EnvBadge environment={environment} />
        </>
      }
      subtitle={
        query.data
          ? `${query.data.marketName} · ${MARKET_STATUS_LABEL[query.data.marketStatus]} · ${query.data.opensAt}–${query.data.closesAt} (Maputo) · atualizado às ${lastUpdate}`
          : "A carregar estado do mercado…"
      }
    >
      <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          <div className="flex gap-1 rounded-lg border border-border/60 bg-card/60 p-1">
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

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Empresas" value={String(rows.length)} />
            <StatTile label="Em alta" value={String(gainers)} tone="up" />
            <StatTile label="Em baixa" value={String(losers)} tone="down" />
            <StatTile label="Volume do dia" value={String(totalVolume)} />
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Pesquisar empresa ou código..."
              className="pl-9"
            />
          </div>

          <Chips
            options={CATEGORIES}
            value={category}
            onChange={setCategory}
            labels={CATEGORY_LABELS}
          />

          <Panel title="Cotações" padded={false}>
            <div className="hidden grid-cols-[1fr_90px_80px_80px_70px_84px] gap-2 border-b border-border/50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground sm:grid">
              <span>Empresa</span>
              <span className="text-right">Preço</span>
              <span className="text-right">Variação</span>
              <span className="text-right">Compra/Venda</span>
              <span className="text-right">Volume</span>
              <span className="text-right">Ação</span>
            </div>

            {query.isLoading && (
              <div className="space-y-2 p-3">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            )}

            {query.isError && (
              <p className="p-6 text-sm text-destructive">
                Não foi possível carregar o mercado. Tente novamente.
              </p>
            )}

            {query.data && assets.length === 0 && (
              <p className="p-6 text-sm text-muted-foreground">
                {rows.length === 0 && environment === "LIVE"
                  ? "Ainda não há empresas listadas no mercado real. As empresas aprovadas pela administração aparecem aqui."
                  : "Nenhuma empresa corresponde à pesquisa."}
              </p>
            )}

            <div className="divide-y divide-border/40">
              {assets.map((a) => {
                const up = (a.changePct ?? 0) >= 0;
                return (
                  <Link
                    key={a.id}
                    to="/exchange/asset/$symbol"
                    params={{ symbol: a.symbol }}
                    className="grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-2.5 transition-colors hover:bg-secondary/40 sm:grid-cols-[1fr_90px_80px_80px_70px_84px]"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold">
                        {a.logoUrl ? (
                          <img
                            src={a.logoUrl}
                            alt={a.name}
                            className="size-9 rounded-full object-cover"
                          />
                        ) : (
                          a.symbol.slice(0, 3)
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold">{a.symbol}</span>
                          <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">
                            {ASSET_TYPE_LABEL[a.assetType] ?? a.assetType}
                          </Badge>
                          {a.status !== "ACTIVE" && (
                            <Badge variant="destructive" className="text-[10px]">
                              Suspenso
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{a.name}</p>
                        <p className="text-[10px] text-muted-foreground sm:hidden">
                          {a.isReferenceOnly ? "preço de referência" : `Volume ${a.volume}`}
                        </p>
                      </div>
                    </div>

                    <div className="text-right sm:hidden">
                      <p className="font-mono text-sm font-semibold tabular-nums">
                        {price(a.lastPrice)}
                      </p>
                      <p
                        className={`font-mono text-xs tabular-nums ${
                          a.changePct == null
                            ? "text-muted-foreground"
                            : up
                              ? "text-primary"
                              : "text-destructive"
                        }`}
                      >
                        {pct(a.changePct)}
                      </p>
                      <span className="mt-1 inline-block rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                        Investir
                      </span>
                    </div>

                    <p className="hidden text-right font-mono text-sm font-semibold tabular-nums sm:block">
                      {a.lastPrice == null ? "—" : a.lastPrice.toFixed(2)}
                    </p>
                    <p
                      className={`hidden text-right font-mono text-xs tabular-nums sm:block ${
                        a.changePct == null
                          ? "text-muted-foreground"
                          : up
                            ? "text-primary"
                            : "text-destructive"
                      }`}
                    >
                      {pct(a.changePct)}
                    </p>
                    <p className="hidden text-right font-mono text-[11px] tabular-nums text-muted-foreground sm:block">
                      {a.bid == null ? "—" : a.bid.toFixed(2)} /{" "}
                      {a.ask == null ? "—" : a.ask.toFixed(2)}
                    </p>
                    <p className="hidden text-right font-mono text-[11px] tabular-nums text-muted-foreground sm:block">
                      {a.volume}
                    </p>
                    <div className="hidden justify-end sm:flex">
                      <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                        Investir
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Panel>
        </div>

        <aside className="space-y-3">
          <Panel title="Como investir">
            <ol className="space-y-1.5 text-xs text-muted-foreground">
              <li>1. Coloque fundos na conta de mercado, em Fundos.</li>
              <li>2. Escolha uma empresa e toque em Investir.</li>
              <li>3. Diga quantas ações quer e a que preço.</li>
              <li>4. A ordem é validada e registada no servidor.</li>
            </ol>
          </Panel>

          <Panel title="Maiores subidas">
            {traded.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Ainda não houve negócios; as variações aparecem depois da primeira compra e venda
                entre participantes.
              </p>
            ) : (
              <div className="space-y-1.5">
                {traded
                  .slice()
                  .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))
                  .slice(0, 5)
                  .map((a) => (
                    <Link
                      key={a.id}
                      to="/exchange/asset/$symbol"
                      params={{ symbol: a.symbol }}
                      className="flex items-center justify-between gap-2 rounded-md px-1 py-1 hover:bg-secondary/40"
                    >
                      <span className="text-xs font-semibold">{a.symbol}</span>
                      <div className="h-6 w-14">
                        {a.spark.length > 1 && (
                          <Spark values={a.spark} up={(a.changePct ?? 0) >= 0} />
                        )}
                      </div>
                      <span
                        className={`font-mono text-xs tabular-nums ${
                          (a.changePct ?? 0) >= 0 ? "text-primary" : "text-destructive"
                        }`}
                      >
                        {pct(a.changePct)}
                      </span>
                    </Link>
                  ))}
              </div>
            )}
          </Panel>

          <Panel title="Preços de referência">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Enquanto uma empresa não tiver negócios, mostramos o preço de referência definido pela
              administração ({rows.filter((a) => a.isReferenceOnly).length} empresas neste momento).
              Não é cotação de terceiros. A partir do primeiro negócio, o preço passa a resultar
              apenas das compras e vendas entre participantes.
            </p>
          </Panel>

          <Panel title="Total do mercado">
            <p className="font-mono text-lg font-bold tabular-nums">
              {MZN.format(
                rows.reduce((s, a) => s + (a.lastPrice ?? 0) * Math.max(a.volume, 1), 0),
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Valor indicativo dos preços atuais multiplicados pelo volume registado.
            </p>
          </Panel>
        </aside>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {environment === "LIVE"
          ? "Mercado próprio da Betfcom SQs em meticais. Os preços resultam de negócios entre participantes deste mercado; não são cotações de terceiros. Negociar exige identidade verificada. Investir envolve risco de perda de capital e nenhum retorno é garantido."
          : "Ambiente de simulação (paper trading) com dinheiro fictício, separado do dinheiro real. Os preços resultam apenas de negócios entre participantes da simulação."}
      </p>
    </TerminalShell>
  );
}
