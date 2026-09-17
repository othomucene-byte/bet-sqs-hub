import { createFileRoute } from "@tanstack/react-router";

import { CrashScreen } from "@/components/games/crash-screen";
import { gameAssets } from "@/lib/games/assets";
import type { StageTheme } from "@/lib/games/stage";

export const Route = createFileRoute("/_authenticated/boost")({
  head: () => ({
    meta: [
      { title: "Boost Race Betfcom SQs — corrida verificável em meticais" },
      {
        name: "description",
        content:
          "Boost Race: o carro acelera e o multiplicador sobe até rebentar o motor. Ronda, aposta e cash-out decididos no servidor, com saldo real em meticais.",
      },
      { property: "og:title", content: "Boost Race Betfcom SQs" },
      {
        property: "og:description",
        content:
          "Aceleração contínua, cash-out validado no servidor e histórico de rondas verificável.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BoostPage,
});

const boostTheme: StageTheme = {
  medium: "air",
  fixedBackground: true,
  background: gameAssets.boost.background,
  character: gameAssets.boost.character,
  characterWidth: 250,
  characterTilt: -0.02,
  line: "#c026ff",
  lineSoft: "rgba(192,38,255,0.35)",
  glow: "rgba(192,38,255,0.75)",
  crashLine: "#ffab00",
  crashGlow: "rgba(255,171,0,0.35)",
  ambient: "rgba(150,60,255,0.24)",
};

function BoostPage() {
  return (
    <CrashScreen
      game="boost"
      title="Boost Race"
      accent="#c026ff"
      theme={boostTheme}
      crashLabel="MOTOR REBENTOU!"
    />
  );
}
