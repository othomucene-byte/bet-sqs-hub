import { GameStage } from "@/components/games/game-stage";
import { gameAssets } from "@/lib/games/assets";
import type { StageTheme } from "@/lib/games/stage";

export type FlightStatus = "WAITING" | "BETTING" | "RUNNING" | "CRASHED" | "SETTLED";

const aviatorTheme: StageTheme = {
  medium: "air",
  background: gameAssets.aviator.background,
  character: gameAssets.aviator.character,
  characterWidth: 250,
  characterTilt: -0.12,
  line: "#ff3b47",
  lineSoft: "rgba(255,59,71,0.32)",
  glow: "rgba(255,59,71,0.6)",
  crashLine: "#ff6b3d",
  crashGlow: "rgba(255,107,61,0.3)",
  ambient: "rgba(255,150,80,0.16)",
};

/** Palco do Aviator: cenário fotográfico, avião 3D e curva do multiplicador. */
export function FlightCanvas({
  status,
  multiplier,
}: {
  status: FlightStatus;
  multiplier: number;
  crashMultiplier?: number | null;
}) {
  return <GameStage theme={aviatorTheme} status={status} multiplier={multiplier} />;
}
