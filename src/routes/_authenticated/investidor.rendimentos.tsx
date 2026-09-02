import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { SiteHeader } from "@/components/site-header";
import { InvestorNav } from "@/components/investor-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getInvestorOverview } from "@/lib/investments/portfolio.functions";

export const Route = createFileRoute("/_authenticated/investidor/rendimentos")({
  head: () => ({
    meta: [
      { title: "Rendimentos e resultados — BETFCOM SQs" },
      {
        name: "description",
        content:
          "Resultados declarados por período em cada investimento: rendimento ou prejuízo, sempre registados no servidor e no extrato imutável.",
      },
      { property: "og:title", content: "Rendimentos declarados — BETFCOM SQs" },
      {
        property: "og:description",
        content: "Nenhum retorno é garantido; os resultados podem ser negativos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReturnsPage,
});

const MZN = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "MZN" });

function ReturnsPage() {
  const fetchOverview = useServerFn(getInvestorOverview);
  const overview = useQuery({ queryKey: ["investor-overview"], queryFn: () => fetchOverview() });

  const rows = overview.data?.returns ?? [];

  const chart = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const row of rows) {
      const key = new Date(row.createdAt).toLocaleDateString("pt-PT", {
        month: "short",
        year: "2-digit",
      });
      const signed = row.kind === "PROFIT" ? row.amount : -row.amount;
      byMonth.set(key, (byMonth.get(key) ?? 0) + signed);
    }
    return Array.from(byMonth.entries())
      .reverse()
      .map(([label, resultado]) => ({ label, resultado }));
  }, [rows]);

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 pb-20">
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">Rendimentos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Resultados declarados pelo emitente e registados no servidor. Podem ser negativos.
        </p>
        <InvestorNav className="mt-5" />

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Resultado por mês</CardTitle>
            <CardDescription>Soma dos resultados declarados em cada mês.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {chart.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem resultados declarados.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={70} />
                  <Tooltip formatter={(v: number) => MZN.format(v)} />
                  <Bar dataKey="resultado" fill="hsl(var(--primary))" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Lançamentos</CardTitle>
            <CardDescription>
              &quot;Liquidado&quot; indica que o valor já entrou (ou saiu) da carteira.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nada a mostrar.</p>
            ) : (
              rows.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 p-3"
                >
                  <div>
                    <p className="text-sm font-semibold">{row.productName ?? "Produto"}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.periodStart && row.periodEnd
                        ? `${row.periodStart} → ${row.periodEnd}`
                        : new Date(row.createdAt).toLocaleDateString("pt-PT")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={
                        row.kind === "PROFIT"
                          ? "text-sm font-semibold tabular-nums text-primary"
                          : "text-sm font-semibold tabular-nums text-destructive"
                      }
                    >
                      {row.kind === "PROFIT" ? "+" : "−"}
                      {MZN.format(row.amount)}
                    </span>
                    <Badge variant="outline">{row.settled ? "Liquidado" : "Acumulado"}</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
