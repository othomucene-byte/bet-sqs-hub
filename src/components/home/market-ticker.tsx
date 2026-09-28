import { TrendingDown, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getFxRates } from "@/lib/exchange/fx.functions";

import type { MarketAssetRow } from "@/lib/exchange/market.functions";
import { pct } from "@/lib/exchange/format";

/**
 * Fita de cotações do topo. Mostra apenas ativos reais do mercado SQSX.
 * Sem negócios ou sem ativos, diz-se claramente que não há cotação.
 */
export function MarketTicker({
  assets,
  loading,
  marketStatusLabel,
}: {
  assets: MarketAssetRow[];
  loading: boolean;
  marketStatusLabel: string;
}) {
  const fetchFx = useServerFn(getFxRates);
  const fx = useQuery({ queryKey: ["fx-rates"], queryFn: () => fetchFx(), staleTime: 30 * 60_000 });
  const fxItems = (fx.data?.quotes ?? []).map((q) => (
    <span key={q.pair} className="flex shrink-0 items-center gap-2 text-xs">
      <span className="font-display font-bold tracking-tight">{q.pair}</span>
      <span className="tabular-nums text-muted-foreground">{q.rate.toFixed(2)}</span>
    </span>
  ));
  const rows = assets
    .filter((a) => a.lastPrice != null || a.referencePrice != null)
    .slice(0, 14);

  return (
    <div className="border-b border-border/60 bg-card/60">
      <div className="flex items-stretch">
        <div className="flex shrink-0 items-center gap-2 border-r border-border/60 px-3 py-2 sm:px-4">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/70" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          <span className="whitespace-nowrap font-display text-[11px] font-bold uppercase tracking-wider">
            {marketStatusLabel}
          </span>
        </div>

        <div className="min-w-0 flex-1 overflow-hidden py-2">
          {loading && fxItems.length === 0 ? (
            <p className="px-3 text-xs text-muted-foreground">A carregar cotações…</p>
          ) : rows.length === 0 && fxItems.length === 0 ? (
            <p className="px-3 text-xs text-muted-foreground">
              Sem cotações disponíveis neste momento.
            </p>
          ) : (
            <div className="flex w-max animate-ticker gap-6 pl-3">
              {fxItems}
              {[...rows, ...rows].map((a, i) => {
                const value = a.lastPrice ?? a.referencePrice;
                const up = (a.changePct ?? 0) >= 0;
                return (
                  <a
                    key={`${a.symbol}-${i}`}
                    href={`/exchange/asset/${a.symbol}`}
                    className="flex shrink-0 items-center gap-2 text-xs"
                  >
                    <span className="font-display font-bold tracking-tight">{a.symbol}</span>
                    <span
                      className={`font-semibold tabular-nums ${
                        a.changePct == null ? "text-foreground" : up ? "text-primary" : "text-destructive"
                      }`}
                    >
                      {value != null ? value.toFixed(2) : "—"}
                    </span>
                    <span
                      className={`flex items-center gap-0.5 tabular-nums ${
                        a.changePct == null
                          ? "text-muted-foreground"
                          : up
                            ? "text-primary"
                            : "text-destructive"
                      }`}
                    >
                      {a.changePct != null &&
                        (up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />)}
                      {pct(a.changePct)}
                    </span>
                    {a.isReferenceOnly && (
                      <span className="rounded bg-secondary px-1 text-[9px] uppercase text-muted-foreground">
                        ref.
                      </span>
                    )}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
