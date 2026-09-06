import { useEffect, useRef, useState } from "react";

type Slot = 1 | 2;
type SlotMap<T> = Record<Slot, T>;

const slots: Slot[] = [1, 2];

export function useAutoRounds({
  roundId,
  status,
  occupiedSlots,
  betsReady,
  place,
}: {
  roundId: string | null;
  status: string;
  occupiedSlots: Slot[];
  betsReady: boolean;
  place: (slot: Slot) => Promise<boolean>;
}) {
  const [rounds, setRounds] = useState<SlotMap<string>>({ 1: "5", 2: "5" });
  const [remaining, setRemaining] = useState<SlotMap<number>>({ 1: 0, 2: 0 });
  const [enabled, setEnabled] = useState<SlotMap<boolean>>({ 1: false, 2: false });
  const attempted = useRef<Partial<Record<Slot, string>>>({});
  const placeRef = useRef(place);
  placeRef.current = place;

  const setRoundCount = (slot: Slot, value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 3);
    setRounds((current) => ({ ...current, [slot]: digits }));
  };

  const toggle = (slot: Slot) => {
    if (enabled[slot]) {
      setEnabled((current) => ({ ...current, [slot]: false }));
      setRemaining((current) => ({ ...current, [slot]: 0 }));
      return;
    }
    const count = Math.min(999, Math.max(1, Number(rounds[slot]) || 1));
    setRounds((current) => ({ ...current, [slot]: String(count) }));
    setRemaining((current) => ({ ...current, [slot]: count }));
    setEnabled((current) => ({ ...current, [slot]: true }));
  };

  useEffect(() => {
    if (!roundId || status !== "BETTING" || !betsReady) return;

    for (const slot of slots) {
      if (!enabled[slot] || remaining[slot] <= 0 || occupiedSlots.includes(slot)) continue;
      if (attempted.current[slot] === roundId) continue;
      attempted.current[slot] = roundId;

      void placeRef.current(slot).then((ok) => {
        if (!ok) {
          setEnabled((current) => ({ ...current, [slot]: false }));
          setRemaining((current) => ({ ...current, [slot]: 0 }));
          return;
        }
        setRemaining((current) => {
          const next = Math.max(0, current[slot] - 1);
          if (next === 0) setEnabled((active) => ({ ...active, [slot]: false }));
          return { ...current, [slot]: next };
        });
      });
    }
  }, [betsReady, enabled, occupiedSlots, remaining, roundId, status]);

  return { rounds, remaining, enabled, setRoundCount, toggle };
}