import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site-header";
import { ExchangeNav, PaperBadge } from "@/components/exchange/exchange-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cancelOrder, getExchangeAccount, getExchangeHistory } from "@/lib/exchange/trading.functions";
import { ORDER_STATUS_LABEL } from "@/lib/exchange/format";

export const Route = createFileRoute("/_authenticated/exchange/orders")({
  head: () => ({
    meta: [
      { title: "Ordens SQs Exchange | Betfcom SQs" },
      {
        name: "description",
        content: "Ordens abertas e histórico de ordens da sua conta de simulação no SQs Exchange.",
      },
      { property: "og:title", content: "Ordens SQs Exchange" },
      { property: "og:description", content: "Acompanhe e cancele ordens no mercado de simulação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrdersPage,
});

const dt = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Maputo",
});

function OrdersPage() {
  const queryClient = useQueryClient();
  const fetchAccount = useServerFn(getExchangeAccount);
  const fetchHistory = useServerFn(getExchangeHistory);
  const doCancel = useServerFn(cancelOrder);

  const account = useQuery({
    queryKey: ["exchange-account"],
    queryFn: () => fetchAccount({ data: { environment: "PAPER" as const } }),
    refetchInterval: 15000,
  });
  const history = useQuery({
    queryKey: ["exchange-history"],
    queryFn: () => fetchHistory({ data: { limit: 100 } }),
  });

  const cancel = useMutation({
    mutationFn: (orderId: string) => doCancel({ data: { orderId, environment: "PAPER" as const } }),
    onSuccess: () => {
      toast.success("Ordem cancelada e fundos liberados");
      queryClient.invalidateQueries({ queryKey: ["exchange-account"] });
      queryClient.invalidateQueries({ queryKey: ["exchange-history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl space-y-4 px-4 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">Ordens</h1>
          <PaperBadge />
        </div>
        <ExchangeNav />

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ordens abertas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3">
            {account.isLoading && <Skeleton className="h-16 w-full" />}
            {account.data?.openOrders.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">Sem ordens abertas.</p>
            )}
            {account.data?.openOrders.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between rounded-lg border border-border/60 p-3 text-sm"
              >
                <div>
                  <p className="font-semibold">
                    <span className={o.side === "BUY" ? "text-emerald-400" : "text-destructive"}>
                      {o.side === "BUY" ? "Compra" : "Venda"}
                    </span>{" "}
                    {o.symbol}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {o.filledQuantity}/{o.quantity} un. ·{" "}
                    {o.orderType === "LIMIT" ? `${o.limitPrice?.toFixed(2)} MZN` : "a mercado"} ·{" "}
                    {dt.format(new Date(o.createdAt))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Reservado: {o.reservedAmount.toFixed(2)} MZN
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline">{ORDER_STATUS_LABEL[o.status] ?? o.status}</Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={cancel.isPending}
                    onClick={() => cancel.mutate(o.id)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Histórico de ordens</CardTitle>
          </CardHeader>
          <CardContent className="p-3 text-xs">
            {history.isLoading && <Skeleton className="h-16 w-full" />}
            {history.data?.orders.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">Sem ordens registadas.</p>
            )}
            {history.data?.orders.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between border-b border-border/40 py-2 last:border-0"
              >
                <span className="text-muted-foreground">{dt.format(new Date(o.createdAt))}</span>
                <span className={o.side === "BUY" ? "text-emerald-400" : "text-destructive"}>
                  {o.side === "BUY" ? "C" : "V"} {o.symbol}
                </span>
                <span>
                  {o.filledQuantity}/{o.quantity}
                </span>
                <span>{o.avgFillPrice != null ? `${o.avgFillPrice.toFixed(2)} MZN` : "—"}</span>
                <span className="text-muted-foreground">{ORDER_STATUS_LABEL[o.status] ?? o.status}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
      <ExchangeNav />
    </div>
  );
}
