import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Gift, ShieldAlert, Ticket, TrendingDown } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { claimLossRecovery, getBonusState } from "@/lib/promotions/promotions.functions";

export const Route = createFileRoute("/_authenticated/promocoes")({
  head: () => ({
    meta: [
      { title: "Promoções — bónus e apostas grátis | BETFCOM SQs" },
      {
        name: "description",
        content:
          "Bónus de primeiro depósito de 20 MZN apenas jogável e quatro apostas grátis por perdas do dia, atribuídos e validados no servidor.",
      },
      { property: "og:title", content: "Promoções BETFCOM SQs" },
      {
        property: "og:description",
        content: "Bónus de boas-vindas e apostas grátis com regras claras e sem retorno garantido.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PromocoesPage,
});

const MZN = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "MZN" });
const dateFmt = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function PromocoesPage() {
  const queryClient = useQueryClient();
  const fetchState = useServerFn(getBonusState);
  const claim = useServerFn(claimLossRecovery);

  const state = useQuery({ queryKey: ["bonus-state"], queryFn: () => fetchState() });

  const claimMutation = useMutation({
    mutationFn: async () => claim(),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Apostas grátis atribuídas. Válidas nas próximas 24 horas.");
      void queryClient.invalidateQueries({ queryKey: ["bonus-state"] });
    },
    onError: () => toast.error("Não foi possível atribuir as apostas grátis."),
  });

  const data = state.data;
  const progress = data ? Math.min(100, (data.lostToday / data.threshold) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl px-4 py-10">
        <Badge variant="secondary" className="mb-3">
          SQs Apostas
        </Badge>
        <h1 className="font-display text-2xl font-bold sm:text-4xl">Promoções</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Todos os bónus são atribuídos e validados no servidor. O saldo bónus é apenas jogável e
          nunca é levantável — só os ganhos vão para o saldo real.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card className="card-elevated">
            <CardHeader>
              <CardDescription className="flex items-center gap-1.5">
                <Gift className="size-3.5" /> Bónus de primeiro depósito
              </CardDescription>
              <CardTitle className="text-2xl">
                {state.isLoading ? "…" : MZN.format(data?.bonusBalance ?? 0)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                20 MZN de saldo bónus jogável no primeiro depósito confirmado, uma vez por
                utilizador, válido durante 7 dias.
              </p>
              {data?.bonusExpiresAt && (
                <p className="text-xs">Expira a {dateFmt.format(new Date(data.bonusExpiresAt))}.</p>
              )}
              {!data?.hasFirstDepositBonus && (
                <Button asChild variant="outline" className="w-full">
                  <Link to="/pagamentos">Fazer o primeiro depósito</Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardDescription className="flex items-center gap-1.5">
                <Ticket className="size-3.5" /> Apostas grátis disponíveis
              </CardDescription>
              <CardTitle className="text-2xl">{data?.freeBets.length ?? 0}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                Quatro apostas grátis de 3 a 10 MZN por perdas reais de 200 MZN ou mais no mesmo dia,
                no máximo uma recompensa por semana e válidas 24 horas. Pagam apenas o lucro.
              </p>
              {(data?.freeBets ?? []).slice(0, 4).map((bet) => (
                <p key={bet.id} className="text-xs">
                  {MZN.format(bet.minAmount)} – {MZN.format(bet.maxAmount)} · expira{" "}
                  {dateFmt.format(new Date(bet.expiresAt))}
                </p>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="card-elevated mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="size-4" /> Progresso de hoje
            </CardTitle>
            <CardDescription>
              Perdas reais registadas hoje: {MZN.format(data?.lostToday ?? 0)} de{" "}
              {MZN.format(data?.threshold ?? 200)}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
            <Button
              className="w-full sm:w-auto"
              disabled={!data?.eligibleForLossRecovery || claimMutation.isPending}
              onClick={() => claimMutation.mutate()}
            >
              {claimMutation.isPending ? "A atribuir…" : "Receber 4 apostas grátis"}
            </Button>
            {data?.cooldownUntil && new Date(data.cooldownUntil) > new Date() && (
              <p className="text-xs text-muted-foreground">
                Próxima recompensa disponível a {dateFmt.format(new Date(data.cooldownUntil))}.
              </p>
            )}
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
              Apostar envolve risco de perda total do valor apostado. Nenhuma promoção garante
              retorno. As apostas grátis são válidas no Aviator, no Fish Crash e em bilhetes simples
              de Desportos.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
