import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { LiveBadge } from "@/components/exchange/exchange-nav";
import { Panel, TerminalShell } from "@/components/exchange/terminal";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getExchangeHistory } from "@/lib/exchange/trading.functions";
import { MZN, ORDER_STATUS_LABEL } from "@/lib/exchange/format";

export const Route = createFileRoute("/_authenticated/exchange/history")({
  head: () => ({
    meta: [
      { title: "Histórico e extrato | SQs Exchange" },
      {
        name: "description",
        content:
          "Extrato imutável do SQs Exchange: ordens, transferências e lançamentos contabilísticos da sua conta.",
      },
      { property: "og:title", content: "Histórico e extrato — SQs Exchange" },
      { property: "og:description", content: "Registo completo e auditável dos seus movimentos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryPage,
});

const dt = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Maputo",
});

function HistoryPage() {
  const fetchHistory = useServerFn(getExchangeHistory);
  const query = useQuery({
    queryKey: ["exchange-history"],
    queryFn: () => fetchHistory({ data: { limit: 100 } }),
  });

  return (
    <TerminalShell title="Histórico" badges={<LiveBadge />} subtitle="Ordens, transferências e registo contabilístico imutável da sua conta.">

        {query.isLoading && <Skeleton className="h-32 w-full" />}

        {query.data && (
          <Tabs defaultValue="ordens">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="ordens">Ordens</TabsTrigger>
              <TabsTrigger value="transferencias">Transferências</TabsTrigger>
              <TabsTrigger value="extrato">Extrato contabilístico</TabsTrigger>
            </TabsList>

            <TabsContent value="ordens" className="pt-3">
              <Panel title="Ordens" padded={false}>
                <div className="overflow-x-auto p-3 text-xs">
                  {query.data.orders.length === 0 && (
                    <p className="py-4 text-center text-muted-foreground">Sem registos.</p>
                  )}
                  {query.data.orders.map((o) => (
                    <div key={o.id} className="flex justify-between border-b border-border/40 py-2 last:border-0">
                      <span className="text-muted-foreground">{dt.format(new Date(o.createdAt))}</span>
                      <span>{o.symbol}</span>
                      <span>{o.side === "BUY" ? "Compra" : "Venda"}</span>
                      <span>
                        {o.filledQuantity}/{o.quantity}
                      </span>
                      <span className="text-muted-foreground">
                        {ORDER_STATUS_LABEL[o.status] ?? o.status}
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>
            </TabsContent>

            <TabsContent value="transferencias" className="pt-3">
              <Panel title="Transferências" padded={false}>
                <div className="overflow-x-auto p-3 text-xs">
                  {query.data.transfers.length === 0 && (
                    <p className="py-4 text-center text-muted-foreground">Sem transferências.</p>
                  )}
                  {query.data.transfers.map((t) => (
                    <div key={t.id} className="flex justify-between border-b border-border/40 py-2 last:border-0">
                      <span className="text-muted-foreground">{dt.format(new Date(t.createdAt))}</span>
                      <span>{t.direction === "IN" ? "Entrada" : "Saída"}</span>
                      <span>{t.source}</span>
                      <span className="font-medium">{MZN.format(t.amount)}</span>
                      <span className="text-muted-foreground">{t.status}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </TabsContent>

            <TabsContent value="extrato" className="pt-3">
              <Panel title="Lançamentos — dupla entrada" padded={false}>
                <div className="overflow-x-auto p-3 text-xs">
                  {query.data.ledger.length === 0 && (
                    <p className="py-4 text-center text-muted-foreground">Sem lançamentos.</p>
                  )}
                  {query.data.ledger.map((e) => (
                    <div key={e.id} className="flex justify-between border-b border-border/40 py-2 last:border-0">
                      <span className="text-muted-foreground">{dt.format(new Date(e.createdAt))}</span>
                      <span>{e.referenceType}</span>
                      <span className="max-w-[90px] truncate text-muted-foreground">{e.reference}</span>
                      <span>{e.kind}</span>
                      <span className={e.debit > 0 ? "text-destructive" : "text-emerald-400"}>
                        {e.debit > 0 ? `-${e.debit.toFixed(2)}` : `+${e.credit.toFixed(2)}`}
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>
            </TabsContent>
          </Tabs>
        )}
    </TerminalShell>
  );
}
