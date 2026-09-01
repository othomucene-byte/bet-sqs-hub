import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { FlightCanvas, type FlightStatus } from "@/components/crash/flight-canvas";
import { HistoryBar } from "@/components/crash/history-bar";
import { BetPanel, type BetState } from "@/components/crash/bet-panel";
import { RoundStats, type StatBet } from "@/components/crash/round-stats";
import { multiplierAt, sha256Hex, crashResult } from "@/lib/crash/fair";
import * as sound from "@/lib/crash/sound";
import {
  cashout,
  getCurrentRound,
  getMyBet,
  getRoundStats,
  placeBet,
  revealRound,
} from "@/lib/crash/crash.functions";
import { getTransactions, getWallet } from "@/lib/wallet/wallet.functions";

export const Route = createFileRoute("/_authenticated/crash")({
  head: () => ({
    meta: [
      { title: "Aviator Crash BETFCOM SQs — jogo verificável em meticais" },
      {
        name: "description",
        content:
          "Ronda de Crash com resultado gerado no servidor, compromisso criptográfico publicado antes de cada ronda e carteira em meticais com histórico imutável.",
      },
      { property: "og:title", content: "Aviator Crash BETFCOM SQs" },
      {
        property: "og:description",
        content:
          "Cada ronda tem hash publicado antes e semente revelada depois, para verificação independente.",
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
  CRASHED: "Voou!",
  SETTLED: "Liquidada",
};

function CrashPage() {
  const queryClient = useQueryClient();
  const fetchRound = useServerFn(getCurrentRound);
  const fetchWallet = useServerFn(getWallet);
  const fetchBet = useServerFn(getMyBet);
  const fetchLedger = useServerFn(getTransactions);
  const fetchStats = useServerFn(getRoundStats);
  const submitBet = useServerFn(placeBet);
  const submitCashout = useServerFn(cashout);

  const roundQuery = useQuery({
    queryKey: ["crash", "round"],
    queryFn: () => fetchRound(),
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
  });

  const round = roundQuery.data?.round;
  const status = (round?.status ?? "WAITING") as FlightStatus;

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
  const statsQuery = useQuery({
    queryKey: ["crash", "stats", round?.id],
    queryFn: () => fetchStats({ data: { roundId: round!.id } }),
    enabled: Boolean(round?.id),
    refetchInterval: 3000,
  });

  const [bet, setBet] = useState<BetState>({
    amount: "50",
    autoEnabled: true,
    autoValue: "2.00",
  });
  const [muted, setMutedState] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState("");

  useEffect(() => {
    setMutedState(sound.loadMutePreference());
  }, []);

  const toggleMute = () => {
    const next = !muted;
    sound.setMuted(next);
    setMutedState(next);
    if (!next) sound.ensureAudio();
  };

  const placeMutation = useMutation({
    mutationFn: async () =>
      submitBet({
        data: {
          roundId: round!.id,
          amount: Number(bet.amount),
          autoCashout: bet.autoEnabled && Number(bet.autoValue) > 1 ? Number(bet.autoValue) : null,
        },
      }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      sound.playBet();
      toast.success("Aposta registada pelo servidor.");
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void betQuery.refetch();
      void statsQuery.refetch();
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
      sound.playCashout();
      toast.success("Cash-out confirmado pelo servidor.");
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void betQuery.refetch();
      void statsQuery.refetch();
    },
    onError: () => toast.error("Não foi possível fazer cash-out."),
  });

  // Interpolação local só para a leitura do multiplicador; o valor pago é o do servidor.
  const displayMultiplier = useLiveMultiplier(
    status,
    round?.startedAt ?? null,
    round?.serverNow ?? null,
    round?.multiplier ?? 1,
    round?.crashMultiplier ?? null,
  );

  useCrashAudio(status, displayMultiplier, round?.phaseMsRemaining ?? 0);

  const myBet = betQuery.data;
  const wallet = walletQuery.data;
  const config = roundQuery.data?.config;
  const countdown = Math.max(0, Math.ceil((round?.phaseMsRemaining ?? 0) / 1000));

  const myBets: StatBet[] = myBet
    ? [
        {
          id: myBet.id,
          player: "Você",
          amount: myBet.amount,
          multiplier: myBet.cashoutMultiplier,
          payout: myBet.payout,
          status: myBet.status,
        },
      ]
    : [];

  const multiplierTone =
    status === "CRASHED"
      ? "text-destructive"
      : displayMultiplier >= 5
        ? "text-chart-3"
        : displayMultiplier >= 2
          ? "text-primary"
          : "text-hero-foreground";

  return (
    <div className="min-h-screen bg-background" onPointerDown={() => sound.ensureAudio()}>
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl px-3 pb-10 pt-4 sm:px-4 sm:py-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-5">
          <div>
            <h1 className="font-display text-xl font-semibold text-foreground sm:text-3xl">
              Aviator Crash
            </h1>
            <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
              O servidor é a autoridade sobre ronda, aposta, cash-out e saldo.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleMute}
              aria-label={muted ? "Ligar som" : "Desligar som"}
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </Button>
            <div className="rounded-full border border-border/60 bg-card px-3 py-1.5 sm:px-4 sm:py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Carteira de apostas
              </p>
              <p className="font-display text-base font-bold tabular-nums text-primary sm:text-lg">
                {wallet ? MZN.format(wallet.balance) : "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:gap-5 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-border/60 shadow-card">
              <div className="relative h-[42vh] max-h-[320px] min-h-[210px] border-b-2 border-destructive/70 sm:h-[300px] sm:max-h-none">
                <FlightCanvas
                  status={status}
                  multiplier={displayMultiplier}
                  crashMultiplier={round?.crashMultiplier ?? null}
                />

                <div className="pointer-events-none absolute inset-x-0 top-3 flex items-start justify-between px-3">
                  <Badge variant="outline" className="border-white/20 bg-black/40 text-white">
                    Ronda #{round?.roundNumber ?? "—"}
                  </Badge>
                  <Badge
                    variant={status === "CRASHED" ? "destructive" : "outline"}
                    className={
                      status === "CRASHED"
                        ? ""
                        : "border-white/20 bg-black/40 text-white"
                    }
                  >
                    {statusLabel[status]}
                  </Badge>
                </div>

                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p
                    className={`font-display text-4xl font-black tabular-nums drop-shadow-[0_0_25px_rgba(0,0,0,0.6)] transition-transform sm:text-6xl ${multiplierTone} ${
                      status === "RUNNING" ? "animate-pulse-soft" : ""
                    }`}
                  >
                    {displayMultiplier.toFixed(2)}
                    <span className="text-2xl sm:text-3xl">x</span>
                  </p>
                  {status === "BETTING" && (
                    <div className="mt-4 flex flex-col items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
                        Apostas fecham em {countdown}s
                      </p>
                      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/15">
                        <div
                          className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
                          style={{ width: `${Math.min(100, (countdown / 8) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {status !== "BETTING" && (
                    <p className="mt-3 rounded-full bg-black/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/70">
                      {status === "RUNNING"
                        ? "Faça cash-out antes do crash"
                        : status === "CRASHED"
                          ? "O avião voou"
                          : "A preparar a próxima ronda"}
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-card px-3 py-2">
                <HistoryBar
                  items={roundQuery.data?.history ?? []}
                  onSelect={(n) => setVerifyTarget(String(n))}
                />
              </div>
            </div>

            <BetPanel
              state={bet}
              onChange={setBet}
              status={status}
              bet={myBet ?? null}
              liveMultiplier={displayMultiplier}
              minBet={config?.minBet ?? 10}
              maxBet={config?.maxBet ?? 25000}
              onPlace={() => placeMutation.mutate()}
              onCashout={(id) => cashoutMutation.mutate(id)}
              placing={placeMutation.isPending}
              cashingOut={cashoutMutation.isPending}
            />

            <RoundStats
              bets={statsQuery.data?.bets ?? []}
              top={statsQuery.data?.top ?? []}
              myBets={myBets}
              totalStaked={statsQuery.data?.totalStaked ?? 0}
              totalPaid={statsQuery.data?.totalPaid ?? 0}
            />
          </div>

          <div className="space-y-5">
            <FairnessCard
              roundNumber={round?.roundNumber ?? null}
              serverSeedHash={round?.serverSeedHash ?? null}
              clientSeed={round?.clientSeed ?? null}
              nonce={round?.nonce ?? null}
              houseEdge={round?.houseEdge ?? 0.05}
              target={verifyTarget}
              onTargetChange={setVerifyTarget}
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

/** Liga o som sintetizado às transições de estado da ronda. */
function useCrashAudio(status: FlightStatus, multiplier: number, phaseMsRemaining: number) {
  const previous = useRef<FlightStatus | null>(null);
  const lastTick = useRef(-1);

  useEffect(() => {
    if (previous.current === status) return;
    if (status === "RUNNING") sound.startEngine();
    if (status === "CRASHED") sound.playCrash();
    if (status === "WAITING" || status === "SETTLED") sound.stopEngine();
    previous.current = status;
  }, [status]);

  useEffect(() => {
    if (status === "RUNNING") sound.updateEngine(multiplier);
  }, [status, multiplier]);

  useEffect(() => {
    if (status !== "BETTING") return;
    const seconds = Math.ceil(phaseMsRemaining / 1000);
    if (seconds <= 3 && seconds > 0 && seconds !== lastTick.current) {
      lastTick.current = seconds;
      sound.playTick();
    }
  }, [status, phaseMsRemaining]);
}

function FairnessCard({
  roundNumber,
  serverSeedHash,
  clientSeed,
  nonce,
  houseEdge,
  target,
  onTargetChange,
}: {
  roundNumber: number | null;
  serverSeedHash: string | null;
  clientSeed: string | null;
  nonce: number | null;
  houseEdge: number;
  target: string;
  onTargetChange: (value: string) => void;
}) {
  const reveal = useServerFn(revealRound);
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
            onChange={(e) => onTargetChange(e.target.value)}
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
