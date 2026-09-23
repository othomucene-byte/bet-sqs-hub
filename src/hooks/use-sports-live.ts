import { useEffect, useRef, useState } from "react";

export type LiveDelta = {
  id: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  elapsed: number | null;
  period: string | null;
};

type State = {
  connected: boolean;
  deltas: Record<string, LiveDelta>;
  lastMessageAt: string | null;
};

/**
 * Liga-se ao canal em tempo real da Betfcom SQs (SSE) e devolve apenas as
 * alterações recebidas. Se o canal cair, o navegador volta a ligar sozinho.
 */
export function useSportsLive(enabled = true, onChange?: () => void): State {
  const [state, setState] = useState<State>({ connected: false, deltas: {}, lastMessageAt: null });
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const source = new EventSource("/api/public/sports/stream");

    source.addEventListener("ready", () => {
      setState((prev) => ({ ...prev, connected: true }));
    });

    source.addEventListener("heartbeat", () => {
      setState((prev) => ({ ...prev, connected: true, lastMessageAt: new Date().toISOString() }));
    });

    source.addEventListener("matches", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as {
          matches: LiveDelta[];
        };
        setState((prev) => {
          const deltas = { ...prev.deltas };
          for (const match of payload.matches) deltas[match.id] = match;
          return { connected: true, deltas, lastMessageAt: new Date().toISOString() };
        });
        onChangeRef.current?.();
      } catch {
        /* mensagem ilegível é ignorada */
      }
    });

    source.onerror = () => {
      setState((prev) => ({ ...prev, connected: false }));
    };

    return () => source.close();
  }, [enabled]);

  return state;
}
