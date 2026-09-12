import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { LiveBadge } from "@/components/exchange/exchange-nav";
import { Panel, StatTile, TerminalShell, TotalCard } from "@/components/exchange/terminal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getExchangeAccount, transferWallet } from "@/lib/exchange/trading.functions";
import { MZN } from "@/lib/exchange/format";

export const Route = createFileRoute("/_authenticated/exchange/wallet")({
  head: () => ({
    meta: [
      { title: "Fundos SQs Exchange | Betfcom SQs" },
      {
        name: "description",
        content:
          "Entradas e saídas de dinheiro entre a sua carteira e a conta de mercado do SQs Exchange, em meticais.",
      },
      { property: "og:title", content: "Fundos SQs Exchange" },
      { property: "og:description", content: "Depositar e levantar na conta de mercado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WalletPage,
});

const QUICK = [500, 1000, 5000, 10000];

function WalletPage() {
  const queryClient = useQueryClient();
  const fetchAccount = useServerFn(getExchangeAccount);
  const doTransfer = useServerFn(transferWallet);
  const [amount, setAmount] = useState("1000");

  const account = useQuery({
    queryKey: ["exchange-account"],
    queryFn: () => fetchAccount({ data: { environment: "LIVE" as const } }),
  });
  const acc = account.data;

  const transfer = useMutation({
    mutationFn: (direction: "IN" | "OUT") =>
      doTransfer({
        data: {
          direction,
          amount: Number(amount),
          idempotencyKey: `xfer-${crypto.randomUUID()}`,
        },
      }),
    onSuccess: (_r, direction) => {
      toast.success(direction === "IN" ? "Fundos colocados na conta de mercado" : "Levantamento registado");
      queryClient.invalidateQueries({ queryKey: ["exchange-account"] });
      queryClient.invalidateQueries({ queryKey: ["exchange-history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valid = Number(amount) > 0 && Boolean(acc?.kycApproved);

  return (
    <TerminalShell
      title="Fundos do mercado"
      badges={<LiveBadge />}
      subtitle="Mova dinheiro real entre a sua carteira e a conta de mercado. Todos os movimentos passam pelo registo imutável do servidor."
    >
      {account.isLoading && <Skeleton className="h-32 w-full" />}

      {acc && (
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            <TotalCard
              label="Liquidez para investir"
              value={acc.available}
              note="Valor livre para colocar novas ordens; o reservado está preso em ordens abertas."
            />
            <div className="grid grid-cols-3 gap-2">
              <StatTile label="Disponível" value={MZN.format(acc.available)} />
              <StatTile label="Reservado" value={MZN.format(acc.reserved)} />
              <StatTile label="Carteira" value={MZN.format(acc.investmentWalletBalance)} />
            </div>
          </div>

          <Panel title="Depositar ou levantar">
            {!acc.kycApproved && (
              <p className="mb-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-400">
                Precisa da identidade verificada para mover dinheiro real.{" "}
                <Link to="/kyc" className="underline">
                  Verificar identidade
                </Link>
              </p>
            )}
            <div className="space-y-1">
              <Label htmlFor="amt" className="text-xs">
                Montante (MZN)
              </Label>
              <Input
                id="amt"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="mt-2 flex gap-1.5">
              {QUICK.map((v) => (
                <Button
                  key={v}
                  type="button"
                  onClick={() => setAmount(String(v))}
                  size="sm"
                  variant="outline"
                  className="h-7 flex-1 rounded-full px-1 text-xs text-muted-foreground"
                >
                  {v}
                </Button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                className="h-11 font-semibold"
                disabled={transfer.isPending || !valid}
                onClick={() => transfer.mutate("IN")}
              >
                Depositar
              </Button>
              <Button
                variant="outline"
                className="h-11 font-semibold"
                disabled={transfer.isPending || !valid}
                onClick={() => transfer.mutate("OUT")}
              >
                Levantar
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Para carregar a carteira use{" "}
              <Link to="/carteira" className="underline">
                Depósito
              </Link>{" "}
              (M-Pesa, e-Mola, mKesh ou cartão).
            </p>
          </Panel>
        </div>
      )}
    </TerminalShell>
  );
}
