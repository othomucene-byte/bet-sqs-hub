import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { LiveBadge } from "@/components/exchange/exchange-nav";
import { AssetLogo, Panel, TerminalShell } from "@/components/exchange/terminal";
import { Skeleton } from "@/components/ui/skeleton";
import { getExchangeAccount } from "@/lib/exchange/trading.functions";
import { getMarketOverview } from "@/lib/exchange/market.functions";
import { pct, price } from "@/lib/exchange/format";

export const Route = createFileRoute("/_authenticated/exchange/watchlist")({
  head: () => ({
    meta: [
      { title: "Favoritos | SQs Exchange" },
      {
        name: "description",
        content: "Instrumentos que segue no SQs Exchange, com preço e variação do mercado real.",
      },
      { property: "og:title", content: "Favoritos — SQs Exchange" },
      { property: "og:description", content: "A sua lista de instrumentos acompanhados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WatchlistPage,
});

function WatchlistPage() {
  const fetchAccount = useServerFn(getExchangeAccount);
  const fetchMarket = useServerFn(getMarketOverview);
  const account = useQuery({
    queryKey: ["exchange-account"],
    queryFn: () => fetchAccount({ data: { environment: "LIVE" as const } }),
  });
  const market = useQuery({ queryKey: ["exchange-market"], queryFn: () => fetchMarket() });

  const ids = new Set(account.data?.watchlist ?? []);
  const rows = (market.data?.assets ?? []).filter((a) => ids.has(a.id));

  return (
    <TerminalShell title="Favoritos" badges={<LiveBadge />} subtitle="Empresas acompanhadas, preço atual e acesso direto ao terminal.">

        {(account.isLoading || market.isLoading) && <Skeleton className="h-20 w-full" />}

        {!account.isLoading && rows.length === 0 && (
          <Panel>
            <div className="p-3 text-sm text-muted-foreground">
              Ainda não segue nenhum instrumento. Abra o{" "}
              <Link to="/exchange" className="text-primary">
                mercado
              </Link>{" "}
              e adicione aos favoritos.
            </div>
          </Panel>
        )}

        <Panel title="Lista acompanhada" padded={false}>
        <div className="divide-y divide-border/40">
          {rows.map((a) => (
            <Link
              key={a.id}
              to="/exchange/asset/$symbol"
              params={{ symbol: a.symbol }}
              className="flex items-center justify-between p-3 text-sm transition-colors hover:bg-secondary/40"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <AssetLogo symbol={a.symbol} name={a.name} logoUrl={a.logoUrl} size={32} />
                <div className="min-w-0">
                  <p className="font-semibold">{a.symbol}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium">{price(a.lastPrice)}</p>
                <p
                  className={
                    a.changePct == null
                      ? "text-xs text-muted-foreground"
                      : a.changePct >= 0
                        ? "text-xs text-emerald-400"
                        : "text-xs text-destructive"
                  }
                >
                  {pct(a.changePct)}
                </p>
              </div>
            </Link>
          ))}
        </div>
        </Panel>
    </TerminalShell>
  );
}
