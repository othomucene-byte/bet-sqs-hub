import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart3,
  Crosshair,
  LineChart as LineChartIcon,
  Maximize2,
  MousePointer2,
  Pencil,
  Ruler,
  Settings2,
  Type as TypeIcon,
} from "lucide-react";

import { LiveBadge } from "@/components/exchange/exchange-nav";
import {
  AssetLogo,
  BigChart,
  Chips,
  DepthRow,
  Panel,
  Spark,
  StatTile,
  TerminalShell,
} from "@/components/exchange/terminal";
import { CandleChart, buildCandles } from "@/components/exchange/candle-chart";
import { CompanyAiPanel } from "@/components/exchange/company-ai";
import { TradePanel } from "@/components/exchange/trade-panel";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { getAssetDetail, getMarketOverview } from "@/lib/exchange/market.functions";
import { getExchangeAccount } from "@/lib/exchange/trading.functions";
import { getCompanyData } from "@/lib/exchange/company-data.functions";
import { ASSET_TYPE_LABEL, MARKET_STATUS_LABEL, MZN, pct, price, splitBook } from "@/lib/exchange/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/exchange/asset/$symbol")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.symbol} — SQs Exchange | Betfcom SQs` },
      {
        name: "description",
        content: `Preço, gráfico de velas, livro de ordens, negócios e informação da empresa ${params.symbol} no SQs Exchange, mercado moçambicano em meticais da Betfcom SQs.`,
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
  profile: "Perfil",
  guidance: "Perspetivas",
  other: "Outro",
};

const timeFmt = new Intl.DateTimeFormat("pt-PT", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Maputo",
});

const RANGES = ["1D", "1S", "1M", "Tudo"] as const;
const RANGE_MS: Record<string, number | null> = {
  "1D": 24 * 3600 * 1000,
  "1S": 7 * 24 * 3600 * 1000,
  "1M": 30 * 24 * 3600 * 1000,
  Tudo: null,
};

/** Barra de ferramentas de análise, no estilo de terminal profissional. */
const TOOLS = [
  { icon: MousePointer2, label: "Selecionar" },
  { icon: Crosshair, label: "Cruz" },
  { icon: LineChartIcon, label: "Linha de tendência" },
  { icon: Pencil, label: "Desenho livre" },
  { icon: Ruler, label: "Medir" },
  { icon: TypeIcon, label: "Texto" },
  { icon: BarChart3, label: "Volume" },
  { icon: Settings2, label: "Definições" },
  { icon: Maximize2, label: "Ampliar" },
];

/** Média móvel simples sobre os preços efetivos. */
function sma(values: number[], window: number): number | null {
  if (values.length < window) return null;
  const slice = values.slice(-window);
  return Number((slice.reduce((s, v) => s + v, 0) / slice.length).toFixed(2));
}

function AssetPage() {
  const { symbol } = Route.useParams();
  const fetchAsset = useServerFn(getAssetDetail);
  const fetchMarket = useServerFn(getMarketOverview);
  const fetchAccount = useServerFn(getExchangeAccount);
  const queryClient = useQueryClient();
  const [range, setRange] = useState<(typeof RANGES)[number]>("Tudo");
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [symbol]);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
  }, []);

  const query = useQuery({
    queryKey: ["exchange-asset", symbol],
    queryFn: () => fetchAsset({ data: { symbol } }),
    refetchInterval: 15000,
  });
  const market = useQuery({
    queryKey: ["exchange-market"],
    queryFn: () => fetchMarket({ data: { environment: "LIVE" as const } }),
    staleTime: 20000,
  });
  const account = useQuery({
    queryKey: ["exchange-account"],
    queryFn: () => fetchAccount({ data: { environment: "LIVE" as const } }),
    enabled: signedIn === true,
    staleTime: 10000,
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
    queryFn: () => {
      if (!asset) throw new Error("Empresa indisponível");
      return fetchCompanyData({ data: { assetId: asset.id, includeHistory: false } });
    },
    enabled: Boolean(asset?.id),
    refetchInterval: 300000,
  });

  const { bids, asks } = splitBook(asset?.book ?? []);
  const change =
    asset?.quote.lastPrice != null && asset.quote.prevClose != null && asset.quote.prevClose > 0
      ? ((asset.quote.lastPrice - asset.quote.prevClose) / asset.quote.prevClose) * 100
      : null;
  const up = (change ?? 0) >= 0;

  const series = useMemo(() => {
    if (!asset) return [];
    const base = asset.history.length > 1 ? asset.history : asset.referenceHistory;
    const window = RANGE_MS[range];
    if (window == null) return base;
    const cut = Date.now() - window;
    const filtered = base.filter((p) => new Date(p.t).getTime() >= cut);
    return filtered.length > 1 ? filtered : base;
  }, [asset, range]);

  const candles = useMemo(() => buildCandles(series), [series]);
  const closes = candles.map((c) => c.close);
  const ma20 = sma(closes, 20);
  const ma50 = sma(closes, 50);

  if (query.isLoading) {
    return (
      <TerminalShell title={symbol} badges={<LiveBadge />}>
        <Skeleton className="h-96 w-full" />
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

  const maxDepth = Math.max(1, ...asset.book.map((l) => l.quantity));
  const watchlist = (market.data?.assets ?? []).filter((a) => a.symbol !== asset.symbol).slice(0, 5);
  const buyingPower = account.data?.available ?? null;

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
      <div className="flex flex-col gap-3 xl:grid xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        {/* Terminal central: cabeçalho do ativo, ferramentas e velas. */}
        <section className="order-1 min-w-0 space-y-3 xl:col-start-1 xl:row-start-1">
          <Panel padded={false}>
            <div className="flex items-center gap-3 border-b border-border/50 p-3">
              <AssetLogo symbol={asset.symbol} name={asset.name} size={40} />
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold leading-tight">{asset.symbol}</p>
                <p className="truncate text-[11px] text-muted-foreground">{asset.name}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-2xl font-bold tabular-nums sm:text-3xl">
                  {price(asset.quote.lastPrice)}
                </p>
                <span
                  className={cn(
                    "inline-block rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums",
                    change == null
                      ? "bg-secondary text-muted-foreground"
                      : up
                        ? "bg-primary/15 text-primary"
                        : "bg-destructive/15 text-destructive",
                  )}
                >
                  {pct(change)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 border-b border-border/50 px-2 py-1.5">
              <span className="pl-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Período
              </span>
              <div className="min-w-0 flex-1">
                <Chips options={RANGES} value={range} onChange={setRange} />
              </div>
            </div>

            <div className="flex">
              <div className="hidden w-11 shrink-0 flex-col items-center gap-1 border-r border-border/50 py-2 lg:flex">
                {TOOLS.map((tool) => (
                  <span
                    key={tool.label}
                    title={tool.label}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <tool.icon className="size-3.5" />
                  </span>
                ))}
              </div>
              <div className="min-w-0 flex-1 p-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 pb-1 font-mono text-[10px] tabular-nums text-muted-foreground">
                  <span className="text-foreground">
                    {asset.symbol} · {range}
                  </span>
                  <span>A {candles[0]?.open.toFixed(2) ?? "—"}</span>
                  <span>M {candles.length ? Math.max(...candles.map((c) => c.high)).toFixed(2) : "—"}</span>
                  <span>m {candles.length ? Math.min(...candles.map((c) => c.low)).toFixed(2) : "—"}</span>
                  <span className={up ? "text-primary" : "text-destructive"}>
                    F {candles[candles.length - 1]?.close.toFixed(2) ?? "—"}
                  </span>
                  {ma20 != null && <span className="text-sky-400">MM20 {ma20.toFixed(2)}</span>}
                  {ma50 != null && <span className="text-amber-400">MM50 {ma50.toFixed(2)}</span>}
                </div>
                <CandleChart candles={candles} height={320} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-border/50 p-3 sm:grid-cols-4">
              <StatTile
                label="Compra"
                value={asset.quote.bid != null ? price(asset.quote.bid) : "—"}
                tone="up"
              />
              <StatTile
                label="Venda"
                value={asset.quote.ask != null ? price(asset.quote.ask) : "—"}
                tone="down"
              />
              <StatTile label="Volume" value={String(asset.quote.volume)} />
              <StatTile label="Fecho ant." value={price(asset.quote.prevClose)} />
              <StatTile
                label="Máximo"
                value={asset.quote.dayHigh != null ? price(asset.quote.dayHigh) : "—"}
              />
              <StatTile
                label="Mínimo"
                value={asset.quote.dayLow != null ? price(asset.quote.dayLow) : "—"}
              />
              <StatTile label="Lote mínimo" value={String(asset.lotSize)} />
              <StatTile label="Variação mín." value={`${asset.tickSize} MZN`} />
            </div>

            {asset.isReferenceOnly && (
              <p className="border-t border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-400">
                Preço de referência ({asset.referenceSource ?? "definido pela administração"}). A
                partir do primeiro negócio, o preço passa a resultar apenas das compras e vendas.
              </p>
            )}
          </Panel>

          <Panel title="Indicadores">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile label="MM 20" value={ma20 != null ? `${ma20.toFixed(2)} MZN` : "—"} />
              <StatTile label="MM 50" value={ma50 != null ? `${ma50.toFixed(2)} MZN` : "—"} />
              <StatTile
                label="Amplitude"
                value={
                  candles.length
                    ? `${(Math.max(...candles.map((c) => c.high)) - Math.min(...candles.map((c) => c.low))).toFixed(2)} MZN`
                    : "—"
                }
              />
              <StatTile
                label="Velas"
                value={String(candles.length)}
              />
            </div>
            <div className="pt-2">
              {series.length > 1 ? (
                <BigChart
                  values={series.map((h, index) => ({
                    label:
                      new Date(h.t).getTime() === 0
                        ? "Referência"
                        : index === series.length - 1
                          ? "Agora"
                          : timeFmt.format(new Date(h.t)),
                    price: h.price,
                  }))}
                  up={up}
                  height={150}
                />
              ) : (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Os indicadores ficam completos à medida que existem mais preços registados.
                </p>
              )}
            </div>
          </Panel>
        </section>

        <aside className="order-2 space-y-3 xl:sticky xl:top-4 xl:col-start-2 xl:row-start-1 xl:row-span-2">
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

          <Panel title="Livro de ordens" padded={false}>
            <div className="grid grid-cols-4 gap-1 border-b border-border/50 px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>Qtd</span>
              <span>Compra</span>
              <span>Venda</span>
              <span className="text-right">Qtd</span>
            </div>
            <div className="p-2">
              {asks.length === 0 && bids.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Livro vazio — seja o primeiro a colocar uma ordem.
                </p>
              )}
              {asks
                .slice()
                .reverse()
                .map((l, i) => (
                  <DepthRow key={`a${i}`} price={l.price} qty={l.quantity} max={maxDepth} tone="sell" />
                ))}
              {(asks.length > 0 || bids.length > 0) && (
                <div className="my-1 rounded-md bg-secondary/50 py-1 text-center font-mono text-xs font-semibold tabular-nums">
                  {price(asset.quote.lastPrice)}
                </div>
              )}
              {bids.map((l, i) => (
                <DepthRow key={`b${i}`} price={l.price} qty={l.quantity} max={maxDepth} tone="buy" />
              ))}
            </div>
          </Panel>

          <Panel title="Favoritos" padded={false}>
            <div className="divide-y divide-border/40">
              {watchlist.length === 0 && (
                <p className="p-3 text-xs text-muted-foreground">Sem outras empresas listadas.</p>
              )}
              {watchlist.map((a) => (
                <Link
                  key={a.id}
                  to="/exchange/asset/$symbol"
                  params={{ symbol: a.symbol }}
                  className="flex items-center gap-2 px-2.5 py-2 transition-colors hover:bg-secondary/40"
                >
                  <AssetLogo symbol={a.symbol} name={a.name} logoUrl={a.logoUrl} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold">{a.symbol}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{a.name}</p>
                  </div>
                  <div className="h-6 w-12 shrink-0">
                    {a.spark.length > 1 && <Spark values={a.spark} up={(a.changePct ?? 0) >= 0} />}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-xs font-semibold tabular-nums">{price(a.lastPrice)}</p>
                    <p
                      className={cn(
                        "font-mono text-[10px] tabular-nums",
                        a.changePct == null
                          ? "text-muted-foreground"
                          : (a.changePct ?? 0) >= 0
                            ? "text-primary"
                            : "text-destructive",
                      )}
                    >
                      {pct(a.changePct)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel title="Resumo da conta">
            {signedIn === false ? (
              <p className="text-xs text-muted-foreground">
                <Link to="/auth" className="text-primary underline">
                  Entre na sua conta
                </Link>{" "}
                para ver o seu poder de compra.
              </p>
            ) : account.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Poder de compra
                </p>
                <p className="font-mono text-2xl font-bold tabular-nums">
                  {buyingPower != null ? MZN.format(buyingPower) : "—"}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Investido</p>
                    <p className="font-mono font-semibold tabular-nums">
                      {MZN.format(account.data?.portfolioValue ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-mono font-semibold tabular-nums">
                      {MZN.format(account.data?.totalValue ?? 0)}
                    </p>
                  </div>
                </div>
                <div className="grid gap-1 pt-2 text-xs">
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
              </div>
            )}
          </Panel>
        </aside>

        <div className="order-3 min-w-0 space-y-3 xl:col-start-1 xl:row-start-2">
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

          <Panel title="A empresa">
            {companyData.isLoading && <Skeleton className="h-20 w-full" />}
            {companyData.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Ainda não há dados validados desta empresa. A pesquisa automática corre no intervalo
                definido pela administração e cada registo é publicado com fonte, data e ligação.
              </p>
            )}
            <div className="space-y-2">
              {(companyData.data ?? []).map((d) => (
                <article key={d.id} className="rounded-lg border border-border/60 bg-card/60 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {KIND_LABEL[d.kind.toLowerCase()] ?? d.kind.replace(/_/g, " ")}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(d.collectedAt).toLocaleDateString("pt-PT")}
                    </span>
                  </div>
                  <p className="pt-1 text-sm font-semibold">{d.title}</p>
                  {d.summary && <p className="text-xs text-muted-foreground">{d.summary}</p>}
                  {d.changeSummary && (
                    <p className="pt-0.5 text-[11px] text-primary/80">{d.changeSummary}</p>
                  )}
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
            {(asset.issuerInfo || (asset.environment !== "LIVE" && asset.description)) && (
              <p className="pt-2 text-xs text-muted-foreground">
                {asset.environment !== "LIVE" ? asset.description : ""} {asset.issuerInfo}
              </p>
            )}
            <p className="pt-2 text-[11px] text-muted-foreground">
              Informação recolhida por inteligência artificial e validada antes da publicação. Não é
              recomendação de investimento.
            </p>
          </Panel>

          <CompanyAiPanel assetId={asset.id} />
        </div>
      </div>
    </TerminalShell>
  );
}
