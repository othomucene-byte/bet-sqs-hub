import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site-header";
import { ExchangeNav, PaperBadge } from "@/components/exchange/exchange-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getExchangeAccount,
  grantPaperCash,
  transferWallet,
} from "@/lib/exchange/trading.functions";
import { MZN } from "@/lib/exchange/format";

export const Route = createFileRoute("/_authenticated/exchange/wallet")({
  head: () => ({
    meta: [
      { title: "Fundos SQs Exchange | Betfcom SQs" },
      {
        name: "description",
        content:
          "Saldo de simulação, entradas e saídas entre a carteira de investimentos e a conta do SQs Exchange.",
      },
      { property: "og:title", content: "Fundos SQs Exchange" },
      { property: "og:description", content: "Gestão de liquidez da conta de mercado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const queryClient = useQueryClient();
  const fetchAccount = useServerFn(getExchangeAccount);
  const doGrant = useServerFn(grantPaperCash);
  const doTransfer = useServerFn(transferWallet);
  const [paperAmount, setPaperAmount] = useState("50000");
  const [liveAmount, setLiveAmount] = useState("1000");

  const account = useQuery({
    queryKey: ["exchange-account"],
    queryFn: () => fetchAccount({ data: { environment: "PAPER" as const } }),
  });
  const acc = account.data;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["exchange-account"] });
    queryClient.invalidateQueries({ queryKey: ["exchange-history"] });
  };

  const grant = useMutation({
    mutationFn: () =>
      doGrant({
        data: { amount: Number(paperAmount), idempotencyKey: `paper-${crypto.randomUUID()}` },
      }),
    onSuccess: (r) => {
      toast.success(`Creditados ${MZN.format(r.amount)} de saldo de simulação`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const transfer = useMutation({
    mutationFn: (direction: "IN" | "OUT") =>
      doTransfer({
        data: {
          direction,
          amount: Number(liveAmount),
          idempotencyKey: `xfer-${crypto.randomUUID()}`,
        },
      }),
    onSuccess: () => {
      toast.success("Transferência registada");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">Fundos do mercado</h1>
          <PaperBadge />
        </div>
        <ExchangeNav />

        {account.isLoading && <Skeleton className="h-24 w-full" />}

        {acc && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Card>
                <CardContent className="p-3">
                  <p className="text-[11px] uppercase text-muted-foreground">Disponível</p>
                  <p className="text-sm font-semibold">{MZN.format(acc.available)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-[11px] uppercase text-muted-foreground">Reservado</p>
                  <p className="text-sm font-semibold">{MZN.format(acc.reserved)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-[11px] uppercase text-muted-foreground">Carteira investimentos</p>
                  <p className="text-sm font-semibold">{MZN.format(acc.investmentWalletBalance)}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Saldo de simulação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Dinheiro fictício, exclusivo do ambiente de simulação. Não é sacável, não tem valor
                  monetário e está separado do seu dinheiro real.
                </p>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="paper" className="text-xs">
                      Montante (MZN)
                    </Label>
                    <Input
                      id="paper"
                      inputMode="numeric"
                      value={paperAmount}
                      onChange={(e) => setPaperAmount(e.target.value)}
                    />
                  </div>
                  <Button
                    className="mt-6"
                    disabled={grant.isPending || !(Number(paperAmount) > 0)}
                    onClick={() => grant.mutate()}
                  >
                    Creditar simulação
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Dinheiro real (ambiente LIVE)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Movimenta a carteira de investimentos para a conta de mercado LIVE. Exige
                  verificação de identidade aprovada e um operador de bolsa autorizado ligado — essa
                  integração está pendente de credenciais e API oficial, pelo que a negociação LIVE
                  permanece indisponível.
                </p>
                {!acc.kycApproved && (
                  <p className="text-xs text-amber-400">
                    Verificação de identidade ainda não aprovada.
                  </p>
                )}
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="live" className="text-xs">
                      Montante (MZN)
                    </Label>
                    <Input
                      id="live"
                      inputMode="numeric"
                      value={liveAmount}
                      onChange={(e) => setLiveAmount(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="secondary"
                    className="mt-6"
                    disabled={transfer.isPending || !acc.kycApproved}
                    onClick={() => transfer.mutate("IN")}
                  >
                    Depositar
                  </Button>
                  <Button
                    variant="outline"
                    className="mt-6"
                    disabled={transfer.isPending || !acc.kycApproved}
                    onClick={() => transfer.mutate("OUT")}
                  >
                    Levantar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
      <ExchangeNav />
    </div>
  );
}
