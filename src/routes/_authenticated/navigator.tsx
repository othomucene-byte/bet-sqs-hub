import { createFileRoute } from "@tanstack/react-router";

import { CrashScreen } from "@/components/games/crash-screen";
import { gameAssets } from "@/lib/games/assets";
import type { StageTheme } from "@/lib/games/stage";

export const Route = createFileRoute("/_authenticated/navigator")({
  head: () => ({
    meta: [
      { title: "Navigator Betfcom SQs — travessia verificável em meticais" },
      {
        name: "description",
        content:
          "Navigator: a lancha avança e o multiplicador sobe até à tempestade. Ronda, aposta e cash-out decididos no servidor, com saldo real em meticais.",
      },
      { property: "og:title", content: "Navigator Betfcom SQs" },
      {
        property: "og:description",
        content:
          "Multiplicador crescente sobre o mar aberto, cash-out validado no servidor e histórico de rondas verificável.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NavigatorPage,
});

const navigatorTheme: StageTheme = {
  medium: "water",
  background: gameAssets.navigator.background,
  character: gameAssets.navigator.character,
  characterWidth: 260,
  characterTilt: -0.04,
  line: "#28e0d0",
  lineSoft: "rgba(40,224,208,0.35)",
  glow: "rgba(40,224,208,0.7)",
  crashLine: "#ff2d46",
  crashGlow: "rgba(255,45,70,0.32)",
  ambient: "rgba(40,180,230,0.22)",
};

function NavigatorPage() {
  return (
    <CrashScreen
      game="navigator"
      title="Navigator"
      accent="#28e0d0"
      theme={navigatorTheme}
      crashLabel="A TEMPESTADE CHEGOU!"
    />
  );
}
