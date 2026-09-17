import { createFileRoute } from "@tanstack/react-router";

import { BigButton, InstantShell, StakeBar } from "@/components/games/instant-shell";
import { useInstantGame } from "@/lib/games/use-instant-game";
import { cn } from "@/lib/utils";
import jungleBg from "@/assets/games/jungle-bg.jpg";
import lionHero from "@/assets/games/lion-hero.png";

export const Route = createFileRoute("/_authenticated/leao")({
  head: () => ({
    meta: [
      { title: "Leão Rei da Selva Betfcom SQs — caça na grelha em meticais" },
      {
        name: "description",
        content:
          "Leão Rei da Selva: abra casas seguras na grelha da selva e veja o prémio subir. Armadilhas seladas no servidor antes da primeira escolha e prémio pago em meticais.",
      },
      { property: "og:title", content: "Leão Rei da Selva — Betfcom SQs" },
      {
        property: "og:description",
        content: "Grelha de 25 casas, armadilhas seladas no servidor e prémio crescente em meticais.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LionPage,
});

const ACCENT = "#ffab00";
const NUM = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function LionPage() {
  const game = useInstantGame("lion");
  const round = game.current;
  const finished = !round && game.lastResult?.game === "lion" ? game.lastResult : null;
  const view = round ?? finished;
  const traps = round?.config.traps ?? game.difficulty;
  const picks = view?.picks ?? [];
  const funding = game.funding.resolve(1);

  return (
    <InstantShell
      title="Leão Rei da Selva"
      accent={ACCENT}
      balance={game.balance}
      history={game.history}
      footer={
        round ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-fish-line/70 bg-fish-step px-3 py-2">
              <p className="text-[11px] text-fish-muted">Prémio atual</p>
              <p className="text-lg font-black tabular-nums" style={{ color: ACCENT }}>
                {NUM.format(round.stake * round.multiplier)} MZN
              </p>
            </div>
            <BigButton
              label="Levantar"
              sub={`${round.multiplier.toFixed(2)}x`}
              tone={ACCENT}
              disabled={game.busy || round.step === 0}
              onClick={game.cashout}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <span className="shrink-0 text-[11px] text-fish-muted">Armadilhas</span>
              {[1, 3, 5, 7, 10].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => game.setDifficulty(value)}
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold",
                    game.difficulty === value
                      ? "border-transparent text-fish-bg"
                      : "border-fish-line/70 bg-fish-step text-fish-muted",
                  )}
                  style={game.difficulty === value ? { backgroundColor: ACCENT } : undefined}
                >
                  {value}
                </button>
              ))}
            </div>
            <StakeBar
              stake={game.stake}
              setStake={game.setStake}
              accent={ACCENT}
              disabled={game.busy}
              options={game.funding.options}
              selected={funding.funding}
              onFunding={(value) => game.funding.setFunding(1, value)}
              action={
                <BigButton
                  label="Caçar"
                  sub={`${NUM.format(Number(game.stake) || 0)} MZN`}
                  tone={ACCENT}
                  disabled={game.busy}
                  onClick={game.start}
                />
              }
            />
          </div>
        )
      }
    >
      <div
        className="relative overflow-hidden rounded-2xl border border-fish-line/70 p-4"
        style={{
          backgroundImage: `url(${jungleBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-fish-bg/60" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-fish-muted">
                {traps} armadilhas · {picks.length} casas abertas
              </p>
              <p className="font-display text-3xl font-black" style={{ color: ACCENT }}>
                {(view?.multiplier ?? 0.97).toFixed(2)}x
              </p>
              {round && (
                <p className="text-xs text-fish-muted">
                  Casa seguinte: {(round.nextMultiplier ?? 0).toFixed(2)}x
                </p>
              )}
            </div>
            <img
              src={lionHero}
              alt="Leão Rei da Selva"
              loading="lazy"
              width={816}
              height={816}
              className="h-24 w-24 object-contain drop-shadow-[0_10px_24px_rgba(255,171,0,0.35)]"
            />
          </div>

          <div className="mt-4 grid grid-cols-5 gap-2">
            {Array.from({ length: 25 }).map((_, index) => {
              const picked = picks.includes(index);
              const isTrap = finished?.traps?.includes(index) ?? false;
              return (
                <button
                  key={index}
                  type="button"
                  disabled={!round || game.busy || picked}
                  onClick={() => game.pick(index)}
                  aria-label={`Casa ${index + 1}`}
                  className={cn(
                    "grid aspect-square place-items-center rounded-xl border-2 text-lg font-black transition",
                    picked && isTrap
                      ? "border-fish-red bg-fish-red/25 text-fish-red"
                      : picked
                        ? "border-[color:var(--fish-amber)] bg-fish-amber/20 text-fish-amber"
                        : isTrap
                          ? "border-fish-red/50 bg-fish-red/10 text-fish-red/70"
                          : round
                            ? "border-fish-line/70 bg-fish-step/90 text-fish-muted hover:border-[color:var(--fish-amber)] active:scale-95"
                            : "border-fish-line/40 bg-fish-panel/70 text-fish-muted opacity-70",
                  )}
                >
                  {picked && isTrap ? "✕" : picked ? "★" : isTrap ? "✕" : "·"}
                </button>
              );
            })}
          </div>

          {finished && (
            <p
              className={cn(
                "mt-3 text-center text-sm font-bold",
                (finished.payout ?? 0) > 0 ? "text-fish-green" : "text-fish-red",
              )}
            >
              {(finished.payout ?? 0) > 0
                ? `Levantou ${NUM.format(finished.payout ?? 0)} MZN a ${finished.multiplier.toFixed(2)}x`
                : "A armadilha apanhou o leão. Tente outra vez."}
            </p>
          )}
          {!round && !finished && (
            <p className="mt-3 text-center text-sm text-fish-muted">
              Escolha o valor e comece a caça. Cada casa segura aumenta o prémio.
            </p>
          )}
        </div>
      </div>
    </InstantShell>
  );
}
