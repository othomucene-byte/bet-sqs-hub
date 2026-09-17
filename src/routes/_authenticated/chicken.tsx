import { createFileRoute } from "@tanstack/react-router";

import { BigButton, InstantShell, StakeBar } from "@/components/games/instant-shell";
import { chickenMultiplier } from "@/lib/games/instant.functions";
import { useInstantGame } from "@/lib/games/use-instant-game";
import { cn } from "@/lib/utils";
import chickenHero from "@/assets/games/chicken-hero.png";

export const Route = createFileRoute("/_authenticated/chicken")({
  head: () => ({
    meta: [
      { title: "Chicken Choice Betfcom SQs — atravesse os níveis em meticais" },
      {
        name: "description",
        content:
          "Chicken Choice: escolha a porta segura em cada nível, o prémio sobe a cada passo e pode levantar quando quiser. Armadilhas seladas no servidor antes da escolha.",
      },
      { property: "og:title", content: "Chicken Choice Betfcom SQs" },
      {
        property: "og:description",
        content: "Portas seguras, prémio crescente e levantamento validado no servidor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChickenPage,
});

const ACCENT = "#00e07a";
const NUM = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function ChickenPage() {
  const game = useInstantGame("chicken");
  const round = game.current;
  const finished = game.lastResult;
  const doors = round?.config.doors ?? game.difficulty;
  const levels = round?.config.levels ?? 8;
  const step = round?.step ?? 0;
  const funding = game.funding.resolve(1);
  const potential = round ? round.stake * (round.nextMultiplier ?? 0) : 0;

  const showcase = round ?? finished;
  const revealed = !round && finished && finished.game === "chicken" ? finished : null;

  return (
    <InstantShell
      title="Chicken Choice"
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
              disabled={game.busy || step === 0}
              onClick={game.cashout}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-fish-muted">Portas por nível</span>
              {[2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => game.setDifficulty(value)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-bold",
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
                  label="Começar"
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
      <div className="rounded-2xl border border-fish-line/70 bg-gradient-to-b from-fish-panel to-fish-bg p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-fish-muted">
              Nível {Math.min(step + 1, levels)} de {levels}
            </p>
            <p className="font-display text-3xl font-black" style={{ color: ACCENT }}>
              {(showcase?.multiplier ?? 0.97).toFixed(2)}x
            </p>
            {round && (
              <p className="text-xs text-fish-muted">
                Se acertar: {(round.nextMultiplier ?? 0).toFixed(2)}x ·{" "}
                {NUM.format(potential)} MZN
              </p>
            )}
          </div>
          <img
            src={chickenHero}
            alt="Galo do Chicken Choice"
            loading="lazy"
            width={816}
            height={816}
            className="h-24 w-24 object-contain drop-shadow-[0_10px_24px_rgba(0,224,122,0.35)]"
          />
        </div>

        <div
          className="mt-4 grid gap-2"
          style={{ gridTemplateColumns: `repeat(${doors}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: doors }).map((_, index) => {
            const trapHere = revealed?.traps?.[revealed.step] === index;
            const pickedHere = revealed?.picks?.[revealed.step] === index;
            return (
              <button
                key={index}
                type="button"
                disabled={!round || game.busy}
                onClick={() => game.pick(index)}
                className={cn(
                  "grid aspect-[3/4] place-items-center rounded-xl border-2 text-2xl font-black transition",
                  round
                    ? "border-fish-line/70 bg-fish-step hover:border-[color:var(--fish-green)] active:scale-95"
                    : trapHere
                      ? "border-fish-red bg-fish-red/20"
                      : pickedHere
                        ? "border-[color:var(--fish-green)] bg-fish-green/15"
                        : "border-fish-line/40 bg-fish-panel/60 opacity-60",
                )}
              >
                {round ? (
                  <span className="text-fish-muted">?</span>
                ) : trapHere ? (
                  <span className="text-fish-red">✕</span>
                ) : (
                  <span className="text-fish-muted">·</span>
                )}
              </button>
            );
          })}
        </div>

        {!round && revealed && (
          <p
            className={cn(
              "mt-3 text-center text-sm font-bold",
              (revealed.payout ?? 0) > 0 ? "text-fish-green" : "text-fish-red",
            )}
          >
            {(revealed.payout ?? 0) > 0
              ? `Levantou ${NUM.format(revealed.payout ?? 0)} MZN a ${revealed.multiplier.toFixed(2)}x`
              : "Apanhou a armadilha. Tente outra vez."}
          </p>
        )}
        {!round && !revealed && (
          <p className="mt-3 text-center text-sm text-fish-muted">
            Escolha o valor e comece. Em cada nível, uma porta esconde a armadilha.
          </p>
        )}
      </div>

      <div className="mt-3 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {Array.from({ length: levels }).map((_, index) => (
          <span
            key={index}
            className={cn(
              "shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-bold tabular-nums",
              index < step
                ? "border-transparent bg-fish-green/20 text-fish-green"
                : "border-fish-line/70 bg-fish-panel/60 text-fish-muted",
            )}
          >
            N{index + 1} · {chickenMultiplier(doors, index + 1).toFixed(2)}x
          </span>
        ))}
      </div>
    </InstantShell>
  );
}
