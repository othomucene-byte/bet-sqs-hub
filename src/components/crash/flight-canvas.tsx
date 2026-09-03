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
  line: "#ff2d46",
  lineSoft: "rgba(255,45,70,0.38)",
  glow: "rgba(255,45,70,0.75)",
  crashLine: "#ffab00",
  crashGlow: "rgba(255,171,0,0.35)",
  ambient: "rgba(255,120,40,0.22)",
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
