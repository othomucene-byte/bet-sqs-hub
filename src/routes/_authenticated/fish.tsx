import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site-header";
import { FishCanvas, type FishStatus } from "@/components/fish/fish-canvas";
import { multiplierAt } from "@/lib/crash/fair";
import * as sound from "@/lib/crash/sound";
import { cashout, getCurrentRound, getMyBet, placeBet } from "@/lib/crash/crash.functions";
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
const QUICK: { label: string; value: number }[] = [
  { label: "50", value: 50 },
  { label: "100", value: 100 },
  { label: "500", value: 500 },
  { label: "1K", value: 1000 },
];

const statusText: Record<string, string> = {
  WAITING: "A PREPARAR",
  BETTING: "PRÓXIMA RODADA",
  RUNNING: "EM VOO",
  CRASHED: "FUGIU!",
  SETTLED: "RODADA LIQUIDADA",
};

function FishPage() {
  const queryClient = useQueryClient();
  const fetchRound = useServerFn(getCurrentRound);
  const fetchWallet = useServerFn(getWallet);
  const fetchBet = useServerFn(getMyBet);
  const submitBet = useServerFn(placeBet);
  const submitCashout = useServerFn(cashout);

  const roundQuery = useQuery({
    queryKey: ["crash", "round"],
    queryFn: () => fetchRound(),
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
  });

  const round = roundQuery.data?.round;
  const status = (round?.status ?? "WAITING") as FishStatus;
  const config = roundQuery.data?.config;

  const walletQuery = useQuery({ queryKey: ["wallet"], queryFn: () => fetchWallet() });
  const betQuery = useQuery({
    queryKey: ["crash", "bet", round?.id],
    queryFn: () => fetchBet({ data: { roundId: round!.id } }),
    enabled: Boolean(round?.id),
  });

  const [amounts, setAmounts] = useState(["50", "50", "50"]);
  const myBet = betQuery.data;

  const multiplier = useLiveMultiplier(
    status,
    round?.startedAt ?? null,
    round?.serverNow ?? null,
    round?.multiplier ?? 1,
    round?.crashMultiplier ?? null,
  );
  useFishAudio(status, multiplier);

  const placeMutation = useMutation({
    mutationFn: async (amount: number) => submitBet({ data: { roundId: round!.id, amount } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      sound.playBet();
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
      sound.playCashout();
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void betQuery.refetch();
    },
    onError: () => toast.error("Não foi possível fazer cash-out."),
  });

  const minBet = config?.minBet ?? 10;
  const maxBet = config?.maxBet ?? 25000;
  const countdown = Math.max(0, Math.ceil((round?.phaseMsRemaining ?? 0) / 1000));

  const setAmount = (index: number, value: string) =>
    setAmounts((prev) => prev.map((v, i) => (i === index ? value : v)));

  return (
    <div className="min-h-screen bg-fish-bg text-fish-foreground" onPointerDown={() => sound.ensureAudio()}>
      <SiteHeader />

      <div className="mx-auto w-full max-w-[1100px] p-2.5">
        {/* HEADER DO JOGO */}
        <div className="mb-2.5 flex h-[55px] items-center justify-between border-b border-fish-line bg-fish-panel px-4">
          <span className="font-display text-xl font-black text-fish-amber">🐟 FISH CRASH</span>
          <div className="rounded-lg border border-fish-input-border bg-fish-input px-3 py-2 text-sm font-bold">
            Saldo:{" "}
            <span className="text-fish-green tabular-nums">
              {walletQuery.data ? `${NUM.format(walletQuery.data.balance)} MZN` : "—"}
            </span>
          </div>
        </div>

        {/* PALCO */}
        <div
          className="relative h-[46vh] min-h-[300px] overflow-hidden rounded-xl border border-[#193b50] sm:h-[430px]"
          style={{
            background:
              "radial-gradient(circle at 20% 50%, #0b3752 0, #052034 40%, #031422 75%, #020d17 100%)",
            boxShadow: "inset 0 0 50px rgba(0,0,0,0.8)",
          }}
        >
          {/* Cenário submarino real */}
          <img
            src={fishScene.url}
            alt="Cenário submarino do Fish Crash"
            className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover opacity-30"
          />

          {/* Silhuetas de algas */}
          <div
            className="pointer-events-none absolute inset-0 z-[1] opacity-40"
            style={{
              background:
                "radial-gradient(circle at 90% 80%, #02121f 20%, transparent 40%), radial-gradient(circle at 80% 90%, #02121f 20%, transparent 40%), linear-gradient(to top, #02121f 0%, transparent 30%)",
            }}
          />

          <FishCanvas status={status} multiplier={multiplier} />

          {/* Estado no topo */}
          <div
            className="absolute left-1/2 top-[15px] z-10 -translate-x-1/2 rounded-[20px] border border-fish-green px-5 py-2 text-[13px] font-black tracking-widest"
            style={{ background: "rgba(3, 24, 38, 0.9)", color: "#00ffaa", boxShadow: "0 0 10px rgba(39,229,138,0.3)" }}
          >
            {status === "BETTING" ? `PRÓXIMA RODADA · ${countdown}s` : statusText[status]}
          </div>

          {/* Caixa do multiplicador */}
          <div
            className="pointer-events-none absolute right-[3%] top-[55%] z-[5] -translate-y-1/2 rounded-[15px] border-2 border-fish-green px-4 py-2 text-center sm:right-[8%] sm:border-[3px] sm:px-5 sm:py-3"
            style={{
              background: "rgba(3, 24, 38, 0.85)",
              boxShadow: "0 0 15px rgba(39,229,138,0.5), inset 0 0 10px rgba(0,0,0,0.5)",
            }}
          >
            <span
              className="font-display text-[30px] font-black tabular-nums tracking-tight text-fish-green sm:text-[38px]"
              style={{ textShadow: "0 0 10px #27e58a, 0 0 20px rgba(39,229,138,0.5)" }}
            >
              {multiplier.toFixed(2)}x
            </span>
          </div>
        </div>

        {/* APOSTAS */}
        <div className="mt-2.5 grid grid-cols-1 gap-2.5 md:grid-cols-3">
          {[0, 1, 2].map((index) => {
            const primary = index === 0;
            const amountNumber = Number(amounts[index]) || 0;
            const active = primary && myBet?.status === "active";
            const canBet =
              primary &&
              status === "BETTING" &&
              !myBet &&
              amountNumber >= minBet &&
              amountNumber <= maxBet;
            const locked = !primary || Boolean(myBet) || status !== "BETTING";

            const stateLabel = !primary
              ? "1 aposta por rodada"
              : active
                ? "Em jogo"
                : myBet?.status === "cashed_out"
                  ? `Levantado ${myBet.cashoutMultiplier?.toFixed(2)}x`
                  : myBet?.status === "lost"
                    ? "Perdida"
                    : status === "BETTING"
                      ? "Pronto"
                      : "Aguardar";

            return (
              <div
                key={index}
                className="rounded-xl border border-[#1b3b4f] bg-fish-panel p-2.5 sm:p-3"
              >
                <div className="mb-2.5 flex items-center justify-between">
                  <b className="text-sm">Aposta {index + 1}</b>
                  <span className="text-[11px] font-bold text-fish-muted">{stateLabel}</span>
                </div>

                <div className="mb-2 flex gap-1.5">
                  <button
                    type="button"
                    aria-label="Diminuir"
                    disabled={locked}
                    onClick={() => setAmount(index, String(Math.max(minBet, amountNumber - 10)))}
                    className="w-[38px] rounded-[7px] bg-fish-step text-lg text-fish-foreground disabled:opacity-45"
                  >
                    −
                  </button>
                  <input
                    inputMode="decimal"
                    aria-label={`Valor da aposta ${index + 1}`}
                    value={amounts[index]}
                    disabled={locked}
                    onChange={(e) => setAmount(index, e.target.value)}
                    className="min-w-0 flex-1 rounded-[7px] border border-fish-input-border bg-fish-input py-2 text-center text-base font-bold tabular-nums text-fish-foreground outline-none disabled:opacity-45"
                  />
                  <button
                    type="button"
                    aria-label="Aumentar"
                    disabled={locked}
                    onClick={() => setAmount(index, String(Math.min(maxBet, amountNumber + 10)))}
                    className="w-[38px] rounded-[7px] bg-fish-step text-lg text-fish-foreground disabled:opacity-45"
                  >
                    +
                  </button>
                </div>

                <div className="mb-2.5 flex gap-1.5">
                  {QUICK.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      disabled={locked}
                      onClick={() => setAmount(index, String(chip.value))}
                      className="flex-1 rounded-md bg-fish-quick px-1 py-1.5 text-[11px] text-fish-quick-foreground disabled:opacity-45"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {active ? (
                  <button
                    type="button"
                    disabled={status !== "RUNNING" || cashoutMutation.isPending}
                    onClick={() => myBet && cashoutMutation.mutate(myBet.id)}
                    className="h-[43px] w-full rounded-lg text-sm font-black text-fish-ink disabled:opacity-45"
                    style={{ background: "linear-gradient(90deg, #ffb21c, #ff8c1c)", color: "#000" }}
                  >
                    LEVANTAR {NUM.format(myBet.amount * multiplier)}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!canBet || placeMutation.isPending}
                    onClick={() => placeMutation.mutate(amountNumber)}
                    className="h-[43px] w-full rounded-lg bg-fish-green text-sm font-black text-fish-ink transition disabled:opacity-45"
                  >
                    APOSTAR
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* HISTÓRICO */}
        <div className="mt-2.5 rounded-xl border border-[#193346] bg-fish-panel p-3">
          <div className="mb-2 flex justify-between">
            <b className="text-[13px]">Histórico</b>
            <span className="text-[13px] text-fish-muted">Últimas rodadas</span>
          </div>
          <div className="flex gap-[7px] overflow-x-auto">
            {(roundQuery.data?.history ?? []).length === 0 && (
              <span className="text-xs text-fish-muted">Sem rodadas terminadas ainda.</span>
            )}
            {(roundQuery.data?.history ?? []).map((item) => (
              <span
                key={item.roundNumber}
                className={`flex-none rounded-[7px] bg-fish-chip px-2.5 py-1.5 text-xs font-bold tabular-nums ${
                  (item.multiplier ?? 0) >= 2 ? "text-fish-green" : "text-fish-chip-foreground"
                }`}
              >
                {(item.multiplier ?? 0).toFixed(2)}x
              </span>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-fish-muted">
            Ronda #{round?.roundNumber ?? "—"} · o servidor é a autoridade sobre rodada, aposta,
            cash-out e saldo. Mínimo {minBet} MZN.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Interpola o multiplicador entre respostas do servidor. */
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
      setValue(multiplierAt(Date.now() + offsetRef.current - started));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [status, startedAt, serverMultiplier, crashMultiplier]);

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
