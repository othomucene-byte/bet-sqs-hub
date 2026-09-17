import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { BigButton, InstantShell, StakeBar } from "@/components/games/instant-shell";
import { WheelCanvas } from "@/components/games/wheel-canvas";
import { useInstantGame } from "@/lib/games/use-instant-game";
import { WHEEL_LAYOUT } from "@/lib/games/instant.functions";
import wheelBg from "@/assets/games/wheel-bg.jpg";

export const Route = createFileRoute("/_authenticated/roda")({
  head: () => ({
    meta: [
      { title: "Roda da Betfcom — giro verificável em meticais" },
      {
        name: "description",
        content:
          "Roda da Betfcom: 20 setores com multiplicadores fixos, resultado selado pelo servidor antes do giro e prémio pago em meticais na sua carteira.",
      },
      { property: "og:title", content: "Roda da Betfcom" },
      {
        property: "og:description",
        content: "Giro com resultado selado no servidor, multiplicadores fixos e prémio em meticais.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WheelPage,
});

const ACCENT = "#ffab00";
const NUM = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function WheelPage() {
  const game = useInstantGame("wheel");
  const [spinKey, setSpinKey] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [shown, setShown] = useState<{ multiplier: number; payout: number } | null>(null);
  const result = game.lastResult;

  useEffect(() => {
    if (!result || result.game !== "wheel" || result.sector === null) return;
    setShown(null);
    setSpinning(true);
    setSpinKey((value) => value + 1);
  }, [result?.id]);

  const funding = game.funding.resolve(1);

  return (
    <InstantShell
      title="Roda da Betfcom"
      accent={ACCENT}
      balance={game.balance}
      history={game.history}
      footer={
        <StakeBar
          stake={game.stake}
          setStake={game.setStake}
          accent={ACCENT}
          disabled={spinning || game.busy}
          options={game.funding.options}
          selected={funding.funding}
          onFunding={(value) => game.funding.setFunding(1, value)}
          action={
            <BigButton
              label={spinning ? "A girar…" : "Girar"}
              sub={`${NUM.format(Number(game.stake) || 0)} MZN`}
              tone={ACCENT}
              disabled={spinning || game.busy}
              onClick={game.start}
            />
          }
        />
      }
    >
      <div
        className="relative overflow-hidden rounded-2xl border border-fish-line/70 p-4"
        style={{
          backgroundImage: `url(${wheelBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-fish-bg/55" />
        <div className="relative">
          <WheelCanvas
            target={result?.sector ?? null}
            spinKey={spinKey}
            onSettled={() => {
              setSpinning(false);
              if (result) setShown({ multiplier: result.multiplier, payout: result.payout ?? 0 });
            }}
          />

          <div className="mt-3 min-h-14 text-center">
            {spinning && (
              <p className="text-sm font-bold text-fish-muted">A roda está a decidir…</p>
            )}
            {!spinning && shown && shown.payout > 0 && (
              <>
                <p className="font-display text-3xl font-black" style={{ color: ACCENT }}>
                  {shown.multiplier.toFixed(2)}x
                </p>
                <p className="text-sm font-bold text-fish-green">
                  Ganhou {NUM.format(shown.payout)} MZN
                </p>
              </>
            )}
            {!spinning && shown && shown.payout <= 0 && (
              <p className="font-display text-2xl font-black text-fish-red">Setor sem prémio</p>
            )}
            {!spinning && !shown && (
              <p className="text-sm text-fish-muted">
                Escolha o valor e gire. O setor é sorteado no servidor.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[...new Set(WHEEL_LAYOUT.filter((value) => value > 0))]
          .sort((a, b) => a - b)
          .map((value) => (
            <div
              key={value}
              className="rounded-xl border border-fish-line/70 bg-fish-panel/70 px-3 py-2 text-center"
            >
              <p className="text-lg font-black tabular-nums" style={{ color: ACCENT }}>
                {value.toFixed(2)}x
              </p>
              <p className="text-[11px] text-fish-muted">
                {WHEEL_LAYOUT.filter((item) => item === value).length} setores
              </p>
            </div>
          ))}
      </div>
    </InstantShell>
  );
}
