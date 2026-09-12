import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { LiveBadge } from "@/components/exchange/exchange-nav";
import {
  AssetLogo,
  BigChart,
  Panel,
  Spark,
  StatTile,
  TerminalShell,
  TotalCard,
} from "@/components/exchange/terminal";
import { Skeleton } from "@/components/ui/skeleton";
import { getExchangeAccount } from "@/lib/exchange/trading.functions";
import { getMarketOverview } from "@/lib/exchange/market.functions";
import { MZN, pct, price } from "@/lib/exchange/format";

export const Route = createFileRoute("/_authenticated/exchange/portfolio")({
  head: () => ({
    meta: [
      { title: "Carteira SQs Exchange | Betfcom SQs" },
      {
        name: "description",
        content:
          "Valor total, posições, lucro/prejuízo e liquidez da sua conta de mercado no SQs Exchange.",
      },
      { property: "og:title", content: "Carteira SQs Exchange" },
      { property: "og:description", content: "Posições e resultado da conta de mercado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortfolioPage,
});

function PortfolioPage() {
  const fetchAccount = useServerFn(getExchangeAccount);
  const query = useQuery({
    queryKey: ["exchange-account"],
    queryFn: () => fetchAccount({ data: { environment: "LIVE" as const } }),
    refetchInterval: 20000,
  });
  const acc = query.data;
  const fetchMarket = useServerFn(getMarketOverview);
  const market = useQuery({ queryKey: ["exchange-market"], queryFn: () => fetchMarket({ data: { environment: "LIVE" as const } }) });

  return (
    <TerminalShell
      title="Carteira do mercado"
      badges={<LiveBadge />}
      subtitle="Valor total, posições e resultado calculados no servidor a partir do livro e do registo de negócios."
    >
      {query.isLoading && <Skeleton className="h-40 w-full" />}

      {acc && (
        <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
             <TotalCard
              label="Valor total"
              value={acc.totalValue}
              changeValue={acc.unrealizedPnl}
              changePct={acc.unrealizedPnlPct}
              note="Liquidez disponível + valor dos títulos, aos preços mais recentes do mercado."
            />
             <Panel title="Desempenho" right={<span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">Valor real da conta</span>}>
               <BigChart values={[{ label: "Início", price: acc.totalValue }, { label: "Agora", price: acc.totalValue }]} up={acc.unrealizedPnl >= 0} height={180} />
             </Panel>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <StatTile label="Disponível" value={MZN.format(acc.available)} />
              <StatTile label="Reservado" value={MZN.format(acc.reserved)} />
              <StatTile label="Títulos" value={MZN.format(acc.portfolioValue)} />
              <StatTile
                label="Realizado"
                value={MZN.format(acc.realizedPnl)}
                tone={acc.realizedPnl >= 0 ? "up" : "down"}
              />
            </div>

            <Panel title="Posições" padded={false}>
              {acc.positions.length === 0 ? (
                 <div className="p-3">
                   <p className="mb-3 text-xs text-muted-foreground">Ainda não tem posições. Estas empresas estão disponíveis para investir agora.</p>
                   <div className="divide-y divide-border/40">
                     {(market.data?.assets ?? []).slice(0, 5).map((a) => (
                       <Link key={a.id} to="/exchange/asset/$symbol" params={{ symbol: a.symbol }} className="flex items-center gap-3 py-2.5">
                         <AssetLogo symbol={a.symbol} name={a.name} logoUrl={a.logoUrl} size={32} />
                         <div className="min-w-0 flex-1"><p className="font-semibold">{a.symbol}</p><p className="truncate text-xs text-muted-foreground">{a.name}</p></div>
                         <div className="text-right"><p className="font-mono text-sm font-semibold">{price(a.lastPrice)}</p><p className="text-[10px] text-primary">Investir</p></div>
                       </Link>
                     ))}
                   </div>
                 </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {acc.positions.map((p) => {
                    const up = (p.pnl ?? 0) >= 0;
                    return (
                      <Link
                        key={p.assetId}
                        to="/exchange/asset/$symbol"
                        params={{ symbol: p.symbol }}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-secondary/40"
                      >
                        <AssetLogo symbol={p.symbol} size={32} />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{p.symbol}</p>
                          <p className="font-mono text-xs tabular-nums text-muted-foreground">
                            {p.quantity} un. · médio {p.avgPrice.toFixed(2)} MZN
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-mono text-sm font-semibold tabular-nums">
                            {p.marketValue == null ? "—" : MZN.format(p.marketValue)}
                          </p>
                          <p
                            className={`font-mono text-xs tabular-nums ${
                              p.pnl == null
                                ? "text-muted-foreground"
                                : up
                                  ? "text-primary"
                                  : "text-destructive"
                            }`}
                          >
                            {p.pnl == null ? "—" : `${up ? "+" : ""}${MZN.format(p.pnl)}`} ·{" "}
                            {pct(p.pnlPct)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            último {price(p.lastPrice)}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>

          <aside className="space-y-3">
            <Panel title="Composição">
              {acc.positions.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem títulos em carteira.</p>
              ) : (
                <div className="space-y-2">
                  {acc.positions.map((p) => {
                    const share =
                      acc.portfolioValue > 0 && p.marketValue != null
                        ? (p.marketValue / acc.portfolioValue) * 100
                        : 0;
                    return (
                      <div key={p.assetId} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold">{p.symbol}</span>
                          <span className="font-mono tabular-nums text-muted-foreground">
                            {share.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary">
                          <div
                            className="h-1.5 rounded-full bg-primary"
                            style={{ width: `${Math.min(share, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            <Panel title="Negócios recentes">
              {acc.recentTrades.length === 0 ? (
                <p className="text-xs text-muted-foreground">Ainda sem execuções.</p>
              ) : (
                <div className="space-y-1.5">
                  {acc.recentTrades.slice(0, 6).map((t) => (
                    <div key={t.id} className="flex justify-between text-xs">
                      <span className={t.side === "BUY" ? "text-primary" : "text-destructive"}>
                        {t.side === "BUY" ? "C" : "V"} {t.symbol}
                      </span>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {t.quantity} · {t.price.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {acc.positions.some((p) => p.lastPrice != null) && (
              <Panel title="Evolução do valor">
                <div className="h-24">
                  <Spark
                    values={acc.positions
                      .map((p) => p.marketValue)
                      .filter((v): v is number => v != null)}
                    up={acc.unrealizedPnl >= 0}
                  />
                </div>
              </Panel>
            )}
          </aside>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Mercado real em meticais: os valores usam os preços dos negócios ocorridos neste mercado e,
        antes do primeiro negócio, o preço de referência da empresa. Investir envolve risco de perda
        de capital.
      </p>

    </TerminalShell>
  );
}
