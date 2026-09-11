import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { PaperBadge } from "@/components/exchange/exchange-nav";
import { Panel, StatTile, TerminalShell } from "@/components/exchange/terminal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cancelOrder, getExchangeAccount, getExchangeHistory } from "@/lib/exchange/trading.functions";
import { MZN, ORDER_STATUS_LABEL } from "@/lib/exchange/format";

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

  const open = account.data?.openOrders ?? [];
  const reserved = open.reduce((s, o) => s + o.reservedAmount, 0);

  return (
    <TerminalShell
      title="Ordens"
      badges={<PaperBadge />}
      subtitle="Cada ordem é validada, reservada e cruzada no servidor; o ecrã só mostra o resultado."
    >
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Ordens abertas" value={String(open.length)} />
        <StatTile label="Reservado" value={MZN.format(reserved)} />
        <StatTile label="No histórico" value={String(history.data?.orders.length ?? 0)} />
      </div>

      <Panel title="Ordens abertas" padded={false}>
        {account.isLoading && <Skeleton className="m-3 h-16" />}
        {open.length === 0 && !account.isLoading && (
          <p className="p-5 text-center text-sm text-muted-foreground">Sem ordens abertas.</p>
        )}
        <div className="divide-y divide-border/40">
          {open.map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="font-semibold">
                  <span className={o.side === "BUY" ? "text-primary" : "text-destructive"}>
                    {o.side === "BUY" ? "Compra" : "Venda"}
                  </span>{" "}
                  {o.symbol}
                </p>
                <p className="font-mono text-xs tabular-nums text-muted-foreground">
                  {o.filledQuantity}/{o.quantity} un. ·{" "}
                  {o.orderType === "LIMIT" ? `${o.limitPrice?.toFixed(2)} MZN` : "a mercado"} ·{" "}
                  {dt.format(new Date(o.createdAt))}
                </p>
                <p className="font-mono text-xs tabular-nums text-muted-foreground">
                  Reservado {o.reservedAmount.toFixed(2)} MZN
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge variant="outline" className="text-[10px]">
                  {ORDER_STATUS_LABEL[o.status] ?? o.status}
                </Badge>
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
        </div>
      </Panel>

      <Panel title="Histórico de ordens" padded={false}>
        {history.isLoading && <Skeleton className="m-3 h-16" />}
        {history.data?.orders.length === 0 && (
          <p className="p-5 text-center text-sm text-muted-foreground">Sem ordens registadas.</p>
        )}
        <div className="divide-y divide-border/40 font-mono text-xs tabular-nums">
          {history.data?.orders.map((o) => (
            <div key={o.id} className="grid grid-cols-5 gap-2 px-3 py-2">
              <span className="text-muted-foreground">{dt.format(new Date(o.createdAt))}</span>
              <span className={o.side === "BUY" ? "text-primary" : "text-destructive"}>
                {o.side === "BUY" ? "C" : "V"} {o.symbol}
              </span>
              <span className="text-right">
                {o.filledQuantity}/{o.quantity}
              </span>
              <span className="text-right">
                {o.avgFillPrice != null ? o.avgFillPrice.toFixed(2) : "—"}
              </span>
              <span className="text-right text-muted-foreground">
                {ORDER_STATUS_LABEL[o.status] ?? o.status}
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </TerminalShell>
  );
}
