import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

import { FishCanvas, type FishStatus } from "@/components/fish/fish-canvas";
import { BetPad } from "@/components/games/bet-pad";
import { GameTopBar, HistoryStrip, TotalsBar } from "@/components/games/game-chrome";
import { RoundStats } from "@/components/crash/round-stats";
import { useClock } from "@/lib/games/use-clock";
import { useAutoRounds } from "@/lib/games/use-auto-rounds";
import { useBetFunding } from "@/lib/promotions/use-bet-funding";
import { multiplierAt } from "@/lib/crash/fair";
import * as sound from "@/lib/crash/sound";
import {
  cashout,
  getCurrentRound,
  getMyBets,
  getRoundStats,
  placeBet,
} from "@/lib/crash/crash.functions";
import { getWallet } from "@/lib/wallet/wallet.functions";

export const Route = createFileRoute("/_authenticated/fish")({
  head: () => ({
    meta: [
      { title: "Fish Crash BETFCOM SQs — ronda verificável em meticais" },
      {
        name: "description",
        content:
          "Fish Crash: o peixe sobe com o multiplicador e o servidor decide a ronda, a aposta e o cash-out. Saldo real da carteira de apostas em meticais.",
      },
      { property: "og:title", content: "Fish Crash BETFCOM SQs" },
      {
        property: "og:description",
        content:
          "Multiplicador crescente, cash-out validado no servidor e histórico de rondas verificável.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FishPage,
});

const NUM = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function FishPage() {
  const queryClient = useQueryClient();
  const fetchRound = useServerFn(getCurrentRound);
  const fetchWallet = useServerFn(getWallet);
  const fetchBets = useServerFn(getMyBets);
  const fetchStats = useServerFn(getRoundStats);
  const submitBet = useServerFn(placeBet);
  const submitCashout = useServerFn(cashout);

  const roundQuery = useQuery({
    queryKey: ["fish", "round"],
    queryFn: () => fetchRound({ data: { game: "fish" } }),
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
  });

  const round = roundQuery.data?.round;
  const status = (round?.status ?? "WAITING") as FishStatus;
  const config = roundQuery.data?.config;

  const walletQuery = useQuery({ queryKey: ["wallet"], queryFn: () => fetchWallet() });
  const betQuery = useQuery({
    queryKey: ["fish", "bets", round?.id],
    queryFn: () => fetchBets({ data: { roundId: round!.id } }),
    enabled: Boolean(round?.id),
  });
  const statsQuery = useQuery({
    queryKey: ["fish", "stats", round?.id],
    queryFn: () => fetchStats({ data: { roundId: round!.id } }),
    enabled: Boolean(round?.id),
    refetchInterval: 3000,
  });

  const [amounts, setAmounts] = useState<Record<1 | 2, string>>({ 1: "50", 2: "50" });
  const [autoValues, setAutoValues] = useState<Record<1 | 2, string>>({ 1: "2.00", 2: "2.00" });
  const [autoEnabled, setAutoEnabled] = useState<Record<1 | 2, boolean>>({ 1: false, 2: false });
  const [muted, setMutedState] = useState(false);
  const clock = useClock();
  const bets = betQuery.data ?? [];

  const multiplier = useLiveMultiplier(
    status,
    round?.startedAt ?? null,
    round?.serverNow ?? null,
    round?.multiplier ?? 1,
    round?.crashMultiplier ?? null,
  );
  useFishAudio(status, multiplier);

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
    mutationFn: async (input: { slot: 1 | 2; amount: number; funding: "wallet" | "bonus" | "free_bet"; freeBetId: string | null }) =>
      submitBet({
        data: {
          roundId: round!.id,
          amount: input.amount,
          slot: input.slot,
          funding: input.funding,
          freeBetId: input.freeBetId,
          autoCashout: autoEnabled[input.slot] && Number(autoValues[input.slot]) > 1 ? Number(autoValues[input.slot]) : null,
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

  const minBet = config?.minBet ?? 3;
  const maxBet = config?.maxBet ?? 25000;
  
  // Atualiza o saldo assim que a liquidação automática é processada no crash.
  useEffect(() => {
    if (status === "CRASHED" || status === "SETTLED") {
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
    }
  }, [status, queryClient]);

  const countdown = Math.max(0, Math.ceil((round?.phaseMsRemaining ?? 0) / 1000));

  const betFunding = useBetFunding();
  const betForSlot = (slot: 1 | 2) => bets.find((bet) => bet.slot === slot) ?? null;
  const placeForSlot = async (slot: 1 | 2) => {
    const amount = Number(amounts[slot]);
    const autoTarget = Number(autoValues[slot]);
    if (!Number.isFinite(amount) || amount < minBet || amount > maxBet) {
      toast.error(`A aposta deve estar entre ${NUM.format(minBet)} e ${NUM.format(maxBet)} MZN.`);
      return false;
    }
    if (autoEnabled[slot] && (!Number.isFinite(autoTarget) || autoTarget < 1.01 || autoTarget > 10000)) {
      toast.error("O levantamento automático deve estar entre 1,01x e 10 000x.");
      return false;
    }
    const source = betFunding.resolve(slot);
    if (source.funding === "free_bet" && source.freeBet) {
      const { minAmount, maxAmount } = source.freeBet;
      if (amount < minAmount || amount > maxAmount) {
        toast.error(
          `A aposta grátis vale entre ${NUM.format(minAmount)} e ${NUM.format(maxAmount)} MZN.`,
        );
        return false;
      }
    }
    try {
      const result = await placeMutation.mutateAsync({
        slot,
        amount,
        funding: source.funding,
        freeBetId: source.freeBetId,
      });
      if (result.ok) betFunding.refresh();
      return result.ok;
    } catch {
      return false;
    }
  };
  const autoRounds = useAutoRounds({
    roundId: round?.id ?? null,
    status,
    occupiedSlots: bets.map((bet) => bet.slot),
    betsReady: !betQuery.isPending && !placeMutation.isPending,
    place: placeForSlot,
  });
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
        title="Fish Crash"
        accent="#ffab00"
        balance={walletQuery.data?.balance ?? null}
        clock={clock}
        muted={muted}
        onToggleMute={toggleMute}
      />
      <HistoryStrip items={roundQuery.data?.history ?? []} />

      <main className="mx-auto w-full max-w-[820px] flex-1 px-2.5 pb-4">
        {/* PALCO */}
        <section className="relative mt-2 h-[34dvh] min-h-[205px] max-h-[300px] overflow-hidden rounded-xl border border-fish-line/70 bg-fish-bg sm:h-[340px] sm:max-h-none">
          <FishCanvas status={status} multiplier={multiplier} />

          <div className="pointer-events-none absolute inset-0 z-[5] flex flex-col items-center justify-center px-4 text-center">
            {status === "CRASHED" && (
              <p className="font-display text-lg font-bold tracking-wide text-fish-foreground/90 sm:text-2xl">
                O PEIXE FUGIU!
              </p>
            )}
            <p
              className={`font-display text-[52px] font-black leading-none tabular-nums sm:text-[76px] ${
                status === "CRASHED" ? "text-fish-red" : "text-fish-green"
              }`}
              style={{
                textShadow:
                  status === "CRASHED"
                    ? "0 6px 30px rgba(0,0,0,0.65)"
                    : "0 0 14px rgba(0,224,122,0.65)",
              }}
            >
              {multiplier.toFixed(2)}
              <span className="text-[0.6em]">x</span>
            </p>

            {status === "BETTING" && (
              <div className="mt-4 w-[min(320px,80%)] rounded-2xl border border-white/10 bg-black/45 px-4 py-3 backdrop-blur-sm">
                <p className="text-[11px] font-bold uppercase tracking-widest text-fish-muted">
                  A aguardar pela próxima ronda
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-fish-green transition-[width] duration-1000 ease-linear"
                    style={{ width: `${Math.min(100, (countdown / 8) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <span className="absolute left-3 top-3 z-[5] rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-fish-muted">
            Ronda #{round?.roundNumber ?? "—"}
          </span>
        </section>

        {/* APOSTAS */}
        <div className="mt-2 grid gap-2 md:grid-cols-2">
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
                cashoutValue={(bet?.amount ?? 0) * multiplier}
                busy={placeMutation.isPending || cashoutMutation.isPending}
                onPlace={() => void placeForSlot(slot)}
                onCashout={() => bet && cashoutMutation.mutate(bet.id)}
                funding={betFunding.selected[slot]}
                fundingOptions={betFunding.options}
                onFunding={(next) => betFunding.setFunding(slot, next)}
                autoPlay={autoRounds.enabled[slot]}
                autoPlayRounds={autoRounds.rounds[slot]}
                autoPlayRemaining={autoRounds.remaining[slot]}
                autoCashout={autoEnabled[slot]}
                autoCashoutValue={autoValues[slot]}
                onToggleAutoPlay={() => autoRounds.toggle(slot)}
                onAutoPlayRounds={(next) => autoRounds.setRoundCount(slot, next)}
                onToggleAutoCashout={() => setAutoEnabled((prev) => ({ ...prev, [slot]: !prev[slot] }))}
                onAutoCashoutValue={(next) => setAutoValues((prev) => ({ ...prev, [slot]: next }))}
              />
            );
          })}
        </div>

        <RoundStats
          bets={statsQuery.data?.bets ?? []}
          top={statsQuery.data?.top ?? []}
          myBets={statsQuery.data?.myBets ?? []}
          totalStaked={statsQuery.data?.totalStaked ?? 0}
          totalPaid={statsQuery.data?.totalPaid ?? 0}
        />

        <TotalsBar
          totalBets={statsQuery.data?.totalBets ?? 0}
          staked={statsQuery.data?.totalStaked ?? 0}
          paid={statsQuery.data?.totalPaid ?? 0}
        />

        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-fish-muted">
          <ShieldCheck className="mt-[1px] size-3.5 shrink-0 text-fish-green" />
          Aposta mínima {NUM.format(minBet)} MZN · máxima {NUM.format(maxBet)} MZN. O servidor é a
          autoridade sobre ronda, aposta, cash-out e saldo. Jogue com responsabilidade.
        </p>
      </main>
    </div>
  );
}

/**
 * Interpola o multiplicador entre respostas do servidor e congela no instante
 * exato do fim da ronda (o servidor diz quanto tempo falta).
 */
function useLiveMultiplier(
  status: string,
  startedAt: string | null,
  serverNow: string | null,
  serverMultiplier: number,
  crashMultiplier: number | null,
  phaseMsRemaining: number,
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
    const deadline = Date.now() + offsetRef.current + Math.max(0, phaseMsRemaining);
    let frame = 0;
    const tick = () => {
      const serverTime = Math.min(Date.now() + offsetRef.current, deadline);
      setValue(multiplierAt(serverTime - started));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [status, startedAt, serverMultiplier, crashMultiplier, phaseMsRemaining]);

  return value;
}


/** Som sintetizado ligado às transições da rodada. */
function useFishAudio(status: FishStatus, multiplier: number) {
  const previous = useRef<FishStatus | null>(null);

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
}
