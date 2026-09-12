import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, ChevronRight, Clock3, Search } from "lucide-react";

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
import { Skeleton } from "@/components/ui/skeleton";
import { getMarketOverview } from "@/lib/exchange/market.functions";
import { ASSET_TYPE_LABEL, MARKET_STATUS_LABEL, MZN, pct, price } from "@/lib/exchange/format";
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
  const gainers = traded.filter((a) => (a.changePct ?? 0) > 0).length;
  const losers = traded.filter((a) => (a.changePct ?? 0) < 0).length;
  const totalVolume = rows.reduce((s, a) => s + a.volume, 0);
  const referenceTotal = rows.reduce((s, a) => s + (a.lastPrice ?? 0), 0);
  const avgChange =
    traded.length > 0 ? traded.reduce((s, a) => s + (a.changePct ?? 0), 0) / traded.length : null;

  /** Série agregada do mercado: soma dos preços recentes das empresas com negócios. */
  const indexSeries = useMemo(() => {
    const series = rows.map((a) => a.spark).filter((s) => s.length > 1);
    if (series.length === 0) {
      const history = rows
        .flatMap((a) => a.referenceHistory.map((point) => ({ ...point, assetId: a.id })))
        .sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime());
      const base = rows.reduce((sum, a) => sum + (a.referencePrice ?? 0), 0);
      if (history.length === 0) return base > 0 ? [{ label: "Referência", price: base }, { label: "Agora", price: base }] : [];
      return [{ label: "Referência", price: base }, { label: "Agora", price: base }];
    }
    const steps = Math.min(...series.map((s) => s.length));
    return Array.from({ length: steps }, (_, i) => ({
      label: `${i + 1}`,
      price: Number(
        series.reduce((s, arr) => s + (arr[arr.length - steps + i] ?? 0), 0).toFixed(2),
      ),
    }));
  }, [rows]);

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
       <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3">
          {/* Cartão principal com o valor do mercado e a evolução recente. */}
          <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 p-4">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.14]"
              style={{ backgroundImage: "var(--gradient-primary)" }}
            />
            <div className="relative">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                 Painel do mercado
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <p className="font-mono text-3xl font-bold tabular-nums sm:text-4xl">
                   {MZN.format(referenceTotal)}
                </p>
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 font-mono text-xs font-semibold tabular-nums",
                    (avgChange ?? 0) >= 0
                      ? "bg-primary/15 text-primary"
                      : "bg-destructive/15 text-destructive",
                  )}
                >
                  {pct(avgChange)}
                </span>
              </div>
              <p className="pt-0.5 text-[11px] text-muted-foreground">
                 Soma dos preços por unidade · {rows.length} empresas listadas
              </p>
               {indexSeries.length > 1 && (
                <div className="pt-2">
                  <BigChart values={indexSeries} up={(avgChange ?? 0) >= 0} height={150} />
                </div>
              )}
               <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                 <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-primary">Referência</span>
                 A linha-base muda para Mercado quando houver negócios executados.
               </div>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Empresas" value={String(rows.length)} />
             <StatTile label="Negociadas" value={String(traded.length)} tone="up" />
             <StatTile label="Com referência" value={String(rows.filter((a) => a.isReferenceOnly).length)} />
            <StatTile label="Volume do dia" value={String(totalVolume)} />
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

           <Panel title="Mercado ao vivo" right={<span className="text-[11px] text-primary">Abrir terminal</span>} padded={false}>
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

        <aside className="space-y-3">
           <Panel title="Atualizações das empresas">
             <div className="space-y-3">
               {rows.filter((a) => a.latestCompanyUpdate).slice(0, 6).map((a) => (
                 <Link key={a.id} to="/exchange/asset/$symbol" params={{ symbol: a.symbol }} className="block border-b border-border/40 pb-2 last:border-0 last:pb-0">
                   <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">{a.symbol}</span><span className="text-[10px] text-muted-foreground">{a.latestCompanyUpdate?.sourceName}</span></div>
                   <p className="line-clamp-2 pt-0.5 text-xs text-muted-foreground">{a.latestCompanyUpdate?.title}</p>
                 </Link>
               ))}
             </div>
           </Panel>

           <Panel title="Atividade do mercado">
            {traded.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                 Mercado aberto. O livro aceita ordens reais; a fita permanece a zero até compradores e vendedores cruzarem preço.
              </p>
            ) : (
              <div className="space-y-1.5">
                {traded
                  .slice()
                  .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))
                  .slice(0, 5)
                  .map((a) => (
                    <Link
                      key={a.id}
                      to="/exchange/asset/$symbol"
                      params={{ symbol: a.symbol }}
                      className="flex items-center justify-between gap-2 rounded-md px-1 py-1 hover:bg-secondary/40"
                    >
                      <span className="text-xs font-semibold">{a.symbol}</span>
                      <div className="h-6 w-14">
                        {a.spark.length > 1 && (
                          <Spark values={a.spark} up={(a.changePct ?? 0) >= 0} />
                        )}
                      </div>
                      <span
                        className={cn(
                          "font-mono text-xs tabular-nums",
                          (a.changePct ?? 0) >= 0 ? "text-primary" : "text-destructive",
                        )}
                      >
                        {pct(a.changePct)}
                      </span>
                    </Link>
                  ))}
              </div>
            )}
          </Panel>

          <Panel title="Preços de referência">
            <p className="text-xs leading-relaxed text-muted-foreground">
               Enquanto uma empresa não tiver negócios, mostramos o preço de referência auditável definido pela
               administração ({rows.filter((a) => a.isReferenceOnly).length} empresas neste momento).
              Não é cotação de terceiros. A partir do primeiro negócio, o preço passa a resultar
              apenas das compras e vendas entre participantes.
            </p>
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
