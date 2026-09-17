import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ShieldAlert, Wallet } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
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
import {
  cancelInvestment,
  getPortfolio,
  getWalletBalances,
  invest,
  listProducts,
  transferToInvestment,
} from "@/lib/investments/investments.functions";

export const Route = createFileRoute("/_authenticated/carteira")({
  validateSearch: z.object({ produto: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "Carteira de investimentos — Betfcom SQs" },
      {
        name: "description",
        content:
          "Carteira de investimentos em meticais: saldo validado no servidor, posições activas, evolução do histórico imutável e projecção indicativa por produto.",
      },
      { property: "og:title", content: "Carteira de investimentos Betfcom SQs" },
      {
        property: "og:description",
        content: "Saldo, subscrições e cancelamentos decididos apenas no servidor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CarteiraPage,
});

const MZN = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "MZN" });
const dateFmt = new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short" });

const statusLabel: Record<string, string> = {
  active: "Activo",
  cancelled: "Cancelado",
  matured: "Maturado",
};

function CarteiraPage() {
  const { produto } = Route.useSearch();
  const queryClient = useQueryClient();

  const fetchPortfolio = useServerFn(getPortfolio);
  const fetchProducts = useServerFn(listProducts);
  const doInvest = useServerFn(invest);
  const doCancel = useServerFn(cancelInvestment);

  const fetchBalances = useServerFn(getWalletBalances);
  const doTransfer = useServerFn(transferToInvestment);

  const portfolio = useQuery({ queryKey: ["portfolio"], queryFn: () => fetchPortfolio() });
  const products = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });
  const balances = useQuery({ queryKey: ["wallet-balances"], queryFn: () => fetchBalances() });

  const [productId, setProductId] = useState<string>(produto ?? "");
  const [amount, setAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");

  const transferMutation = useMutation({
    mutationFn: async (direction: "to_investment" | "to_betting") =>
      doTransfer({ data: { amount: Number(transferAmount), direction } }),
    onSuccess: (_r, direction) => {
      toast.success(
        direction === "to_investment"
          ? "Transferido para a carteira de investimentos."
          : "Transferido para a carteira de apostas.",
      );
      setTransferAmount("");
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-balances"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível transferir."),
  });


  const openProducts = (products.data ?? []).filter((p) => p.status === "open");
  const selected = openProducts.find((p) => p.id === productId) ?? null;

  const investMutation = useMutation({
    mutationFn: async () => doInvest({ data: { productId, amount: Number(amount) } }),
    onSuccess: () => {
      toast.success("Subscrição registada e debitada da carteira.");
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível subscrever."),
  });

  const cancelMutation = useMutation({
    mutationFn: async (investmentId: string) => doCancel({ data: { investmentId } }),
    onSuccess: () => {
      toast.success("Investimento cancelado. Capital devolvido à carteira.");
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível cancelar."),
  });

  const ledgerSeries = useMemo(
    () =>
      (portfolio.data?.ledger ?? []).map((point) => ({
        label: dateFmt.format(new Date(point.date)),
        saldo: point.balance,
      })),
    [portfolio.data],
  );

  const projection = useMemo(() => {
    const active = (portfolio.data?.investments ?? []).filter((i) => i.status === "active");
    if (!active.length) return [];
    const months = Math.max(...active.map((i) => i.termMonths));
    const out: { label: string; capital: number; alvo: number }[] = [];
    for (let m = 0; m <= months; m++) {
      let capital = 0;
      let alvo = 0;
      for (const inv of active) {
        if (m > inv.termMonths) continue;
        capital += inv.amount;
        alvo += inv.amount * (1 + (inv.targetRateAnnual * m) / 12);
      }
      out.push({ label: `${m}m`, capital, alvo: Number(alvo.toFixed(2)) });
    }
    return out;
  }, [portfolio.data]);

  const balance = portfolio.data?.wallet?.balance ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <Badge variant="secondary" className="mb-3">
          SQs Investimentos
        </Badge>
        <h1 className="font-display text-2xl font-bold sm:text-4xl">Carteira de investimentos</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Contabilisticamente separada da carteira de apostas. Saldo e movimentos são lidos do
          servidor — o navegador nunca calcula saldo.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Card className="card-elevated">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Wallet className="size-3.5" /> Saldo disponível
              </CardDescription>
              <CardTitle className="text-2xl">
                {portfolio.isLoading ? "…" : MZN.format(balance)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="card-elevated">
            <CardHeader className="pb-2">
              <CardDescription>Capital investido (activo)</CardDescription>
              <CardTitle className="text-2xl">{MZN.format(portfolio.data?.invested ?? 0)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="card-elevated">
            <CardHeader className="pb-2">
              <CardDescription>Posições</CardDescription>
              <CardTitle className="text-2xl">
                {(portfolio.data?.investments ?? []).filter((i) => i.status === "active").length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-base">Evolução do saldo (histórico real)</CardTitle>
                <CardDescription>Cada ponto é um movimento registado no ledger imutável.</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                {ledgerSeries.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={ledgerSeries} margin={{ left: -10, right: 8 }}>
                      <CartesianGrid strokeOpacity={0.12} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(v: number) => [MZN.format(v), "Saldo"]}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
                      />
                      <Area dataKey="saldo" stroke="#10b981" fill="#10b98133" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Sem movimentos nesta carteira. Deposite em <Link to="/pagamentos" className="ml-1 text-primary underline-offset-4 hover:underline">Pagamentos</Link>.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-base">Projecção indicativa das posições activas</CardTitle>
                <CardDescription>
                  Calculada com a taxa alvo declarada de cada produto. É indicativa e não constitui
                  retorno garantido.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                {projection.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={projection} margin={{ left: -10, right: 8 }}>
                      <CartesianGrid strokeOpacity={0.12} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(v: number, n) => [MZN.format(v), n === "alvo" ? "Valor alvo" : "Capital"]}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
                      />
                      <Area dataKey="capital" stroke="#94a3b8" fill="#94a3b81f" strokeWidth={2} />
                      <Area dataKey="alvo" stroke="#38bdf8" fill="#38bdf822" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Sem posições activas.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-base">As minhas posições</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(portfolio.data?.investments ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">Ainda não tem investimentos.</p>
                )}
                {(portfolio.data?.investments ?? []).map((inv) => (
                  <div
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{inv.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.companyName} · {statusLabel[inv.status] ?? inv.status} · maturidade{" "}
                        {new Date(inv.maturesAt).toLocaleDateString("pt-PT")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-display text-sm font-bold">{MZN.format(inv.amount)}</span>
                      {inv.status === "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancelMutation.mutate(inv.id)}
                          disabled={cancelMutation.isPending}
                        >
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="card-elevated h-fit lg:sticky lg:top-20">
            <CardHeader>
              <CardTitle className="text-base">Nova subscrição</CardTitle>
              <CardDescription>Debitada da carteira de investimentos, no servidor.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Produto</Label>
                <Select value={productId} onValueChange={setProductId}>
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

              {selected && (
                <p className="text-xs text-muted-foreground">
                  Taxa alvo {(selected.targetRateAnnual * 100).toFixed(2)}% · prazo{" "}
                  {selected.termMonths} meses · mínimo {MZN.format(selected.minAmount)}
                </p>
              )}

              <div className="space-y-2">
                <Label htmlFor="amount">Montante (MZN)</Label>
                <Input
                  id="amount"
                  type="number"
                  min={selected?.minAmount ?? 500}
                  step="100"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <Button
                className="w-full"
                disabled={
                  !productId ||
                  !amount ||
                  Number(amount) <= 0 ||
                  investMutation.isPending ||
                  (selected ? Number(amount) < selected.minAmount : false)
                }
                onClick={() => investMutation.mutate()}
              >
                {investMutation.isPending ? "A subscrever…" : "Investir"}
              </Button>

              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                Investir envolve risco de perda de capital. Não há retorno garantido. O cancelamento
                devolve apenas o capital.
              </p>

              <div className="space-y-2 rounded-xl border border-border p-3">
                <p className="text-xs font-medium">Transferir entre as suas carteiras</p>
                <p className="text-xs text-muted-foreground">
                  Apostas: {MZN.format(balances.data?.betting ?? 0)} · Investimentos:{" "}
                  {MZN.format(balances.data?.investment ?? 0)}
                </p>
                <Input
                  type="number"
                  min="1"
                  step="50"
                  placeholder="Montante"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    disabled={
                      !transferAmount || Number(transferAmount) <= 0 || transferMutation.isPending
                    }
                    onClick={() => transferMutation.mutate("to_investment")}
                  >
                    Apostas → Invest.
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={
                      !transferAmount || Number(transferAmount) <= 0 || transferMutation.isPending
                    }
                    onClick={() => transferMutation.mutate("to_betting")}
                  >
                    Invest. → Apostas
                  </Button>
                </div>
              </div>


              <Button variant="outline" className="w-full" asChild>
                <Link to="/pagamentos">Depositar na carteira</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
