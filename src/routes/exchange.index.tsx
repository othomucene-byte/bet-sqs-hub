import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, Building2, Clock3, Search, ShieldCheck } from "lucide-react";

import { LiveBadge } from "@/components/exchange/exchange-nav";
import {
  AssetLogo,
  BigChart,
  Chips,
  Panel,
  Spark,
  StatTile,
  TerminalShell,
} from "@/components/exchange/terminal";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getMarketOverview } from "@/lib/exchange/market.functions";
import { ASSET_TYPE_LABEL, MARKET_STATUS_LABEL, pct, price } from "@/lib/exchange/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/exchange/")({
  head: () => ({
    meta: [
      { title: "SQs Exchange — Mercado Moçambicano | Betfcom SQs" },
      {
        name: "description",
        content:
          "SQs Exchange: mercado moçambicano em meticais, com livro de ordens, carteira e ordens validadas no servidor, na plataforma Betfcom SQs.",
      },
      { property: "og:title", content: "SQs Exchange — Mercado Moçambicano" },
      {
        property: "og:description",
        content: "Livro de ordens, carteira e ordens em meticais na Betfcom SQs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExchangeMarket,
});

const CATEGORIES = ["Todos", "EQUITY", "BOND", "COMMERCIAL_PAPER", "FUND", "OTHER"] as const;
const CATEGORY_LABELS: Record<string, string> = { Todos: "Todos", ...ASSET_TYPE_LABEL };

function ExchangeMarket() {
  const fetchMarket = useServerFn(getMarketOverview);
  const query = useQuery({
    queryKey: ["exchange-market"],
    queryFn: () => fetchMarket({ data: { environment: "LIVE" as const } }),
    refetchInterval: 20000,
  });
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("Todos");

  const rows = query.data?.assets ?? [];
  const assets = useMemo(() => {
    const t = term.trim().toUpperCase();
    return rows.filter(
      (a) =>
        (category === "Todos" || a.assetType === category) &&
        (t === "" || a.symbol.includes(t) || a.name.toUpperCase().includes(t)),
    );
  }, [rows, term, category]);

  const traded = rows.filter((a) => !a.isReferenceOnly && a.lastPrice != null);
  const totalVolume = rows.reduce((s, a) => s + a.volume, 0);
  const featured = rows[0] ?? null;
  const featuredSeries = useMemo(() => {
    if (!featured) return [];
    if (featured.spark.length > 1) {
      return featured.spark.map((value, index) => ({ label: String(index + 1), price: value }));
    }
    if (featured.referenceHistory.length > 1) {
      return featured.referenceHistory.map((point) => ({
        label: new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short", timeZone: "Africa/Maputo" }).format(new Date(point.t)),
        price: point.price,
      }));
    }
    const baseline = featured.referencePrice ?? featured.lastPrice;
    return baseline == null
      ? []
      : [
          { label: "Referência", price: baseline },
          { label: "Agora", price: baseline },
        ];
  }, [featured]);

  const lastUpdate = query.dataUpdatedAt
    ? new Intl.DateTimeFormat("pt-PT", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Maputo",
      }).format(new Date(query.dataUpdatedAt))
    : "—";

  return (
    <TerminalShell
      wide
      title="SQs Exchange"
      badges={
        <>
           <span className="text-xs text-muted-foreground">Moçambique · MZN</span>
          <LiveBadge />
        </>
      }
      subtitle={
        query.data
          ? `${query.data.marketName} · ${MARKET_STATUS_LABEL[query.data.marketStatus]} · ${query.data.opensAt}–${query.data.closesAt} (Maputo) · atualizado às ${lastUpdate}`
          : "A carregar estado do mercado…"
      }
    >
       <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-3">
           {query.isLoading && <Skeleton className="h-[390px] w-full rounded-xl" />}
           {featured && (
             <Panel className="min-h-[390px]" padded={false}>
               <div className="border-b border-border/50 p-4 sm:p-5">
                 <div className="flex items-start gap-3">
                   <AssetLogo symbol={featured.symbol} name={featured.name} logoUrl={featured.logoUrl} size={52} />
                   <div className="min-w-0 flex-1">
                     <div className="flex flex-wrap items-center gap-2">
                       <h2 className="text-xl font-bold sm:text-2xl">{featured.name}</h2>
                       <Badge variant="outline">{featured.symbol}</Badge>
                       <Badge variant="outline" className="border-primary/30 text-primary">
                         {featured.isReferenceOnly ? "Preço de referência" : "Mercado"}
                       </Badge>
                     </div>
                     <p className="mt-1 text-xs text-muted-foreground">Empresa em destaque · {ASSET_TYPE_LABEL[featured.assetType] ?? featured.assetType}</p>
                   </div>
                   <Button asChild size="sm" className="hidden sm:inline-flex">
                     <Link to="/exchange/asset/$symbol" params={{ symbol: featured.symbol }}>
                       Investir <ArrowUpRight className="size-4" />
                     </Link>
                   </Button>
                 </div>

                 <div className="mt-5 flex flex-wrap items-end gap-3">
                   <p className="font-mono text-3xl font-bold tabular-nums sm:text-4xl">{price(featured.lastPrice)}</p>
                   <span className={cn("mb-1 rounded-md px-2 py-1 font-mono text-xs font-semibold", featured.changePct == null ? "bg-secondary text-muted-foreground" : (featured.changePct ?? 0) >= 0 ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive")}>{pct(featured.changePct)}</span>
                 </div>
                 <p className="mt-1 text-[11px] text-muted-foreground">{featured.referenceSource ?? "Dados verificados pela administração"}</p>
               </div>

               <div className="px-2 pt-3 sm:px-4">
                 <BigChart values={featuredSeries} up={(featured.changePct ?? 0) >= 0} height={190} />
               </div>
               <div className="grid grid-cols-3 border-t border-border/50">
                 <div className="p-3"><p className="text-[10px] uppercase text-muted-foreground">Compra</p><p className="font-mono text-sm font-semibold">{price(featured.bid)}</p></div>
                 <div className="border-x border-border/50 p-3"><p className="text-[10px] uppercase text-muted-foreground">Venda</p><p className="font-mono text-sm font-semibold">{price(featured.ask)}</p></div>
                 <div className="p-3"><p className="text-[10px] uppercase text-muted-foreground">Volume</p><p className="font-mono text-sm font-semibold">{featured.volume}</p></div>
               </div>
               <div className="p-3 pt-0 sm:hidden">
                 <Button asChild className="w-full">
                   <Link to="/exchange/asset/$symbol" params={{ symbol: featured.symbol }}>Abrir e investir</Link>
                 </Button>
               </div>
             </Panel>
           )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Empresas" value={String(rows.length)} />
              <StatTile label="Mercado" value={query.data ? (MARKET_STATUS_LABEL[query.data.marketStatus] ?? query.data.marketStatus) : "—"} tone="up" />
             <StatTile label="Negociadas" value={String(traded.length)} />
             <StatTile label="Volume" value={String(totalVolume)} />
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Pesquisar empresa ou código..."
              className="h-11 rounded-xl pl-9"
            />
          </div>

          <Chips
            options={CATEGORIES}
            value={category}
            onChange={setCategory}
            labels={CATEGORY_LABELS}
          />

            <Panel title="Todas as empresas" right={<span className="text-[11px] text-primary">Preço por unidade</span>} padded={false}>
            {query.isLoading && (
              <div className="space-y-2 p-3">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            )}

            {query.isError && (
              <p className="p-6 text-sm text-destructive">
                Não foi possível carregar o mercado. Tente novamente.
              </p>
            )}

            {query.data && assets.length === 0 && (
              <p className="p-6 text-sm text-muted-foreground">
                {rows.length === 0
                  ? "Ainda não há empresas listadas. As empresas aprovadas pela administração aparecem aqui."
                  : "Nenhuma empresa corresponde à pesquisa."}
              </p>
            )}

            <div className="divide-y divide-border/40">
              {assets.map((a) => {
                const up = (a.changePct ?? 0) >= 0;
                return (
                  <Link
                    key={a.id}
                    to="/exchange/asset/$symbol"
                    params={{ symbol: a.symbol }}
                    className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-secondary/40"
                  >
                    <AssetLogo symbol={a.symbol} name={a.name} logoUrl={a.logoUrl} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold">{a.symbol}</span>
                        {a.status !== "ACTIVE" && (
                          <Badge variant="destructive" className="text-[10px]">
                            Suspenso
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{a.name}</p>
                       <p className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                         <Clock3 className="size-3" />
                         {a.latestCompanyUpdate ? a.latestCompanyUpdate.title : a.isReferenceOnly ? "Preço de referência verificado" : `Volume ${a.volume}`}
                       </p>
                    </div>

                    <div className="hidden h-8 w-16 sm:block">
                      {a.spark.length > 1 && <Spark values={a.spark} up={up} />}
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="font-mono text-sm font-semibold tabular-nums">
                        {price(a.lastPrice)}
                      </p>
                      <span
                        className={cn(
                          "mt-0.5 inline-block rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums",
                          a.changePct == null
                            ? "bg-secondary text-muted-foreground"
                            : up
                              ? "bg-primary/15 text-primary"
                              : "bg-destructive/15 text-destructive",
                        )}
                      >
                        {pct(a.changePct)}
                      </span>
                    </div>
                     <ArrowUpRight className="size-4 shrink-0 text-primary" />
                  </Link>
                );
              })}
            </div>
          </Panel>
        </div>

         <aside className="space-y-3 xl:sticky xl:top-3 xl:self-start">
           <Panel title="Outras empresas" right={<Building2 className="size-4 text-muted-foreground" />} padded={false}>
             <div className="divide-y divide-border/40">
               {rows.slice(1, 7).map((a) => (
                 <Link key={a.id} to="/exchange/asset/$symbol" params={{ symbol: a.symbol }} className="flex items-center gap-2.5 px-3 py-3 transition-colors hover:bg-secondary/40">
                   <AssetLogo symbol={a.symbol} name={a.name} logoUrl={a.logoUrl} size={34} />
                   <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{a.name}</p><p className="text-[10px] text-muted-foreground">{a.symbol} · {a.isReferenceOnly ? "Referência" : "Mercado"}</p></div>
                   <div className="text-right"><p className="font-mono text-xs font-semibold">{price(a.lastPrice)}</p><p className="text-[10px] text-muted-foreground">{pct(a.changePct)}</p></div>
                   <ArrowUpRight className="size-3.5 text-primary" />
                 </Link>
               ))}
             </div>
           </Panel>

           <Panel title="Atualizações da pesquisa automática">
             <div className="space-y-3">
               {rows.filter((a) => a.latestCompanyUpdate).slice(0, 6).map((a) => (
                 <Link key={a.id} to="/exchange/asset/$symbol" params={{ symbol: a.symbol }} className="block border-b border-border/40 pb-2 last:border-0 last:pb-0">
                   <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">{a.symbol}</span><span className="text-[10px] text-muted-foreground">{a.latestCompanyUpdate ? new Date(a.latestCompanyUpdate.collectedAt).toLocaleDateString("pt-PT") : ""}</span></div>
                   <p className="line-clamp-2 pt-0.5 text-xs text-muted-foreground">{a.latestCompanyUpdate?.title}</p>
                   <p className="pt-0.5 text-[10px] text-primary/80">Fonte: {a.latestCompanyUpdate?.sourceName}</p>
                 </Link>
               ))}
             </div>
           </Panel>

           <Panel title="Mercado verificado">
             <div className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" /><p className="text-xs leading-relaxed text-muted-foreground">Preços de referência e dados empresariais são identificados pela fonte. Ordens, saldos e negócios permanecem dados reais da conta.</p></div>
           </Panel>
        </aside>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Mercado próprio da Betfcom SQs em meticais. Os preços resultam de negócios entre
        participantes deste mercado; não são cotações de terceiros. Investir exige identidade
        verificada e envolve risco de perda de capital; nenhum retorno é garantido.
      </p>
    </TerminalShell>
  );
}
