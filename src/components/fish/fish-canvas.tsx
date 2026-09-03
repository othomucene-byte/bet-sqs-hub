import { GameStage } from "@/components/games/game-stage";
import { gameAssets } from "@/lib/games/assets";
import type { StageTheme } from "@/lib/games/stage";

export type FishStatus = "WAITING" | "BETTING" | "RUNNING" | "CRASHED" | "SETTLED";

const fishTheme: StageTheme = {
  medium: "water",
  background: gameAssets.fish.background,
  character: gameAssets.fish.character,
  characterWidth: 240,
  characterTilt: -0.05,
  line: "#00e07a",
  lineSoft: "rgba(0,224,122,0.35)",
  glow: "rgba(0,224,122,0.7)",
  crashLine: "#ff2d46",
  crashGlow: "rgba(255,45,70,0.32)",
  ambient: "rgba(60,190,255,0.22)",
};

/** Palco do Fish Crash: água profunda, peixe realista, bolhas e curva neon. */
export function FishCanvas({ status, multiplier }: { status: FishStatus; multiplier: number }) {
  return <GameStage theme={fishTheme} status={status} multiplier={multiplier} className="absolute inset-0 z-[2] size-full" />;
}
