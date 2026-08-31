import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, Building2, ShieldAlert, TrendingUp } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { listProducts, type Product } from "@/lib/investments/investments.functions";

export const Route = createFileRoute("/investimentos")({
  loader: () => listProducts(),
  errorComponent: () => (
    <main className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">Não foi possível carregar os produtos</h1>
      <p className="mt-2 text-muted-foreground">Tente novamente dentro de alguns instantes.</p>
    </main>
  ),
  notFoundComponent: () => <p className="p-8">Página não encontrada.</p>,
  head: () => ({
    meta: [
      { title: "SQs Investimentos — produtos ligados a empresas moçambicanas" },
      {
        name: "description",
        content:
          "Produtos de investimento em meticais ligados a empresas moçambicanas: prazo, taxa alvo indicativa, nível de risco e capacidade — tudo validado no servidor.",
      },
      { property: "og:title", content: "SQs Investimentos — BETFCOM SQs" },
      {
        property: "og:description",
        content:
          "Prazos, taxas alvo indicativas e níveis de risco por produto. Investir envolve risco de perda de capital.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvestimentosPage,
});

const MZN = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "MZN", maximumFractionDigits: 0 });
const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

const riskLabel: Record<string, string> = { low: "Risco baixo", medium: "Risco médio", high: "Risco alto" };
const riskTone: Record<string, string> = {
  low: "bg-primary/15 text-primary",
  medium: "bg-amber-500/15 text-amber-500",
  high: "bg-destructive/15 text-destructive",
};

const SECTOR_COLORS = ["#10b981", "#38bdf8", "#f59e0b", "#a78bfa", "#f472b6", "#22d3ee", "#facc15"];

function InvestimentosPage() {
  const products = Route.useLoaderData();

  const rateSeries = useMemo(
    () =>
      [...products]
        .sort((a, b) => b.targetRateAnnual - a.targetRateAnnual)
        .map((p) => ({ name: p.company?.name ?? p.name, taxa: Number((p.targetRateAnnual * 100).toFixed(2)) })),
    [products],
  );

  const sectorSeries = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      const sector = p.company?.sector ?? "Outros";
      map.set(sector, (map.get(sector) ?? 0) + p.capacity);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [products]);

  const totalCapacity = products.reduce((s, p) => s + p.capacity, 0);
  const totalRaised = products.reduce((s, p) => s + p.raised, 0);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main>
        <section className="mx-auto w-full max-w-6xl px-4 pt-12 pb-6 sm:pt-16">
          <Badge variant="secondary" className="mb-4">
            SQs Investimentos
          </Badge>
          <h1 className="max-w-3xl font-display text-3xl font-bold sm:text-5xl">
            Produtos de investimento ligados a empresas moçambicanas
          </h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Cada produto mostra prazo, taxa alvo indicativa, nível de risco e capacidade disponível.
            As taxas são alvos indicativos, não retornos garantidos — investir envolve risco de perda
            de capital.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Card className="card-elevated">
              <CardHeader className="pb-2">
                <CardDescription>Produtos disponíveis</CardDescription>
                <CardTitle className="text-3xl">{products.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="card-elevated">
              <CardHeader className="pb-2">
                <CardDescription>Capacidade total anunciada</CardDescription>
                <CardTitle className="text-3xl">{MZN.format(totalCapacity)}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="card-elevated">
              <CardHeader className="pb-2">
                <CardDescription>Já subscrito na plataforma</CardDescription>
                <CardTitle className="text-3xl">{MZN.format(totalRaised)}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-6 lg:grid-cols-2">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="size-4 text-primary" /> Taxa alvo anual por produto (%)
              </CardTitle>
              <CardDescription>Valores declarados por produto, não projeções de lucro.</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rateSeries} margin={{ left: -20, right: 8 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} height={60} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip
                    formatter={(v) => [`${v}%`, "Taxa alvo"]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
                  />
                  <Bar dataKey="taxa" radius={[6, 6, 0, 0]} fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-base">Capacidade por sector</CardTitle>
              <CardDescription>Distribuição da capacidade anunciada entre sectores.</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sectorSeries} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3}>
                    {sectorSeries.map((_, i) => (
                      <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number, n) => [MZN.format(v), n as string]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-6">
          <h2 className="text-xl font-bold sm:text-2xl">Produtos</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-16">
          <div className="card-elevated flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-primary" />
              <p className="max-w-2xl text-sm text-muted-foreground">
                Subscrições, saldos e cancelamentos são decididos exclusivamente no servidor e
                registados num histórico imutável. O cancelamento antes da maturidade devolve apenas
                o capital, sem qualquer rendimento.
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild>
                <Link to="/carteira">Abrir a minha carteira</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/empresas">
                  <Building2 className="mr-1.5 size-4" /> Empresas
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const filled = product.capacity > 0 ? Math.min(100, (product.raised / product.capacity) * 100) : 0;
  return (
    <Card className="card-elevated flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary">{product.company?.sector ?? "—"}</Badge>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${riskTone[product.riskLevel] ?? ""}`}>
            {riskLabel[product.riskLevel] ?? product.riskLevel}
          </span>
        </div>
        <CardTitle className="mt-2 text-base">{product.name}</CardTitle>
        <CardDescription>{product.company?.name}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <p className="text-sm text-muted-foreground">{product.description}</p>

        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-border bg-secondary/40 p-2">
            <dt className="text-[11px] text-muted-foreground">Taxa alvo</dt>
            <dd className="font-display text-sm font-bold text-primary">{pct(product.targetRateAnnual)}</dd>
          </div>
          <div className="rounded-xl border border-border bg-secondary/40 p-2">
            <dt className="text-[11px] text-muted-foreground">Prazo</dt>
            <dd className="font-display text-sm font-bold">{product.termMonths}m</dd>
          </div>
          <div className="rounded-xl border border-border bg-secondary/40 p-2">
            <dt className="text-[11px] text-muted-foreground">Mínimo</dt>
            <dd className="font-display text-sm font-bold">{MZN.format(product.minAmount)}</dd>
          </div>
        </dl>

        <div>
          <Progress value={filled} className="h-2" />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {MZN.format(product.raised)} de {MZN.format(product.capacity)} subscritos
          </p>
        </div>

        <Button className="mt-auto w-full" asChild disabled={product.status !== "open"}>
          <Link to="/carteira" search={{ produto: product.id }}>
            Investir <ArrowRight className="ml-1.5 size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
