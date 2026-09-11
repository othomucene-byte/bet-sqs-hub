import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { SiteHeader } from "@/components/site-header";
import { EnvBadge, ExchangeNav, PaperBadge } from "@/components/exchange/exchange-nav";
import { TradePanel } from "@/components/exchange/trade-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { getAssetDetail } from "@/lib/exchange/market.functions";
import { getCompanyData } from "@/lib/exchange/company-data.functions";
import { ASSET_TYPE_LABEL, MARKET_STATUS_LABEL, pct, price, splitBook } from "@/lib/exchange/format";

export const Route = createFileRoute("/exchange/asset/$symbol")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.symbol} — SQs Exchange | Betfcom SQs` },
      {
        name: "description",
        content: `Livro de ordens, negócios e informação do instrumento ${params.symbol} no SQs Exchange, mercado de simulação em MZN da Betfcom SQs.`,
      },
      { property: "og:title", content: `${params.symbol} — SQs Exchange` },
      {
        property: "og:description",
        content: `Preço, livro de ordens e negócios de ${params.symbol} em ambiente de simulação.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssetPage,
});

const KIND_LABEL: Record<string, string> = {
  earnings: "Resultados",
  news: "Notícia",
  dividend: "Dividendo",
  corporate_event: "Evento corporativo",
  guidance: "Perspetivas",
  other: "Outro",
};

const timeFmt = new Intl.DateTimeFormat("pt-PT", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Maputo",
});

