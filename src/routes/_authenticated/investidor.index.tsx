import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, ShieldAlert, TrendingUp, Wallet } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { InvestorNav } from "@/components/investor-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getInvestorOverview } from "@/lib/investments/portfolio.functions";
import { placeOrder, redeem } from "@/lib/investments/orders.functions";
import { listProducts } from "@/lib/investments/investments.functions";

export const Route = createFileRoute("/_authenticated/investidor/")({
  head: () => ({
    meta: [
      { title: "Painel do investidor — BETFCOM SQs" },
      {
        name: "description",
        content:
          "Património, capital investido, resultado declarado e ordens em processamento — todos os valores lidos e validados no servidor.",
      },
      { property: "og:title", content: "Painel do investidor — BETFCOM SQs" },
      {
        property: "og:description",
        content: "Subscrições, resgates e resultados com extrato imutável.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvestorDashboard,
});

const MZN = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "MZN" });
const dateFmt = new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short" });

function InvestorDashboard() {
  const queryClient = useQueryClient();
  const fetchOverview = useServerFn(getInvestorOverview);
  const fetchProducts = useServerFn(listProducts);
  const doPlace = useServerFn(placeOrder);
  const doRedeem = useServerFn(redeem);

  const overview = useQuery({ queryKey: ["investor-overview"], queryFn: () => fetchOverview() });
  const products = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });

  const [productId, setProductId] = useState("");
  const [amount, setAmount] = useState("");

  const data = overview.data;
  const kycApproved = data?.kycStatus === "approved";
  const openProducts = (products.data ?? []).filter((p) => p.status === "open");
  const selected = openProducts.find((p) => p.id === productId) ?? null;

  const placeMutation = useMutation({
    mutationFn: async () =>
      doPlace({
        data: {
          productId,
          amount: Number(amount),
          idempotencyKey: crypto.randomUUID(),
        },
      }),
    onSuccess: (order) => {
      toast.success(`Ordem ${order.status.toLowerCase()} — referência ${order.reference}`);
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["investor-overview"] });
      queryClient.invalidateQueries({ queryKey: ["investor-orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a ordem."),
  });

  const redeemMutation = useMutation({
    mutationFn: async (investmentId: string) =>
      doRedeem({ data: { investmentId, idempotencyKey: crypto.randomUUID() } }),
    onSuccess: () => {
      toast.success("Resgate liquidado na carteira de investimentos.");
      queryClient.invalidateQueries({ queryKey: ["investor-overview"] });
      queryClient.invalidateQueries({ queryKey: ["investor-orders"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível resgatar."),
  });

  const ledgerChart = useMemo(
    () =>
      (data?.ledger ?? []).map((point) => ({
        label: dateFmt.format(new Date(point.date)),
        saldo: point.balance,
      })),
    [data?.ledger],
  );

  const positionChart = useMemo(
    () =>
      (data?.positions ?? []).map((p) => ({
        label: p.productName.length > 14 ? `${p.productName.slice(0, 13)}…` : p.productName,
        capital: p.investedAmount,
        valor: p.currentValue,
      })),
    [data?.positions],
  );

  const cards = [
    { label: "Saldo disponível", value: data?.wallet?.balance ?? 0, icon: Wallet },
    { label: "Capital investido", value: data?.invested ?? 0, icon: TrendingUp },
    { label: "Valor actual", value: data?.currentValue ?? 0, icon: TrendingUp },
    { label: "Resultado declarado", value: data?.result ?? 0, icon: TrendingUp },
  ];

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 pb-20">
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">Painel do investidor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todos os montantes são lidos do servidor. O navegador nunca decide saldos nem resultados.
        </p>

        <InvestorNav className="mt-5" />

        {!kycApproved ? (
          <Card className="mt-5 border-amber-500/40">
            <CardHeader className="flex-row items-start gap-3">
              <ShieldAlert className="mt-0.5 size-5 text-amber-500" />
              <div>
                <CardTitle className="text-base">Verificação de identidade necessária</CardTitle>
                <CardDescription>
                  Estado actual: {data?.kycStatus ?? "não iniciado"}. Sem KYC aprovado não é possível
                  subscrever produtos.
                </CardDescription>
                <Button size="sm" className="mt-3" asChild>
                  <Link to="/kyc">
                    Concluir KYC <ArrowRight className="ml-1 size-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
          </Card>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <Card key={card.label}>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5 text-xs">
                  <card.icon className="size-3.5" /> {card.label}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-heading text-xl font-bold tabular-nums">
                  {overview.isLoading ? "—" : MZN.format(card.value)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolução do saldo (extrato imutável)</CardTitle>
              <CardDescription>
                Cada ponto corresponde a um movimento registado no ledger.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-64">
              {ledgerChart.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ainda não existem movimentos.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ledgerChart}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={70} />
                    <Tooltip formatter={(v: number) => MZN.format(v)} />
                    <Area
                      type="monotone"
                      dataKey="saldo"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary) / 0.2)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nova subscrição</CardTitle>
              <CardDescription>
                A ordem é criada, validada e liquidada no servidor, com chave de idempotência.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-2">
                <Label>Produto</Label>
                <Select value={productId} onValueChange={setProductId} disabled={!kycApproved}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolher produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {openProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="amount">Montante (MZN)</Label>
                <Input
                  id="amount"
                  type="number"
                  min={selected?.minAmount ?? 0}
                  value={amount}
                  disabled={!kycApproved}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={selected ? String(selected.minAmount) : "500"}
                />
                {selected ? (
                  <p className="text-xs text-muted-foreground">
                    Mínimo {MZN.format(selected.minAmount)} · prazo {selected.termMonths} meses ·
                    taxa alvo indicativa {(selected.targetRateAnnual * 100).toFixed(2)}%
                  </p>
                ) : null}
              </div>
              <Button
                onClick={() => placeMutation.mutate()}
                disabled={
                  !kycApproved || !productId || !amount || Number(amount) <= 0 || placeMutation.isPending
                }
              >
                Criar ordem de subscrição
              </Button>
              <p className="text-xs text-muted-foreground">
                Taxas alvo são indicativas. Não há retorno garantido e o capital pode ser perdido.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Posições por produto</CardTitle>
            <CardDescription>Capital investido vs. valor actual declarado.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {positionChart.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem posições activas.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={positionChart}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={70} />
                  <Tooltip formatter={(v: number) => MZN.format(v)} />
                  <Bar dataKey="capital" fill="hsl(var(--muted-foreground) / 0.5)" radius={4} />
                  <Bar dataKey="valor" fill="hsl(var(--primary))" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Investimentos</CardTitle>
            <CardDescription>
              O resgate devolve capital mais o resultado já registado no ledger.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {(data?.holdings ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda não subscreveste produtos.</p>
            ) : (
              (data?.holdings ?? []).map((h) => (
                <div
                  key={h.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 p-3"
                >
                  <div>
                    <p className="text-sm font-semibold">{h.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.companyName} · {h.reference} · maturidade{" "}
                      {new Date(h.maturesAt).toLocaleDateString("pt-PT")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{MZN.format(h.amount)}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        resultado {MZN.format(h.accruedReturn)}
                      </p>
                    </div>
                    <Badge variant="outline">{h.status}</Badge>
                    {h.status === "active" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={redeemMutation.isPending}
                        onClick={() => redeemMutation.mutate(h.id)}
                      >
                        Resgatar
                      </Button>
                    ) : null}
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
