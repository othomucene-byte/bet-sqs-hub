import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { SiteHeader } from "@/components/site-header";
import { InvestorNav } from "@/components/investor-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listOrders } from "@/lib/investments/orders.functions";

export const Route = createFileRoute("/_authenticated/investidor/ordens")({
  head: () => ({
    meta: [
      { title: "Ordens de investimento — BETFCOM SQs" },
      {
        name: "description",
        content:
          "Histórico de ordens de subscrição e resgate, com estado, referência e montante executado validados no servidor.",
      },
      { property: "og:title", content: "Ordens de investimento — BETFCOM SQs" },
      {
        property: "og:description",
        content: "Cada ordem tem chave de idempotência e histórico de estados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrdersPage,
});

const MZN = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "MZN" });

const statusTone: Record<string, string> = {
  EXECUTED: "bg-primary/15 text-primary",
  REDEEMED: "bg-primary/15 text-primary",
  PENDING: "bg-amber-500/15 text-amber-500",
  PROCESSING: "bg-amber-500/15 text-amber-500",
  FAILED: "bg-destructive/15 text-destructive",
  CANCELLED: "bg-muted text-muted-foreground",
};

function OrdersPage() {
  const fetchOrders = useServerFn(listOrders);
  const orders = useQuery({
    queryKey: ["investor-orders"],
    queryFn: () => fetchOrders({ data: { limit: 50 } }),
  });

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 pb-20">
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">Ordens</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Subscrições e resgates com estado atribuído pelo servidor.
        </p>
        <InvestorNav className="mt-5" />

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Histórico de ordens</CardTitle>
            <CardDescription>Máximo das 50 mais recentes.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {(orders.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {orders.isLoading ? "A carregar…" : "Sem ordens registadas."}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Montante</TableHead>
                    <TableHead className="text-right">Executado</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Referência</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(orders.data ?? []).map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(order.createdAt).toLocaleString("pt-PT")}
                      </TableCell>
                      <TableCell>{order.side === "buy" ? "Subscrição" : "Resgate"}</TableCell>
                      <TableCell>{order.productName ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {MZN.format(order.amount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {MZN.format(order.executedAmount)}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusTone[order.status] ?? "bg-muted"}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{order.reference}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
