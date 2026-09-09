import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { SiteHeader } from "@/components/site-header";
import { ExchangeNav, PaperBadge } from "@/components/exchange/exchange-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getExchangeAccount } from "@/lib/exchange/trading.functions";
import { MZN } from "@/lib/exchange/format";

export const Route = createFileRoute("/_authenticated/exchange/trades")({
  head: () => ({
    meta: [
      { title: "Negócios executados | SQs Exchange" },
      {
        name: "description",
        content:
          "Negócios executados na sua conta de simulação do SQs Exchange, com preço, quantidade, comissão e liquidação.",
      },
      { property: "og:title", content: "Negócios executados — SQs Exchange" },
      { property: "og:description", content: "Detalhe de cada execução com comissões e liquidação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TradesPage,
});

const dt = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Maputo",
});

function TradesPage() {
  const fetchAccount = useServerFn(getExchangeAccount);
  const query = useQuery({
    queryKey: ["exchange-account"],
    queryFn: () => fetchAccount({ data: { environment: "PAPER" as const } }),
  });

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl space-y-4 px-4 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">Negócios executados</h1>
          <PaperBadge />
        </div>
        <ExchangeNav />

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Execuções recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3">
            {query.isLoading && <Skeleton className="h-20 w-full" />}
            {query.data?.recentTrades.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Ainda não há negócios executados na sua conta.
              </p>
            )}
            {query.data?.recentTrades.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-lg border border-border/60 p-3 text-sm"
              >
                <div>
                  <p className="font-semibold">
                    <span className={t.side === "BUY" ? "text-emerald-400" : "text-destructive"}>
                      {t.side === "BUY" ? "Compra" : "Venda"}
                    </span>{" "}
                    {t.symbol}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.quantity} un. a {t.price.toFixed(2)} MZN · {dt.format(new Date(t.executedAt))}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <p className="text-sm font-medium">{MZN.format(t.grossValue)}</p>
                  <p className="text-muted-foreground">Comissão {t.fee.toFixed(2)} MZN</p>
                  <p className="text-muted-foreground">
                    {t.settlementStatus === "SETTLED" ? "Liquidado" : t.settlementStatus}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
      <ExchangeNav />
    </div>
  );
}
