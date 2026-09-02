import { useEffect, useRef } from "react";

import { startStage, type StageState, type StageStatus, type StageTheme } from "@/lib/games/stage";

export type { StageStatus, StageTheme };

/**
 * Palco de jogo (canvas). Puramente visual — o multiplicador chega já alinhado
 * ao relógio do servidor e o valor pago é sempre o que o servidor confirma.
 */
export function GameStage({
  theme,
  status,
  multiplier,
  className,
}: {
  theme: StageTheme;
  status: StageStatus;
  multiplier: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<StageState>({ status, multiplier });
  stateRef.current = { status, multiplier };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return startStage(canvas, theme, () => stateRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} className={className ?? "absolute inset-0 size-full"} aria-hidden />;
}
