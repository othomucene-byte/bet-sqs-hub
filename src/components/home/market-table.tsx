import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Sparkline } from "@/components/home/sparkline";
import { ASSET_TYPE_LABEL, pct } from "@/lib/exchange/format";
import type { MarketAssetRow } from "@/lib/exchange/market.functions";

const QTY = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 });

/** Tabela de mercado de alta densidade. Mostra só valores vindos do servidor. */
export function MarketTable({ assets, loading }: { assets: MarketAssetRow[]; loading: boolean }) {
  const types = useMemo(() => {
    const set = new Set(assets.map((a) => a.assetType));
    return Array.from(set);
  }, [assets]);
  const [tab, setTab] = useState<string>("ALL");
  const rows = tab === "ALL" ? assets : assets.filter((a) => a.assetType === tab);

  return (
    <div className="card-elevated overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
        <button
          type="button"
          onClick={() => setTab("ALL")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            tab === "ALL" ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-secondary"
          }`}
        >
          Todos
        </button>
        {types.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === t ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {ASSET_TYPE_LABEL[t] ?? t}
          </button>
        ))}
        <a
          href="/exchange"
          className="ml-auto flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Abrir terminal <ArrowUpRight className="size-3.5" />
        </a>
      </div>

      {loading ? (
        <p className="px-4 py-8 text-sm text-muted-foreground">A carregar mercado…</p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-8 text-sm text-muted-foreground">
          Ainda não há ativos publicados neste mercado.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Ativo</th>
                <th className="px-4 py-2 text-right font-medium">Último (MZN)</th>
                <th className="px-4 py-2 text-right font-medium">Var.</th>
                <th className="px-4 py-2 text-right font-medium">Compra / Venda</th>
                <th className="px-4 py-2 text-right font-medium">Volume</th>
                <th className="px-4 py-2 text-right font-medium">Tendência</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 12).map((a) => {
                const value = a.lastPrice ?? a.referencePrice;
                const up = (a.changePct ?? 0) >= 0;
                return (
                  <tr
                    key={a.id}
                    className="border-b border-border/40 transition-colors last:border-0 hover:bg-secondary/40"
                  >
                    <td className="px-4 py-3">
                      <a href={`/exchange/asset/${a.symbol}`} className="flex items-center gap-3">
                        {a.logoUrl ? (
                          <img
                            src={a.logoUrl}
                            alt=""
                            loading="lazy"
                            className="size-8 rounded-lg object-contain"
                          />
                        ) : (
                          <span className="bg-brand-gradient flex size-8 items-center justify-center rounded-lg font-display text-[11px] font-bold text-primary-foreground">
                            {a.symbol.slice(0, 2)}
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block font-display text-sm font-bold">{a.symbol}</span>
                          <span className="block max-w-[180px] truncate text-xs text-muted-foreground">
                            {a.name}
                          </span>
                        </span>
                      </a>
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-display font-bold tabular-nums ${
                        a.changePct == null ? "" : up ? "text-primary" : "text-destructive"
                      }`}
                    >
                      {value != null ? value.toFixed(2) : "—"}
                      {a.isReferenceOnly && (
                        <Badge variant="outline" className="ml-2 text-[9px] uppercase">
                          ref.
                        </Badge>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold tabular-nums ${
                        a.changePct == null
                          ? "text-muted-foreground"
                          : up
                            ? "text-primary"
                            : "text-destructive"
                      }`}
                    >
                      {a.changePct != null && (up ? "▲ " : "▼ ")}
                      {pct(a.changePct)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {a.bid != null ? a.bid.toFixed(2) : "—"} / {a.ask != null ? a.ask.toFixed(2) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {QTY.format(a.volume)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Sparkline
                          points={a.spark.length > 1 ? a.spark : a.referenceHistory.map((h) => h.price)}
                          positive={up}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
