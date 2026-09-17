import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Heart } from "lucide-react";

import { gameCatalog } from "@/lib/games/catalog";

export const Route = createFileRoute("/_authenticated/jogos")({
  head: () => ({
    meta: [
      { title: "Jogos Betfcom SQs — escolha a sua mesa em meticais" },
      {
        name: "description",
        content:
          "Todas as mesas Betfcom SQs num só ecrã: Aviator, Fish Crash, Navigator, Boost Race, Roda da Betfcom, Chicken Choice e Leão Rei da Selva, com saldo real em meticais.",
      },
      { property: "og:title", content: "Jogos Betfcom SQs" },
      {
        property: "og:description",
        content: "Escolha a mesa e jogue com saldo real, com resultado selado pelo servidor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GamesLobby,
});

const FILTERS = ["Todos", "Crash", "Instantâneo", "Favoritos"] as const;

function GamesLobby() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Todos");
  const [favourites, setFavourites] = useState<string[]>([]);

  const toggle = (slug: string) =>
    setFavourites((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));

  const visible = gameCatalog.filter((game) => {
    if (filter === "Todos") return true;
    if (filter === "Favoritos") return favourites.includes(game.slug);
    return game.kind === filter;
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-3 pb-16 pt-4 sm:px-5">
      <h1 className="text-xl font-semibold sm:text-2xl">Jogos</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Escolha a mesa. Cada ronda é selada pelo servidor antes da jogada e o dinheiro move-se sempre
        pela carteira de apostas, em meticais.
      </p>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              filter === item
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((game) => (
          <div key={game.slug} className="group relative">
            <Link
              to={game.href}
              className="block overflow-hidden rounded-2xl border border-border/60 bg-card shadow-lg transition group-hover:-translate-y-0.5 group-hover:shadow-xl"
            >
              <div className="relative aspect-[3/4]">
                <img
                  src={game.background}
                  alt={`Cenário do jogo ${game.name}`}
                  loading="lazy"
                  className="absolute inset-0 size-full object-cover"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(180deg, rgba(3,7,18,0.15) 0%, rgba(3,7,18,0.55) 55%, rgba(3,7,18,0.94) 100%)`,
                  }}
                />
                {game.character && (
                  <img
                    src={game.character}
                    alt=""
                    loading="lazy"
                    aria-hidden
                    className="absolute left-1/2 top-[42%] w-[78%] -translate-x-1/2 -translate-y-1/2 drop-shadow-2xl"
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 p-2.5 text-center">
                  <p
                    className="text-sm font-semibold leading-tight text-white"
                    style={{ textShadow: `0 2px 12px ${game.accent}` }}
                  >
                    {game.name}
                  </p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-white/60">
                    {game.studio}
                  </p>
                </div>
              </div>
            </Link>
            <button
              type="button"
              aria-label={
                favourites.includes(game.slug)
                  ? `Remover ${game.name} dos favoritos`
                  : `Guardar ${game.name} nos favoritos`
              }
              onClick={() => toggle(game.slug)}
              className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/45 backdrop-blur transition hover:bg-black/65"
            >
              <Heart
                className={`size-4 ${favourites.includes(game.slug) ? "fill-white text-white" : "text-white/85"}`}
              />
            </button>
          </div>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Ainda não guardou mesas favoritas. Toque no coração de um jogo para o guardar aqui.
        </p>
      )}
    </main>
  );
}
