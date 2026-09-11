import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { LiveBadge } from "@/components/exchange/exchange-nav";
import { Panel, StatTile, TerminalShell } from "@/components/exchange/terminal";
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
          "Negócios executados na sua conta de mercado do SQs Exchange, com preço, quantidade, comissão e liquidação.",
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
    queryFn: () => fetchAccount({ data: { environment: "LIVE" as const } }),
    refetchInterval: 20000,
  });

  const trades = query.data?.recentTrades ?? [];
  const volume = trades.reduce((s, t) => s + t.grossValue, 0);
  const fees = trades.reduce((s, t) => s + t.fee, 0);

  return (
    <TerminalShell
      title="Negócios executados"
      badges={<LiveBadge />}
      subtitle="Fita de execuções da sua conta, com preço, quantidade, comissão e estado de liquidação."
    >
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Execuções" value={String(trades.length)} />
        <StatTile label="Valor negociado" value={MZN.format(volume)} />
        <StatTile label="Comissões" value={MZN.format(fees)} />
      </div>

      <Panel title="Fita de negócios" padded={false}>
        {query.isLoading && <Skeleton className="m-3 h-20" />}
        {trades.length === 0 && !query.isLoading && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Ainda não há negócios executados na sua conta.
          </p>
        )}
        <div className="divide-y divide-border/40">
          {trades.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <div>
                <p className="font-semibold">
                  <span className={t.side === "BUY" ? "text-primary" : "text-destructive"}>
                    {t.side === "BUY" ? "Compra" : "Venda"}
                  </span>{" "}
                  {t.symbol}
                </p>
                <p className="font-mono text-xs tabular-nums text-muted-foreground">
                  {t.quantity} un. a {t.price.toFixed(2)} MZN · {dt.format(new Date(t.executedAt))}
                </p>
              </div>
              <div className="shrink-0 text-right font-mono text-xs tabular-nums">
                <p className="text-sm font-semibold">{MZN.format(t.grossValue)}</p>
                <p className="text-muted-foreground">Comissão {t.fee.toFixed(2)} MZN</p>
                <p className="text-muted-foreground">
                  {t.settlementStatus === "SETTLED" ? "Liquidado" : t.settlementStatus}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </TerminalShell>
  );
}
