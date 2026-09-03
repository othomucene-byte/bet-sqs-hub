import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FlightCanvas, type FlightStatus } from "@/components/crash/flight-canvas";
import { BetPad } from "@/components/games/bet-pad";
import { GameTopBar, HistoryStrip, TotalsBar } from "@/components/games/game-chrome";
import { useClock } from "@/lib/games/use-clock";
import { multiplierAt, sha256Hex, crashResult } from "@/lib/crash/fair";
import * as sound from "@/lib/crash/sound";
import {
  cashout,
  getCurrentRound,
  getMyBets,
  getRoundStats,
  placeBet,
  revealRound,
} from "@/lib/crash/crash.functions";
import { getWallet } from "@/lib/wallet/wallet.functions";

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

const NUM = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function CrashPage() {
  const queryClient = useQueryClient();
  const fetchRound = useServerFn(getCurrentRound);
  const fetchWallet = useServerFn(getWallet);
  const fetchBets = useServerFn(getMyBets);
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
  const betQuery = useQuery({
    queryKey: ["crash", "bets", round?.id],
    queryFn: () => fetchBets({ data: { roundId: round!.id } }),
    enabled: Boolean(round?.id),
  });
  const statsQuery = useQuery({
    queryKey: ["crash", "stats", round?.id],
    queryFn: () => fetchStats({ data: { roundId: round!.id } }),
    enabled: Boolean(round?.id),
    refetchInterval: 3000,
  });

  const [amounts, setAmounts] = useState<Record<1 | 2, string>>({ 1: "50", 2: "50" });
  const [auto, setAuto] = useState("2.00");
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState("");
  const clock = useClock();

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
    mutationFn: async (input: { slot: 1 | 2; amount: number }) =>
      submitBet({
        data: {
          roundId: round!.id,
          amount: input.amount,
          slot: input.slot,
          autoCashout: input.slot === 1 && autoEnabled && Number(auto) > 1 ? Number(auto) : null,
        },
      }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      sound.playBet();
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
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void betQuery.refetch();
      void statsQuery.refetch();
    },
    onError: () => toast.error("Não foi possível fazer cash-out."),
  });

  // Interpolação local só para leitura; o valor pago é sempre o do servidor.
  const displayMultiplier = useLiveMultiplier(
    status,
    round?.startedAt ?? null,
    round?.serverNow ?? null,
    round?.multiplier ?? 1,
    round?.crashMultiplier ?? null,
  );

  useCrashAudio(status, displayMultiplier, round?.phaseMsRemaining ?? 0);

  const bets = betQuery.data ?? [];
  const config = roundQuery.data?.config;
  const minBet = config?.minBet ?? 10;
  const maxBet = config?.maxBet ?? 25000;
  const countdown = Math.max(0, Math.ceil((round?.phaseMsRemaining ?? 0) / 1000));

  const betForSlot = (slot: 1 | 2) => bets.find((bet) => bet.slot === slot) ?? null;
  const labelFor = (slot: 1 | 2) => {
    const bet = betForSlot(slot);
    if (bet?.status === "active") return "Em jogo";
    if (bet?.status === "cashed_out") return `Levantado ${bet.cashoutMultiplier?.toFixed(2)}x`;
    if (bet?.status === "lost") return "Perdida";
    if (status === "BETTING") return `Fecha em ${countdown}s`;
    return "A aguardar ronda";
  };

  return (
    <div
      className="flex min-h-[100dvh] flex-col bg-fish-bg text-fish-foreground"
      onPointerDown={() => sound.ensureAudio()}
    >
      <GameTopBar
        title="Aviator"
        accent="#ff3b47"
        balance={walletQuery.data?.balance ?? null}
        clock={clock}
        muted={muted}
        onToggleMute={toggleMute}
      />
      <HistoryStrip
        items={roundQuery.data?.history ?? []}
        onSelect={(n) => setVerifyTarget(String(n))}
      />

      <main className="mx-auto w-full max-w-[820px] flex-1 px-2.5 pb-4">
        {/* PALCO */}
        <section className="relative mt-2.5 h-[42dvh] min-h-[240px] overflow-hidden rounded-2xl border border-fish-line/70 bg-[#050e19] shadow-[inset_0_0_60px_rgba(0,0,0,0.8)] sm:h-[360px]">
          <FlightCanvas
            status={status}
            multiplier={displayMultiplier}
            crashMultiplier={round?.crashMultiplier ?? null}
          />

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
            {status === "CRASHED" && (
              <p className="font-display text-lg font-bold tracking-wide text-fish-foreground/90 sm:text-2xl">
                O AVIÃO PARTIU!
              </p>
            )}
            <p
              className={`font-display text-[52px] font-black leading-none tabular-nums sm:text-[76px] ${
                status === "CRASHED" ? "text-[#e0333f]" : "text-fish-foreground"
              }`}
              style={{ textShadow: "0 6px 30px rgba(0,0,0,0.65)" }}
            >
              {displayMultiplier.toFixed(2)}
              <span className="text-[0.6em]">x</span>
            </p>

            {status === "BETTING" && (
              <div className="mt-4 w-[min(320px,80%)] rounded-2xl border border-white/10 bg-black/45 px-4 py-3 backdrop-blur-sm">
                <p className="text-[11px] font-bold uppercase tracking-widest text-fish-muted">
                  A aguardar pela próxima ronda
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-[#ff3b47] transition-[width] duration-1000 ease-linear"
                    style={{ width: `${Math.min(100, (countdown / 8) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <span className="absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-fish-muted">
            Ronda #{round?.roundNumber ?? "—"}
          </span>
        </section>

        {/* APOSTAS */}
        <div className="mt-2.5 grid gap-2.5 md:grid-cols-2">
          {([1, 2] as const).map((slot) => {
            const bet = betForSlot(slot);
            const isActive = bet?.status === "active";
            return (
              <BetPad
                key={slot}
                title={`Aposta ${slot}`}
                value={amounts[slot]}
                onValue={(next) => setAmounts((prev) => ({ ...prev, [slot]: next }))}
                minBet={minBet}
                maxBet={maxBet}
                disabled={Boolean(bet) || status !== "BETTING"}
                mode={isActive ? "cashout" : "bet"}
                stateLabel={labelFor(slot)}
                cashoutValue={(bet?.amount ?? 0) * displayMultiplier}
                busy={placeMutation.isPending || cashoutMutation.isPending}
                onPlace={() => placeMutation.mutate({ slot, amount: Number(amounts[slot]) || 0 })}
                onCashout={() => bet && cashoutMutation.mutate(bet.id)}
                footer={
                  slot === 1 ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAutoEnabled((v) => !v)}
                        className={`flex-1 rounded-full py-2 text-xs font-bold transition ${
                          autoEnabled
                            ? "bg-fish-green text-fish-ink"
                            : "bg-fish-step text-fish-quick-foreground"
                        }`}
                      >
                        Levantamento automático
                      </button>
                      <input
                        inputMode="decimal"
                        aria-label="Multiplicador de levantamento automático"
                        value={auto}
                        onChange={(event) => setAuto(event.target.value)}
                        className="w-[72px] rounded-full bg-fish-input py-2 text-center text-xs font-bold tabular-nums text-fish-foreground outline-none"
                      />
                    </div>
                  ) : undefined
                }
              />
            );
          })}
        </div>

        <TotalsBar
          staked={statsQuery.data?.totalStaked ?? 0}
          paid={statsQuery.data?.totalPaid ?? 0}
        />

        <details className="mt-2.5 rounded-2xl border border-fish-line/70 bg-fish-panel">
          <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm font-bold">
            <ShieldCheck className="size-4 text-fish-green" />
            Provably fair e regras da ronda
          </summary>
          <div className="border-t border-fish-line/70 p-3">
            <FairnessCard
              roundNumber={round?.roundNumber ?? null}
              serverSeedHash={round?.serverSeedHash ?? null}
              clientSeed={round?.clientSeed ?? null}
              nonce={round?.nonce ?? null}
              houseEdge={round?.houseEdge ?? 0.05}
              target={verifyTarget}
              onTargetChange={setVerifyTarget}
            />
            <p className="mt-3 text-[11px] text-fish-muted">
              Aposta mínima {NUM.format(minBet)} MZN · máxima {NUM.format(maxBet)} MZN. O servidor é
              a autoridade sobre ronda, aposta, cash-out e saldo. Jogue com responsabilidade.
            </p>
          </div>
        </details>
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
    <div className="space-y-3 text-sm">
      <p className="text-fish-muted">
        O compromisso da ronda é publicado antes de as apostas abrirem. A semente do servidor só é
        revelada após o crash.
      </p>
      <dl className="space-y-1 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-fish-muted">Hash</dt>
          <dd className="truncate font-mono">{serverSeedHash ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-fish-muted">Client seed</dt>
          <dd className="font-mono">{clientSeed ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-fish-muted">Nonce</dt>
          <dd className="font-mono">{nonce ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-fish-muted">Vantagem da casa</dt>
          <dd className="font-mono">{(houseEdge * 100).toFixed(1)}%</dd>
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
      {result && <p className="text-xs">{result}</p>}
    </div>
  );
}
