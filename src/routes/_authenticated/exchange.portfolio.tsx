import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { SiteHeader } from "@/components/site-header";
import { ExchangeNav, PaperBadge } from "@/components/exchange/exchange-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl space-y-4 px-4 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">Carteira do mercado</h1>
          <PaperBadge />
        </div>
        <ExchangeNav />

        {query.isLoading && <Skeleton className="h-32 w-full" />}

        {acc && (
          <>
            <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-transparent">
              <CardContent className="space-y-1 p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor total</p>
                <p className="text-3xl font-bold">{MZN.format(acc.totalValue)}</p>
                <p
                  className={
                    acc.unrealizedPnl >= 0 ? "text-sm text-emerald-400" : "text-sm text-destructive"
                  }
                >
                  {acc.unrealizedPnl >= 0 ? "+" : ""}
                  {MZN.format(acc.unrealizedPnl)} não realizado ({pct(acc.unrealizedPnlPct)})
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Stat label="Liquidez disponível" value={MZN.format(acc.available)} />
              <Stat label="Reservado em ordens" value={MZN.format(acc.reserved)} />
              <Stat label="Títulos" value={MZN.format(acc.portfolioValue)} />
              <Stat label="Resultado realizado" value={MZN.format(acc.realizedPnl)} />
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Posições</CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                {acc.positions.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Sem posições. Explore o <Link to="/exchange" className="text-primary">mercado</Link>.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {acc.positions.map((p) => (
                      <Link
                        key={p.assetId}
                        to="/exchange/asset/$symbol"
                        params={{ symbol: p.symbol }}
                        className="flex items-center justify-between rounded-lg border border-border/60 p-3 text-sm hover:border-primary/40"
                      >
                        <div>
                          <p className="font-semibold">{p.symbol}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.quantity} un. · médio {p.avgPrice.toFixed(2)} MZN
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            {p.marketValue == null ? "Dados não disponíveis" : MZN.format(p.marketValue)}
                          </p>
                          <p
                            className={
                              p.pnl == null
                                ? "text-xs text-muted-foreground"
                                : p.pnl >= 0
                                  ? "text-xs text-emerald-400"
                                  : "text-xs text-destructive"
                            }
                          >
                            {p.pnl == null ? "—" : `${p.pnl >= 0 ? "+" : ""}${MZN.format(p.pnl)}`} ·{" "}
                            {pct(p.pnlPct)} · último {price(p.lastPrice)}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <p className="text-[11px] text-muted-foreground">
              Ambiente de simulação: os valores usam apenas preços de negócios ocorridos nesta
              plataforma e não representam cotações oficiais nem dinheiro real.
            </p>
          </>
        )}
      </main>
      <ExchangeNav />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
