import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { multiplierAt, sha256Hex, crashResult } from "@/lib/crash/fair";
import { cashout, getCurrentRound, getMyBet, placeBet, revealRound } from "@/lib/crash/crash.functions";
import { getTransactions, getWallet } from "@/lib/wallet/wallet.functions";

export const Route = createFileRoute("/_authenticated/crash")({
  head: () => ({
    meta: [
      { title: "Crash BETFCOM SQs — jogo verificável em meticais" },
      {
        name: "description",
        content:
          "Ronda de Crash com resultado gerado no servidor, compromisso criptográfico publicado antes de cada ronda e carteira em meticais com histórico imutável.",
      },
      { property: "og:title", content: "Crash BETFCOM SQs" },
      {
        property: "og:description",
        content: "Cada ronda tem hash publicado antes e semente revelada depois, para verificação independente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CrashPage,
});

const MZN = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "MZN" });

const statusLabel: Record<string, string> = {
  WAITING: "A preparar",
  BETTING: "Apostas abertas",
  RUNNING: "Em voo",
  CRASHED: "Crash",
  SETTLED: "Liquidada",
};

function CrashPage() {
  const queryClient = useQueryClient();
  const fetchRound = useServerFn(getCurrentRound);
  const fetchWallet = useServerFn(getWallet);
  const fetchBet = useServerFn(getMyBet);
  const fetchLedger = useServerFn(getTransactions);
  const submitBet = useServerFn(placeBet);
  const submitCashout = useServerFn(cashout);

  const roundQuery = useQuery({
    queryKey: ["crash", "round"],
    queryFn: () => fetchRound(),
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
  });

  const round = roundQuery.data?.round;

  const walletQuery = useQuery({ queryKey: ["wallet"], queryFn: () => fetchWallet() });
  const ledgerQuery = useQuery({
    queryKey: ["wallet", "ledger"],
    queryFn: () => fetchLedger({ data: { limit: 8 } }),
  });
  const betQuery = useQuery({
    queryKey: ["crash", "bet", round?.id],
    queryFn: () => fetchBet({ data: { roundId: round!.id } }),
    enabled: Boolean(round?.id),
  });

  const [amount, setAmount] = useState("50");
  const [autoCashout, setAutoCashout] = useState("2.00");

  const placeMutation = useMutation({
    mutationFn: async () =>
      submitBet({
        data: {
          roundId: round!.id,
          amount: Number(amount),
          autoCashout: autoCashout ? Number(autoCashout) : null,
        },
      }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Aposta registada pelo servidor.");
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void betQuery.refetch();
    },
    onError: () => toast.error("Não foi possível registar a aposta."),
  });

  const cashoutMutation = useMutation({
    mutationFn: async (betId: string) => submitCashout({ data: { betId } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Cash-out confirmado pelo servidor.");
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void betQuery.refetch();
    },
    onError: () => toast.error("Não foi possível fazer cash-out."),
  });

  // Interpolação local só para a leitura do multiplicador; o valor pago é o do servidor.
  const displayMultiplier = useLiveMultiplier(
    round?.status ?? "WAITING",
    round?.startedAt ?? null,
    round?.serverNow ?? null,
    round?.multiplier ?? 1,
    round?.crashMultiplier ?? null,
  );

  const bet = betQuery.data;
  const wallet = walletQuery.data;
  const config = roundQuery.data?.config;
  const canBet = round?.status === "BETTING" && !bet;
  const canCashout = round?.status === "RUNNING" && bet?.status === "active";

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
              Crash
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              O servidor é a autoridade sobre ronda, aposta, cash-out e saldo.
            </p>
          </div>
          <Card className="min-w-[220px]">
            <CardContent className="py-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Carteira de apostas
              </p>
              <p className="font-display text-2xl font-semibold text-foreground">
                {wallet ? MZN.format(wallet.balance) : "—"}
              </p>
              {wallet && wallet.reserved > 0 && (
                <p className="text-xs text-muted-foreground">
                  Reservado: {MZN.format(wallet.reserved)}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-base">
                Ronda #{round?.roundNumber ?? "—"}
              </CardTitle>
              <Badge variant={round?.status === "CRASHED" ? "destructive" : "outline"}>
                {statusLabel[round?.status ?? "WAITING"]}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-2xl border border-border/60 bg-secondary/30 py-12 text-center">
                <p
                  className={
                    round?.status === "CRASHED"
                      ? "font-display text-6xl font-bold text-destructive"
                      : "font-display text-6xl font-bold text-primary"
                  }
                >
                  {displayMultiplier.toFixed(2)}x
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {round?.status === "BETTING"
                    ? `Apostas fecham em ${Math.ceil((round.phaseMsRemaining ?? 0) / 1000)}s`
                    : round?.status === "RUNNING"
                      ? "Faça cash-out antes do crash"
                      : round?.status === "CRASHED"
                        ? "Ronda terminada"
                        : "A preparar a próxima ronda"}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="amount">Valor da aposta (MZN)</Label>
                  <Input
                    id="amount"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={!canBet}
                  />
                  {config && (
                    <p className="text-xs text-muted-foreground">
                      Mínimo {MZN.format(config.minBet)} · máximo {MZN.format(config.maxBet)}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="auto">Cash-out automático</Label>
                  <Input
                    id="auto"
                    inputMode="decimal"
                    placeholder="2.00"
                    value={autoCashout}
                    onChange={(e) => setAutoCashout(e.target.value)}
                    disabled={!canBet}
                  />
                  <p className="text-xs text-muted-foreground">
                    Opcional. Executado pelo servidor mesmo se perder a ligação.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => placeMutation.mutate()}
                  disabled={!canBet || placeMutation.isPending}
                >
                  Apostar
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => bet && cashoutMutation.mutate(bet.id)}
                  disabled={!canCashout || cashoutMutation.isPending}
                >
                  Cash-out
                </Button>
              </div>

              {bet && (
                <div className="rounded-xl border border-border/60 p-4 text-sm">
                  <p className="text-muted-foreground">
                    A sua aposta nesta ronda: {MZN.format(bet.amount)}
                    {bet.autoCashout ? ` · auto ${bet.autoCashout.toFixed(2)}x` : ""}
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {bet.status === "active" && "Ativa"}
                    {bet.status === "cashed_out" &&
                      `Cash-out a ${bet.cashoutMultiplier?.toFixed(2)}x — ${MZN.format(bet.payout ?? 0)}`}
                    {bet.status === "lost" && "Perdida"}
                    {bet.status === "refunded" && "Reembolsada"}
                  </p>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                  Últimas rondas
                </p>
                <div className="flex flex-wrap gap-2">
                  {(roundQuery.data?.history ?? []).map((h) => (
                    <span
                      key={h.roundNumber}
                      className={
                        (h.multiplier ?? 0) >= 2
                          ? "rounded-lg bg-primary/15 px-2 py-1 text-xs font-medium text-primary"
                          : "rounded-lg bg-secondary px-2 py-1 text-xs font-medium text-muted-foreground"
                      }
                    >
                      {h.multiplier?.toFixed(2)}x
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <FairnessCard
              roundNumber={round?.roundNumber ?? null}
              serverSeedHash={round?.serverSeedHash ?? null}
              clientSeed={round?.clientSeed ?? null}
              nonce={round?.nonce ?? null}
              houseEdge={round?.houseEdge ?? 0.05}
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Movimentos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(ledgerQuery.data ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Ainda sem movimentos. Um depósito confirmado cria a primeira entrada.
                  </p>
                )}
                {(ledgerQuery.data ?? []).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between border-b border-border/40 pb-2 text-sm last:border-0"
                  >
                    <span className="text-muted-foreground">{tx.type}</span>
                    <span
                      className={
                        tx.amount >= 0 ? "font-medium text-primary" : "font-medium text-foreground"
                      }
                    >
                      {MZN.format(tx.amount)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

/** Anima o multiplicador entre pedidos, alinhado ao relógio do servidor. */
function useLiveMultiplier(
  status: string,
  startedAt: string | null,
  serverNow: string | null,
  serverMultiplier: number,
  crashMultiplier: number | null,
) {
  const [value, setValue] = useState(serverMultiplier);
  const offsetRef = useRef(0);

  useEffect(() => {
    if (serverNow) offsetRef.current = Date.parse(serverNow) - Date.now();
  }, [serverNow]);

  useEffect(() => {
    if (status !== "RUNNING" || !startedAt) {
      setValue(crashMultiplier ?? serverMultiplier);
      return;
    }
    const started = Date.parse(startedAt);
    let frame = 0;
    const tick = () => {
      const serverTime = Date.now() + offsetRef.current;
      setValue(multiplierAt(serverTime - started));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [status, startedAt, serverMultiplier, crashMultiplier]);

  return value;
}

function FairnessCard({
  roundNumber,
  serverSeedHash,
  clientSeed,
  nonce,
  houseEdge,
}: {
  roundNumber: number | null;
  serverSeedHash: string | null;
  clientSeed: string | null;
  nonce: number | null;
  houseEdge: number;
}) {
  const reveal = useServerFn(revealRound);
  const [target, setTarget] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function verify() {
    const number = Number(target || roundNumber);
    if (!Number.isFinite(number)) return;
    setBusy(true);
    setResult(null);
    try {
      const data = await reveal({ data: { roundNumber: number } });
      if (!data || !data.serverSeed) {
        setResult("Ronda ainda a decorrer — a semente só é revelada após o crash.");
        return;
      }
      const hashOk = (await sha256Hex(data.serverSeed)) === data.serverSeedHash;
      const recomputed = await crashResult(
        data.serverSeed,
        data.clientSeed,
        data.nonce,
        houseEdge,
      );
      const matches = Math.abs(recomputed - (data.crashMultiplier ?? 0)) < 0.0001;
      setResult(
        `${hashOk ? "Hash confere" : "Hash NÃO confere"} · recalculado ${recomputed.toFixed(2)}x · gravado ${data.crashMultiplier?.toFixed(2)}x · ${matches ? "resultado válido" : "divergência"}`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <ShieldCheck className="size-4 text-primary" />
        <CardTitle className="text-base">Provably fair</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          O compromisso da ronda é publicado antes de as apostas abrirem. A semente do
          servidor só é revelada após o crash.
        </p>
        <dl className="space-y-1 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Hash</dt>
            <dd className="truncate font-mono text-foreground">{serverSeedHash ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Client seed</dt>
            <dd className="font-mono text-foreground">{clientSeed ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Nonce</dt>
            <dd className="font-mono text-foreground">{nonce ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Vantagem da casa</dt>
            <dd className="font-mono text-foreground">{(houseEdge * 100).toFixed(1)}%</dd>
          </div>
        </dl>
        <div className="flex gap-2">
          <Input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={roundNumber ? String(roundNumber - 1) : "N.º da ronda"}
            inputMode="numeric"
          />
          <Button variant="outline" onClick={verify} disabled={busy}>
            Verificar
          </Button>
        </div>
        {result && <p className="text-xs text-foreground">{result}</p>}
      </CardContent>
    </Card>
  );
}
