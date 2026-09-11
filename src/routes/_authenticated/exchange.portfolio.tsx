import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { PaperBadge } from "@/components/exchange/exchange-nav";
import { Panel, Spark, StatTile, TerminalShell, TotalCard } from "@/components/exchange/terminal";
import { Skeleton } from "@/components/ui/skeleton";
import { getExchangeAccount } from "@/lib/exchange/trading.functions";
import { MZN, pct, price } from "@/lib/exchange/format";

export const Route = createFileRoute("/_authenticated/exchange/portfolio")({
  head: () => ({
    meta: [
      { title: "Carteira SQs Exchange | Betfcom SQs" },
      {
        name: "description",
        content:
          "Valor total, posições, lucro/prejuízo e liquidez da sua conta de simulação no SQs Exchange.",
      },
      { property: "og:title", content: "Carteira SQs Exchange" },
      { property: "og:description", content: "Posições e resultado da conta de simulação." },
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
    queryFn: () => fetchAccount({ data: { environment: "PAPER" as const } }),
    refetchInterval: 20000,
  });
  const acc = query.data;

  return (
    <TerminalShell
      title="Carteira do mercado"
      badges={<PaperBadge />}
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
              spark={acc.positions
                .map((p) => p.marketValue)
                .filter((v): v is number => v != null)}
            />

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
                <p className="p-6 text-center text-sm text-muted-foreground">
                  Sem posições. Explore o{" "}
                  <Link to="/exchange" className="text-primary underline">
                    mercado
                  </Link>
                  .
                </p>
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
                        <div className="min-w-0">
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
        Ambiente de simulação: os valores usam apenas preços de negócios ocorridos nesta plataforma e
        preços de referência definidos pela administração. Não representam cotações oficiais nem
        dinheiro real.
      </p>
    </TerminalShell>
  );
}
