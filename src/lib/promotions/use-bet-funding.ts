import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import type { BetFunding } from "@/components/games/bet-pad";
import { getBonusState, type FreeBetView } from "@/lib/promotions/promotions.functions";

const NUM = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 });

/**
 * Escolha da origem da aposta (saldo real, saldo bónus jogável ou aposta grátis)
 * para os dois painéis dos jogos de crash. O servidor revalida sempre a origem.
 */
export function useBetFunding() {
  const fetchState = useServerFn(getBonusState);
  const query = useQuery({
    queryKey: ["bonus-state"],
    queryFn: () => fetchState(),
    refetchInterval: 30_000,
  });

  const [selected, setSelected] = useState<Record<1 | 2, BetFunding>>({
    1: "wallet",
    2: "wallet",
  });

  const bonusBalance = query.data?.bonusBalance ?? 0;
  const freeBets: FreeBetView[] = query.data?.freeBets ?? [];

  const options = useMemo(() => {
    const list: { key: BetFunding; label: string }[] = [{ key: "wallet", label: "Saldo" }];
    if (bonusBalance > 0) list.push({ key: "bonus", label: `Bónus ${NUM.format(bonusBalance)}` });
    if (freeBets.length) list.push({ key: "free_bet", label: `Grátis ${freeBets.length}` });
    return list;
  }, [bonusBalance, freeBets.length]);

  /** Origem efetiva para um painel, já validada contra o que está disponível. */
  const resolve = (slot: 1 | 2) => {
    const funding = options.some((option) => option.key === selected[slot])
      ? selected[slot]
      : ("wallet" as BetFunding);
    const freeBet = funding === "free_bet" ? (freeBets[0] ?? null) : null;
    return { funding, freeBet, freeBetId: freeBet?.id ?? null };
  };

  return {
    options,
    selected,
    setFunding: (slot: 1 | 2, next: BetFunding) =>
      setSelected((prev) => ({ ...prev, [slot]: next })),
    resolve,
    bonusBalance,
    freeBets,
    refresh: () => void query.refetch(),
  };
}
