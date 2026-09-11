import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { LiveBadge } from "@/components/exchange/exchange-nav";
import { AssetLogo, Panel, StatTile, TerminalShell } from "@/components/exchange/terminal";
import { TradePanel } from "@/components/exchange/trade-panel";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { getAssetDetail } from "@/lib/exchange/market.functions";
import { getCompanyData } from "@/lib/exchange/company-data.functions";
import { ASSET_TYPE_LABEL, MARKET_STATUS_LABEL, pct, price, splitBook } from "@/lib/exchange/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/exchange/asset/$symbol")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.symbol} — SQs Exchange | Betfcom SQs` },
      {
        name: "description",
        content: `Preço, livro de ordens, negócios e informação da empresa ${params.symbol} no SQs Exchange, mercado moçambicano em meticais da Betfcom SQs.`,
      },
      { property: "og:title", content: `${params.symbol} — SQs Exchange` },
      {
        property: "og:description",
        content: `Comprar e vender ${params.symbol} no mercado da Betfcom SQs, em meticais.`,
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
  const up = (change ?? 0) >= 0;

  if (query.isLoading) {
    return (
      <TerminalShell title={symbol} badges={<LiveBadge />}>
        <Skeleton className="h-48 w-full" />
      </TerminalShell>
    );
  }

  if (!asset) {
    return (
      <TerminalShell title={symbol}>
        <Panel>
          <p className="text-sm text-muted-foreground">
            Empresa não encontrada.{" "}
            <Link to="/exchange" className="text-primary underline">
              Voltar ao mercado
            </Link>
          </p>
        </Panel>
      </TerminalShell>
    );
  }

  return (
    <TerminalShell
      wide
      title={asset.symbol}
      badges={
        <>
          <Badge variant="outline">{ASSET_TYPE_LABEL[asset.assetType] ?? asset.assetType}</Badge>
          <LiveBadge />
        </>
      }
      subtitle={`${asset.name} · Mercado ${MARKET_STATUS_LABEL[asset.marketStatus] ?? asset.marketStatus} · ${asset.country === "MZ" ? "Moçambique" : asset.country} · ${asset.currency}`}
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-3">
          <Panel>
            <div className="flex items-center gap-3">
              <AssetLogo symbol={asset.symbol} name={asset.name} size={48} />
              <div className="min-w-0">
                <p className="font-mono text-3xl font-bold tabular-nums">
                  {price(asset.quote.lastPrice)}
                </p>
                <p
                  className={cn(
                    "font-mono text-sm tabular-nums",
                    change == null ? "text-muted-foreground" : up ? "text-primary" : "text-destructive",
                  )}
                >
                  {pct(change)} · último negócio
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile label="Compra" value={price(asset.quote.bid)} tone="up" />
              <StatTile label="Venda" value={price(asset.quote.ask)} tone="down" />
              <StatTile label="Volume" value={String(asset.quote.volume)} />
              <StatTile label="Fecho ant." value={price(asset.quote.prevClose)} />
              <StatTile label="Máximo" value={price(asset.quote.dayHigh)} />
              <StatTile label="Mínimo" value={price(asset.quote.dayLow)} />
              <StatTile label="Lote mínimo" value={String(asset.lotSize)} />
              <StatTile label="Variação mín." value={`${asset.tickSize} MZN`} />
            </div>
            {asset.isReferenceOnly && (
              <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-400">
                Preço de referência ({asset.referenceSource ?? "definido pela administração"}). A
                partir do primeiro negócio, o preço passa a resultar apenas das compras e vendas.
              </p>
            )}
          </Panel>

          <Panel title="Evolução do preço">
            <div className="h-56">
              {asset.history.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={asset.history.map((h) => ({ ...h, label: timeFmt.format(new Date(h.t)) }))}
                  >
                    <CartesianGrid strokeOpacity={0.1} vertical={false} />
                    <XAxis dataKey="label" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      width={45}
                      domain={["auto", "auto"]}
                    />
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
                <p className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                  O gráfico começa a desenhar-se a partir do primeiro negócio nesta empresa.
                </p>
              )}
            </div>
          </Panel>

          <div className="grid gap-3 md:grid-cols-2">
            <Panel title="Livro de ordens" padded={false}>
              <div className="p-2 text-xs">
                {asks.length === 0 && bids.length === 0 && (
                  <p className="py-6 text-center text-muted-foreground">
                    Livro vazio — seja o primeiro a colocar uma ordem.
                  </p>
                )}
                {asks
                  .slice()
                  .reverse()
                  .map((l, i) => (
                    <BookRow key={`a${i}`} price={l.price} qty={l.quantity} tone="sell" />
                  ))}
                {(asks.length > 0 || bids.length > 0) && (
                  <div className="my-1 rounded-md bg-secondary/50 py-1 text-center font-mono text-xs font-semibold tabular-nums">
                    {price(asset.quote.lastPrice)}
                  </div>
                )}
                {bids.map((l, i) => (
                  <BookRow key={`b${i}`} price={l.price} qty={l.quantity} tone="buy" />
                ))}
              </div>
            </Panel>

            <Panel title="Negócios" padded={false}>
              <div className="p-2 text-xs">
                {asset.trades.length === 0 ? (
                  <p className="py-6 text-center text-muted-foreground">Sem negócios registados.</p>
                ) : (
                  asset.trades.map((t) => (
                    <div
                      key={t.id}
                      className="flex justify-between border-b border-border/40 px-1 py-1.5 font-mono tabular-nums last:border-0"
                    >
                      <span className="text-muted-foreground">
                        {timeFmt.format(new Date(t.executedAt))}
                      </span>
                      <span>{t.quantity}</span>
                      <span className="font-semibold">{t.price.toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </div>

          <Panel title="A empresa">
            {companyData.isLoading && <Skeleton className="h-20 w-full" />}
            {companyData.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Ainda não há dados validados desta empresa. A atualização automática corre de hora a
                hora e cada registo é publicado com fonte e data.
              </p>
            )}
            <div className="space-y-2">
              {(companyData.data ?? []).map((d) => (
                <article key={d.id} className="rounded-lg border border-border/60 bg-card/60 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {KIND_LABEL[d.kind] ?? d.kind}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(d.collectedAt).toLocaleDateString("pt-PT")}
                    </span>
                  </div>
                  <p className="pt-1 text-sm font-semibold">{d.title}</p>
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
                    Fonte:{" "}
                    {d.sourceUrl ? (
                      <a
                        href={d.sourceUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="underline"
                      >
                        {d.sourceName}
                      </a>
                    ) : (
                      d.sourceName
                    )}{" "}
                    · Confiança {(d.confidence * 100).toFixed(0)}%
                  </p>
                </article>
              ))}
            </div>
            {(asset.description || asset.issuerInfo) && (
              <p className="pt-2 text-xs text-muted-foreground">
                {asset.description} {asset.issuerInfo}
              </p>
            )}
            <p className="pt-2 text-[11px] text-muted-foreground">
              Informação recolhida por inteligência artificial e validada antes da publicação. Não é
              recomendação de investimento.
            </p>
          </Panel>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <TradePanel
            assetId={asset.id}
            symbol={asset.symbol}
            tickSize={asset.tickSize}
            lotSize={asset.lotSize}
            bestBid={asset.quote.bid}
            bestAsk={asset.quote.ask}
            lastPrice={asset.quote.lastPrice}
            marketStatus={asset.marketStatus}
            onDone={() => query.refetch()}
          />
          <Panel title="A sua conta">
            <div className="grid gap-2 text-xs">
              <Link to="/exchange/portfolio" className="text-primary underline">
                Ver carteira e posições
              </Link>
              <Link to="/exchange/orders" className="text-primary underline">
                Ordens abertas
              </Link>
              <Link to="/exchange/wallet" className="text-primary underline">
                Depositar ou levantar
              </Link>
              <Link to="/exchange" className="text-muted-foreground underline">
                ← Todas as empresas
              </Link>
            </div>
          </Panel>
        </aside>
      </div>
    </TerminalShell>
  );
}

function BookRow({ price: p, qty, tone }: { price: number; qty: number; tone: "buy" | "sell" }) {
  return (
    <div className="flex justify-between rounded px-2 py-1 font-mono tabular-nums">
      <span className={tone === "buy" ? "text-primary" : "text-destructive"}>{p.toFixed(2)}</span>
      <span className="text-muted-foreground">{qty}</span>
    </div>
  );
}
