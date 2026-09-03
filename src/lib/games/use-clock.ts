import { useEffect, useState } from "react";

/** Relógio local "HH:MM" para o topo do jogo (atualiza a cada 30s). */
export function useClock() {
  const [now, setNow] = useState("");
  useEffect(() => {
    const update = () =>
      setNow(
        new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit" }).format(
          new Date(),
        ),
      );
    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
