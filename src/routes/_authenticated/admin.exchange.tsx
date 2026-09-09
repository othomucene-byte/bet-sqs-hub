import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  adminCancelOrder,
  getAdminExchangeOverview,
  setMarketStatus,
} from "@/lib/exchange/admin.functions";
import { MZN, MARKET_STATUS_LABEL, ORDER_STATUS_LABEL, price } from "@/lib/exchange/format";

export const Route = createFileRoute("/_authenticated/admin/exchange")({
  head: () => ({
    meta: [
      { title: "Administração do SQs Exchange | Betfcom SQs" },
      {
        name: "description",
        content:
          "Painel de administração do SQs Exchange: estado do mercado, instrumentos, ordens, negócios, taxas, risco e auditoria.",
      },
      { property: "og:title", content: "Administração do SQs Exchange" },
      { property: "og:description", content: "Supervisão do mercado, ledger e risco." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminExchange,
});

const dt = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Maputo",
});

function AdminExchange() {
  const queryClient = useQueryClient();
  const fetchOverview = useServerFn(getAdminExchangeOverview);
  const doStatus = useServerFn(setMarketStatus);
  const doCancel = useServerFn(adminCancelOrder);

  const query = useQuery({
    queryKey: ["admin-exchange"],
    queryFn: () => fetchOverview(),
    retry: false,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-exchange"] });

  const status = useMutation({
    mutationFn: (vars: { marketId: string; status: "PRE_OPEN" | "OPEN" | "PAUSED" | "CLOSED" }) =>
      doStatus({ data: vars }),
    onSuccess: () => {
      toast.success("Estado do mercado atualizado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: (orderId: string) => doCancel({ data: { orderId } }),
    onSuccess: () => {
      toast.success("Ordem cancelada");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = query.data;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Administração — SQs Exchange</h1>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin">Voltar ao painel</Link>
          </Button>
        </div>

        {query.isLoading && <Skeleton className="h-32 w-full" />}

        {query.isError && (
          <Card>
            <CardContent className="p-6 text-sm text-destructive">
              {(query.error as Error).message}
            </CardContent>
          </Card>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Stat label="Contas" value={String(data.investors)} />
              <Stat label="Ordens abertas" value={String(data.openOrders)} />
              <Stat label="Negócios hoje" value={String(data.tradesToday)} />
              <Stat label="Volume hoje" value={MZN.format(data.volumeToday)} />
              <Stat label="Instrumentos" value={String(data.assets)} />
              <Stat label="Transferências pendentes" value={String(data.pendingTransfers)} />
              <Stat label="Alertas de risco" value={String(data.riskAlerts)} />
              <Stat
                label="Ledger"
                value={data.ledgerBalanced ? "Equilibrado" : "Divergente!"}
              />
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Estado do mercado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-3">
                {data.markets.map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 p-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold">
                        {m.name} <Badge variant="outline">{m.environment}</Badge>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {m.code} · {m.opensAt}–{m.closesAt} · {MARKET_STATUS_LABEL[m.status] ?? m.status}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {(["PRE_OPEN", "OPEN", "PAUSED", "CLOSED"] as const).map((s) => (
                        <Button
                          key={s}
                          size="sm"
                          variant={m.status === s ? "default" : "outline"}
                          disabled={status.isPending}
                          onClick={() => status.mutate({ marketId: m.id, status: s })}
                        >
                          {MARKET_STATUS_LABEL[s]}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Tabs defaultValue="ordens">
              <TabsList className="grid w-full grid-cols-3 md:grid-cols-6">
                <TabsTrigger value="ordens">Ordens</TabsTrigger>
                <TabsTrigger value="negocios">Negócios</TabsTrigger>
                <TabsTrigger value="ativos">Instrumentos</TabsTrigger>
                <TabsTrigger value="ledger">Ledger</TabsTrigger>
                <TabsTrigger value="risco">Risco e taxas</TabsTrigger>
                <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
              </TabsList>

              <TabsContent value="ordens" className="pt-3">
                <Card>
                  <CardContent className="p-3 text-xs">
                    {data.orders.map((o) => (
                      <div key={o.id} className="flex items-center justify-between border-b border-border/40 py-2 last:border-0">
                        <span className="text-muted-foreground">{dt.format(new Date(o.createdAt))}</span>
                        <span>{o.symbol}</span>
                        <span>{o.side === "BUY" ? "Compra" : "Venda"}</span>
                        <span>
                          {o.remainingQuantity}/{o.quantity}
                        </span>
                        <span>{o.limitPrice != null ? `${o.limitPrice.toFixed(2)}` : "mercado"}</span>
                        <span className="text-muted-foreground">
                          {ORDER_STATUS_LABEL[o.status] ?? o.status}
                        </span>
                        {["OPEN", "PARTIALLY_FILLED"].includes(o.status) && (
                          <Button size="sm" variant="ghost" onClick={() => cancel.mutate(o.id)}>
                            Cancelar
                          </Button>
                        )}
                      </div>
                    ))}
                    {data.orders.length === 0 && (
                      <p className="py-4 text-center text-muted-foreground">Sem ordens.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="negocios" className="pt-3">
                <Card>
                  <CardContent className="p-3 text-xs">
                    {data.trades.map((t) => (
                      <div key={t.id} className="flex justify-between border-b border-border/40 py-2 last:border-0">
                        <span className="text-muted-foreground">{dt.format(new Date(t.executedAt))}</span>
                        <span>{t.symbol}</span>
                        <span>{t.quantity}</span>
                        <span>{t.price.toFixed(2)} MZN</span>
                        <span>{MZN.format(t.grossValue)}</span>
                        <span className="text-muted-foreground">Comissões {t.fees.toFixed(2)}</span>
                      </div>
                    ))}
                    {data.trades.length === 0 && (
                      <p className="py-4 text-center text-muted-foreground">Sem negócios hoje.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="ativos" className="pt-3">
                <Card>
                  <CardContent className="p-3 text-xs">
                    {data.assetRows.map((a) => (
                      <div key={a.id} className="flex justify-between border-b border-border/40 py-2 last:border-0">
                        <span className="font-semibold">{a.symbol}</span>
                        <span className="max-w-[140px] truncate text-muted-foreground">{a.name}</span>
                        <span>{a.assetType}</span>
                        <span>{a.status}</span>
                        <span>{a.isDemo ? "Demo" : "Real"}</span>
                        <span>{price(a.lastPrice)}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="ledger" className="pt-3">
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-sm">
                      Débitos {MZN.format(data.totalDebits)} · Créditos {MZN.format(data.totalCredits)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 text-xs">
                    {data.ledger.map((e) => (
                      <div key={e.id} className="flex justify-between border-b border-border/40 py-2 last:border-0">
                        <span className="text-muted-foreground">{dt.format(new Date(e.createdAt))}</span>
                        <span>{e.referenceType}</span>
                        <span className="max-w-[110px] truncate text-muted-foreground">{e.reference}</span>
                        <span>{e.kind}</span>
                        <span>
                          {e.debit > 0 ? `D ${e.debit.toFixed(2)}` : `C ${e.credit.toFixed(2)}`}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="risco" className="space-y-2 pt-3">
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-sm">Taxas</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 text-xs">
                    {data.fees.map((f) => (
                      <div key={f.id} className="flex justify-between border-b border-border/40 py-2 last:border-0">
                        <span>{f.name}</span>
                        <span>{(f.percent * 100).toFixed(3)}%</span>
                        <span>{f.fixed.toFixed(2)} MZN</span>
                        <span className="text-muted-foreground">{f.active ? "Ativa" : "Inativa"}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-sm">Limites e alertas</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 text-xs">
                    {data.limits.map((l) => (
                      <div key={l.id} className="flex justify-between border-b border-border/40 py-2">
                        <span>{l.userId ? "Utilizador" : "Global"}</span>
                        <span>Ordem {MZN.format(l.maxOrderValue)}</span>
                        <span>Posição {MZN.format(l.maxPositionValue)}</span>
                        <span>Diário {MZN.format(l.maxDailyVolume)}</span>
                        <span>{l.maxOpenOrders} ordens</span>
                      </div>
                    ))}
                    {data.alerts.map((a) => (
                      <div key={a.id} className="flex justify-between py-2 text-amber-400">
                        <span>{dt.format(new Date(a.createdAt))}</span>
                        <span>{a.kind}</span>
                        <span className="max-w-[200px] truncate">{a.message}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="auditoria" className="pt-3">
                <Card>
                  <CardContent className="p-3 text-xs">
                    {data.audit.map((a) => (
                      <div key={a.id} className="flex justify-between border-b border-border/40 py-2 last:border-0">
                        <span className="text-muted-foreground">{dt.format(new Date(a.createdAt))}</span>
                        <span>{a.action}</span>
                        <span>{a.entity ?? "—"}</span>
                        <span className="max-w-[120px] truncate text-muted-foreground">
                          {a.entityId ?? "—"}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
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
