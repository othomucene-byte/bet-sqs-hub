/**
 * Estado partilhado das mesas de jogada individual (Roda, Chicken, Leão).
 *
 * O hook só transporta pedidos e respostas: a jogada, o resultado, o
 * multiplicador e o prémio são sempre decididos e confirmados pelo servidor.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import * as sound from "@/lib/crash/sound";
import { useBetFunding } from "@/lib/promotions/use-bet-funding";
import {
  cashoutInstant,
  getInstantState,
  pickInstant,
  startInstantRound,
  type InstantGame,
  type InstantRoundView,
} from "@/lib/games/instant.functions";
import { getWallet } from "@/lib/wallet/wallet.functions";

export function useInstantGame(game: InstantGame) {
  const queryClient = useQueryClient();
  const fetchState = useServerFn(getInstantState);
  const fetchWallet = useServerFn(getWallet);
  const submitStart = useServerFn(startInstantRound);
  const submitPick = useServerFn(pickInstant);
  const submitCashout = useServerFn(cashoutInstant);

  const funding = useBetFunding();
  const [stake, setStake] = useState("50");
  /** Chicken: portas por nível. Leão: armadilhas na grelha. */
  const [difficulty, setDifficulty] = useState(3);
  const [lastResult, setLastResult] = useState<InstantRoundView | null>(null);

  const stateQuery = useQuery({
    queryKey: ["instant", game],
    queryFn: () => fetchState({ data: { game } }),
  });

  const walletQuery = useQuery({ queryKey: ["wallet"], queryFn: () => fetchWallet() });

  const refresh = () => {
    void stateQuery.refetch();
    void queryClient.invalidateQueries({ queryKey: ["wallet"] });
    funding.refresh();
  };

  const handle = (round: InstantRoundView) => {
    if (round.status === "open") {
      sound.playTick();
    } else if (round.status === "cashed_out" && (round.payout ?? 0) > 0) {
      sound.playCashout();
      setLastResult(round);
    } else {
      sound.playCrash();
      setLastResult(round);
    }
    refresh();
  };

  const startMutation = useMutation({
    mutationFn: async () => {
      const source = funding.resolve(1);
      const amount = Number(stake);
      return submitStart({
        data: {
          game,
          stake: Number.isFinite(amount) ? amount : 0,
          funding: source.funding,
          freeBetId: source.freeBetId,
          ...(game === "chicken" ? { doors: difficulty } : {}),
          ...(game === "lion" ? { traps: difficulty } : {}),
        },
      });
    },
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      sound.playBet();
      handle(result.round);
    },
    onError: () => toast.error("Não foi possível abrir a jogada. Tente de novo."),
  });

  const pickMutation = useMutation({
    mutationFn: async (pick: number) => {
      const current = stateQuery.data?.current;
      if (!current) throw new Error("sem jogada em curso");
      return submitPick({ data: { roundId: current.id, pick } });
    },
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      handle(result.round);
    },
    onError: () => toast.error("Escolha não registada. Tente de novo."),
  });

  const cashoutMutation = useMutation({
    mutationFn: async () => {
      const current = stateQuery.data?.current;
      if (!current) throw new Error("sem jogada em curso");
      return submitCashout({ data: { roundId: current.id } });
    },
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Prémio de ${(result.round.payout ?? 0).toFixed(2)} MZN na sua carteira.`);
      handle(result.round);
    },
    onError: () => toast.error("Não foi possível levantar. Tente de novo."),
  });

  return {
    current: stateQuery.data?.current ?? null,
    history: stateQuery.data?.history ?? [],
    limits: stateQuery.data?.limits ?? { minBet: 3, maxBet: 25_000, rtp: 0.97 },
    balance: walletQuery.data?.balance ?? null,
    loading: stateQuery.isLoading,
    busy: startMutation.isPending || pickMutation.isPending || cashoutMutation.isPending,
    stake,
    setStake,
    difficulty,
    setDifficulty,
    lastResult,
    funding,
    start: () => startMutation.mutate(),
    pick: (index: number) => pickMutation.mutate(index),
    cashout: () => cashoutMutation.mutate(),
  };
}
