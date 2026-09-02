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
  line: "#27e58a",
  lineSoft: "rgba(39,229,138,0.3)",
  glow: "rgba(39,229,138,0.6)",
  crashLine: "#ff5d5d",
  crashGlow: "rgba(255,93,93,0.28)",
  ambient: "rgba(80,190,255,0.16)",
};

/** Palco do Fish Crash: água profunda, peixe realista, bolhas e curva neon. */
export function FishCanvas({ status, multiplier }: { status: FishStatus; multiplier: number }) {
  return <GameStage theme={fishTheme} status={status} multiplier={multiplier} className="absolute inset-0 z-[2] size-full" />;
}
