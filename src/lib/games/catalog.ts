/**
 * Catálogo das mesas — usado pelo lobby `/jogos`.
 * Só metadados de apresentação; regras e dinheiro vivem no servidor.
 */
import chickenHero from "@/assets/games/chicken-hero.png";
import jungleBg from "@/assets/games/jungle-bg.jpg";
import lionHero from "@/assets/games/lion-hero.png";
import wheelBg from "@/assets/games/wheel-bg.jpg";

import { gameAssets } from "@/lib/games/assets";

export type GameCard = {
  slug: string;
  href: string;
  name: string;
  studio: string;
  kind: "Crash" | "Instantâneo";
  background: string;
  character?: string;
  accent: string;
};

export const gameCatalog: GameCard[] = [
  {
    slug: "aviator",
    href: "/crash",
    name: "Aviator",
    studio: "Betfcom SQs",
    kind: "Crash",
    background: gameAssets.aviator.background,
    character: gameAssets.aviator.character,
    accent: "#ff2d46",
  },
  {
    slug: "fish",
    href: "/fish",
    name: "Fish Crash",
    studio: "Betfcom SQs",
    kind: "Crash",
    background: gameAssets.fish.background,
    character: gameAssets.fish.character,
    accent: "#28e0d0",
  },
  {
    slug: "navigator",
    href: "/navigator",
    name: "Navigator",
    studio: "Betfcom SQs",
    kind: "Crash",
    background: gameAssets.navigator.background,
    character: gameAssets.navigator.character,
    accent: "#28e0d0",
  },
  {
    slug: "boost",
    href: "/boost",
    name: "Boost Race",
    studio: "Betfcom SQs",
    kind: "Crash",
    background: gameAssets.boost.background,
    character: gameAssets.boost.character,
    accent: "#c026ff",
  },
  {
    slug: "wheel",
    href: "/roda",
    name: "Roda da Betfcom",
    studio: "Betfcom SQs",
    kind: "Instantâneo",
    background: wheelBg,
    accent: "#ffab00",
  },
  {
    slug: "chicken",
    href: "/chicken",
    name: "Chicken Choice",
    studio: "Betfcom SQs",
    kind: "Instantâneo",
    background: jungleBg,
    character: chickenHero,
    accent: "#00e07a",
  },
  {
    slug: "lion",
    href: "/leao",
    name: "Leão Rei da Selva",
    studio: "Betfcom SQs",
    kind: "Instantâneo",
    background: jungleBg,
    character: lionHero,
    accent: "#ffab00",
  },
];
