import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { PaperBadge } from "@/components/exchange/exchange-nav";
import { Panel, StatTile, TerminalShell, TotalCard } from "@/components/exchange/terminal";
import { Button } from "@/components/ui/button";
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
    <TerminalShell
      title="Fundos do mercado"
      badges={<PaperBadge />}
      subtitle="Movimente liquidez entre a carteira de investimentos e a conta de mercado. Todos os movimentos passam pelo registo imutável do servidor."
    >
      {account.isLoading && <Skeleton className="h-32 w-full" />}

      {acc && (
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            <TotalCard
              label="Liquidez para negociar"
              value={acc.available}
              note="Valor livre para colocar novas ordens; o reservado está preso em ordens abertas."
            />
            <div className="grid grid-cols-3 gap-2">
              <StatTile label="Disponível" value={MZN.format(acc.available)} />
              <StatTile label="Reservado" value={MZN.format(acc.reserved)} />
              <StatTile
                label="Carteira invest."
                value={MZN.format(acc.investmentWalletBalance)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Panel title="Saldo de simulação">
              <p className="text-xs text-muted-foreground">
                Dinheiro fictício, exclusivo do ambiente de simulação. Não é sacável, não tem valor
                monetário e está separado do seu dinheiro real.
              </p>
              <div className="mt-3 flex items-end gap-2">
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
                  disabled={grant.isPending || !(Number(paperAmount) > 0)}
                  onClick={() => grant.mutate()}
                >
                  Creditar
                </Button>
              </div>
            </Panel>

            <Panel title="Dinheiro real (mercado LIVE)">
              <p className="text-xs text-muted-foreground">
                Movimenta a carteira de investimentos para a conta de mercado real. Exige verificação
                de identidade aprovada e o mercado real aberto pela administração.
              </p>
              {!acc.kycApproved && (
                <p className="mt-2 text-xs text-amber-400">
                  Verificação de identidade ainda não aprovada.
                </p>
              )}
              <div className="mt-3 flex items-end gap-2">
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
                  disabled={transfer.isPending || !acc.kycApproved}
                  onClick={() => transfer.mutate("IN")}
                >
                  Depositar
                </Button>
                <Button
                  variant="outline"
                  disabled={transfer.isPending || !acc.kycApproved}
                  onClick={() => transfer.mutate("OUT")}
                >
                  Levantar
                </Button>
              </div>
            </Panel>
          </div>
        </div>
      )}
    </TerminalShell>
  );
}
