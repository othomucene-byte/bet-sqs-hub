import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { TradeChart, type TradeMark } from "@/components/games/trade-chart";
import { InstantShell, StakeBar } from "@/components/games/instant-shell";
import { useInstantGame } from "@/lib/games/use-instant-game";

export const Route = createFileRoute("/_authenticated/trade")({
  head: () => ({
    meta: [
      { title: "SQs Trade — sobe ou desce em meticais" },
      {
        name: "description",
        content:
          "SQs Trade: preveja se o índice do jogo sobe ou desce. Resultado selado no servidor, verificável, prémio 1,94x em meticais.",
      },
      { property: "og:title", content: "SQs Trade" },
      { property: "og:description", content: "Sobe ou desce com resultado verificável e prémio 1,94x." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TradePage,
});

const ACCENT = "#3ba4ff";
const NUM = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function TradePage() {
  const game = useInstantGame("trade");
  const [running, setRunning] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [marks, setMarks] = useState<TradeMark[]>([]);
  const [shown, setShown] = useState<{ win: boolean; payout: number; stake: number } | null>(null);
  const result = game.lastResult;

  useEffect(() => {
    if (!result || result.game !== "trade") return;
    setShown(null);
    setRunning((v) => v + 1);
  }, [result?.id]);

  const win = result ? result.status === "cashed_out" : null;
  const finalUp = win === null ? null : win ? dir === 1 : dir === -1;
  const busy = game.busy || (running > 0 && !shown && !!result);

  const play = (d: 1 | -1) => {
    setDir(d);
    game.start(d);
  };

  return (
    <InstantShell
      title="SQs Trade"
      accent={ACCENT}
      balance={game.balance}
      history={game.history}
      footer={
        <StakeBar
          stake={game.stake}
          setStake={game.setStake}
          accent={ACCENT}
          disabled={busy}
          options={game.funding.options}
          selected={game.funding.resolve(1).funding}
          onFunding={(value) => game.funding.setFunding(1, value)}
          action={
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => play(-1)}
                className="rounded-xl bg-fish-red py-4 font-display text-lg font-black text-bet-foreground disabled:opacity-50"
              >
                ▼ DESCE
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => play(1)}
                className="rounded-xl bg-fish-green py-4 font-display text-lg font-black text-fish-bg disabled:opacity-50"
              >
                ▲ SOBE
              </button>
            </div>
          }
        />
      }
    >
      <div className="overflow-hidden rounded-lg border border-bet-line bg-bet-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-bet-line px-4 py-3">
          <div><p className="font-display text-sm font-bold">Índice SQs <span className="ml-2 text-[10px] font-normal text-bet-muted">ILUSTRATIVO</span></p><p className="mt-1 text-[10px] text-bet-muted">Velas · Escala do jogo</p></div>
          <p className="text-xs text-fish-muted">Prémio 1,94x · 5 s</p>
        </div>
        <TradeChart
          running={running > 0 && !shown ? running : 0}
          finalUp={!shown ? finalUp : null}
          marks={marks}
          onDone={() => {
            if (!result) return;
            const payout = result.payout ?? 0;
            const ok = result.status === "cashed_out";
            setShown({ win: ok, payout, stake: result.stake });
            setMarks((list) =>
              [...list, { x: 70 + Math.random() * 15, y: ok ? 15 : 60, win: ok, amount: ok ? payout - result.stake : result.stake }].slice(-1),
            );
          }}
        />
        <div className="min-h-12 px-4 pb-3 text-center">
          {!shown && result && running > 0 && (
            <p className="text-sm font-bold text-fish-muted">
              Previsão: {dir === 1 ? "SOBE" : "DESCE"} — a aguardar o fecho…
            </p>
          )}
          {shown?.win && (
            <p className="text-sm font-bold text-fish-green">Acertou! {NUM.format(shown.payout)} MZN na carteira</p>
          )}
          {shown && !shown.win && <p className="text-sm font-bold text-fish-red">Não acertou desta vez</p>}
          {!result && (
            <p className="text-sm text-fish-muted">Escolha o valor e preveja se o índice sobe ou desce.</p>
          )}
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-fish-muted">
        Índice ilustrativo do jogo, não é cotação real de mercado. Resultado selado no servidor antes da
        jogada e verificável. RTP 97%. +18. Jogue com responsabilidade.
      </p>
    </InstantShell>
  );
}