function AssetPage() {
  const { symbol } = Route.useParams();
  const fetchAsset = useServerFn(getAssetDetail);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["exchange-asset", symbol],
    queryFn: () => fetchAsset({ data: { symbol } }),
    refetchInterval: 15000,
  });

  // Realtime apenas para atualizar a UI; a verdade continua no servidor.
  useEffect(() => {
    const channel = supabase
      .channel(`exchange-asset-${symbol}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trades" }, () => {
        queryClient.invalidateQueries({ queryKey: ["exchange-asset", symbol] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "market_data" }, () => {
        queryClient.invalidateQueries({ queryKey: ["exchange-asset", symbol] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [symbol, queryClient]);

  const asset = query.data;
  const fetchCompanyData = useServerFn(getCompanyData);
  const companyData = useQuery({
    queryKey: ["exchange-company-data", asset?.id],
    queryFn: () => fetchCompanyData({ data: { assetId: asset!.id, includeHistory: false } }),
    enabled: Boolean(asset?.id),
    refetchInterval: 300000,
  });
  const { bids, asks } = splitBook(asset?.book ?? []);
  const change =
    asset?.quote.lastPrice != null && asset.quote.prevClose != null && asset.quote.prevClose > 0
      ? ((asset.quote.lastPrice - asset.quote.prevClose) / asset.quote.prevClose) * 100
      : null;

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl space-y-4 px-4 py-5">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/exchange">← Mercado</Link>
        </Button>

        {query.isLoading && <Skeleton className="h-40 w-full" />}

        {!query.isLoading && !asset && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Instrumento não encontrado.
            </CardContent>
          </Card>
        )}

        {asset && (
          <>
            <header className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <AssetLogo symbol={asset.symbol} name={asset.name} size={44} />
                <h1 className="text-2xl font-bold">{asset.symbol}</h1>
                <Badge variant="outline">{ASSET_TYPE_LABEL[asset.assetType] ?? asset.assetType}</Badge>
                {asset.isDemo ? <PaperBadge /> : <EnvBadge environment="LIVE" />}
              </div>
              <p className="text-sm text-muted-foreground">{asset.name}</p>
              <div className="flex items-end gap-3">
                <span className="text-3xl font-bold">{price(asset.quote.lastPrice)}</span>
                <span
                  className={
                    change == null
                      ? "text-sm text-muted-foreground"
                      : change >= 0
                        ? "text-sm text-emerald-400"
                        : "text-sm text-destructive"
                  }
                >
                  {pct(change)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Mercado: {MARKET_STATUS_LABEL[asset.marketStatus] ?? asset.marketStatus} · Volume{" "}
                {asset.quote.volume} · Compra {price(asset.quote.bid)} · Venda {price(asset.quote.ask)}
              </p>
              {asset.isReferenceOnly && (
                <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-400">
                  Preço de referência ({asset.referenceSource ?? "definido pela administração"}).
                  Ainda não houve negócios nesta empresa; a partir da primeira compra e venda o preço
                  passa a resultar apenas do mercado.
                </p>
              )}

            </header>

            <div className="grid gap-4 md:grid-cols-[1fr_320px]">
              <Tabs defaultValue="resumo">
                <TabsList className="grid w-full grid-cols-6 text-xs">
                  <TabsTrigger value="resumo">Resumo</TabsTrigger>
                  <TabsTrigger value="grafico">Gráfico</TabsTrigger>
                  <TabsTrigger value="livro">Livro</TabsTrigger>
                  <TabsTrigger value="negocios">Negócios</TabsTrigger>
                  <TabsTrigger value="empresa">Empresa</TabsTrigger>
                  <TabsTrigger value="info">Info</TabsTrigger>
                </TabsList>

                <TabsContent value="resumo" className="space-y-2 pt-3">
                  <Card>
                    <CardContent className="grid grid-cols-2 gap-3 p-4 text-sm">
                      <Field label="Último preço" value={price(asset.quote.lastPrice)} />
                      <Field label="Fecho anterior" value={price(asset.quote.prevClose)} />
                      <Field label="Máximo do dia" value={price(asset.quote.dayHigh)} />
                      <Field label="Mínimo do dia" value={price(asset.quote.dayLow)} />
                      <Field label="Volume" value={String(asset.quote.volume)} />
                      <Field label="Variação mínima" value={`${asset.tickSize} MZN`} />
                      <Field label="Lote mínimo" value={String(asset.lotSize)} />
                      <Field label="Moeda" value={asset.currency} />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="grafico" className="pt-3">
                  <Card>
                    <CardContent className="h-64 p-3">
                      {asset.history.length > 1 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={asset.history.map((h) => ({ ...h, label: timeFmt.format(new Date(h.t)) }))}>
                            <CartesianGrid strokeOpacity={0.1} vertical={false} />
                            <XAxis dataKey="label" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis fontSize={10} tickLine={false} axisLine={false} width={45} domain={["auto", "auto"]} />
                            <Tooltip />
                            <Area
                              type="monotone"
                              dataKey="price"
                              stroke="var(--primary)"
                              fill="color-mix(in oklab, var(--primary) 18%, transparent)"
                              strokeWidth={2}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                          Dados não disponíveis — ainda não houve negócios neste instrumento.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="livro" className="pt-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Livro de ordens</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 p-3 text-xs">
                      {asks.length === 0 && bids.length === 0 && (
                        <p className="py-6 text-center text-muted-foreground">Livro vazio.</p>
                      )}
                      {asks
                        .slice()
                        .reverse()
                        .map((l, i) => (
                          <Row key={`a${i}`} price={l.price} qty={l.quantity} tone="sell" />
                        ))}
                      <div className="my-1 rounded-md bg-secondary/50 py-1 text-center font-semibold">
                        Último: {price(asset.quote.lastPrice)}
                      </div>
                      {bids.map((l, i) => (
                        <Row key={`b${i}`} price={l.price} qty={l.quantity} tone="buy" />
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="negocios" className="pt-3">
                  <Card>
                    <CardContent className="p-3 text-xs">
                      {asset.trades.length === 0 ? (
                        <p className="py-6 text-center text-muted-foreground">Sem negócios registados.</p>
                      ) : (
                        asset.trades.map((t) => (
                          <div key={t.id} className="flex justify-between border-b border-border/40 py-1.5 last:border-0">
                            <span className="text-muted-foreground">{timeFmt.format(new Date(t.executedAt))}</span>
                            <span>{t.quantity}</span>
                            <span className="font-semibold">{t.price.toFixed(2)} MZN</span>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="empresa" className="space-y-2 pt-3">
                  {companyData.isLoading && <Skeleton className="h-24 w-full" />}
                  {companyData.data?.length === 0 && (
                    <Card>
                      <CardContent className="p-4 text-sm text-muted-foreground">
                        Ainda não há dados validados desta empresa. A atualização automática corre de
                        hora a hora e cada registo é publicado com fonte e data.
                      </CardContent>
                    </Card>
                  )}
                  {(companyData.data ?? []).map((d) => (
                    <Card key={d.id}>
                      <CardContent className="space-y-1 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {KIND_LABEL[d.kind] ?? d.kind}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(d.collectedAt).toLocaleDateString("pt-PT")}
                          </span>
                        </div>
                        <p className="text-sm font-semibold">{d.title}</p>
                        {d.summary && <p className="text-xs text-muted-foreground">{d.summary}</p>}
                        {Object.keys(d.metrics).length > 0 && (
                          <div className="grid grid-cols-2 gap-1 pt-1 text-xs">
                            {Object.entries(d.metrics).map(([k, v]) => (
                              <div key={k} className="flex justify-between gap-2">
                                <span className="text-muted-foreground">{k}</span>
                                <span className="font-medium">{String(v)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="pt-1 text-[11px] text-muted-foreground">
                          Fonte: {d.sourceUrl ? (
                            <a href={d.sourceUrl} target="_blank" rel="noreferrer noopener" className="underline">
                              {d.sourceName}
                            </a>
                          ) : (
                            d.sourceName
                          )}{" "}
                          · Confiança {(d.confidence * 100).toFixed(0)}%
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                  <p className="text-[11px] text-muted-foreground">
                    Informação recolhida por inteligência artificial e validada antes de publicação.
                    Não é recomendação de investimento.
                  </p>
                </TabsContent>

                <TabsContent value="info" className="pt-3">
                  <Card>
                    <CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
                      <p>{asset.description ?? "Sem descrição disponível."}</p>
                      {asset.issuerInfo && <p>{asset.issuerInfo}</p>}
                      {asset.companyName && <p>Emissor: {asset.companyName}</p>}
                      <p>País: {asset.country === "MZ" ? "Moçambique" : asset.country}</p>
                      <p className="text-xs">
                        Instrumento de demonstração para paper trading. Não constitui oferta, nem
                        garante qualquer retorno; investir envolve risco de perda de capital.
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <TradePanel
                assetId={asset.id}
                symbol={asset.symbol}
                tickSize={asset.tickSize}
                lotSize={asset.lotSize}
                bestBid={asset.quote.bid}
                bestAsk={asset.quote.ask}
                lastPrice={asset.quote.lastPrice}
                marketStatus={asset.marketStatus}
                environment={asset.environment === "LIVE" ? "LIVE" : "PAPER"}
                onDone={() => query.refetch()}
              />
            </div>
          </>
        )}
      </main>
      <ExchangeNav />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function Row({ price: p, qty, tone }: { price: number; qty: number; tone: "buy" | "sell" }) {
  return (
    <div className="flex justify-between rounded px-2 py-1">
      <span className={tone === "buy" ? "text-emerald-400" : "text-destructive"}>{p.toFixed(2)}</span>
      <span className="text-muted-foreground">{qty}</span>
    </div>
  );
}
