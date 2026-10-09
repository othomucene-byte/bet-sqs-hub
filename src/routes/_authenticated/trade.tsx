import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

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
const DURATION_MS = 5000;
const NUM = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Mark = { x: number; y: number; win: boolean; amount: number };

/** Gráfico ilustrativo do jogo: não é cotação real de mercado. */
function TradeChart({
  running,
  finalUp,
  onDone,
  marks,
}: {
  running: number;
  finalUp: boolean | null;
  onDone: () => void;
  marks: Mark[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const points = useRef<number[]>(Array.from({ length: 120 }, (_, i) => 50 + Math.sin(i / 7) * 8));
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = 0;
    const start = performance.now();
    const entry = points.current[points.current.length - 1] ?? 50;
    let finished = false;

    const draw = (now: number) => {
      const w = (canvas.width = canvas.clientWidth * 2);
      const h = (canvas.height = canvas.clientHeight * 2);
      if (now - last > 120) {
        last = now;
        const arr = points.current;
        const prev = arr[arr.length - 1] ?? 50;
        let next = prev + (Math.random() - 0.5) * 4;
        if (running && finalUp !== null) {
          const t = Math.min(1, (now - start) / DURATION_MS);
          const target = entry + (finalUp ? 12 : -12);
          next = next + (target - next) * t * 0.35;
        }
        arr.push(Math.max(8, Math.min(92, next)));
        if (arr.length > 120) arr.shift();
      }
      const arr = points.current;
      const step = w / (arr.length - 1);
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(255,255,255,.06)";
      for (let i = 1; i < 5; i += 1) {
        ctx.beginPath();
        ctx.moveTo(0, (h * i) / 5);
        ctx.lineTo(w, (h * i) / 5);
        ctx.stroke();
      }
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "rgba(59,164,255,.55)");
      grad.addColorStop(1, "rgba(59,164,255,0)");
      ctx.beginPath();
      arr.forEach((v, i) => {
        const y = h - (v / 100) * h;
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo(i * step, y);
      });
      ctx.lineWidth = 3;
      ctx.strokeStyle = ACCENT;
      ctx.stroke();
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.fillStyle = grad;
      ctx.fill();
      if (running) {
        const ey = h - (entry / 100) * h;
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = "rgba(255,255,255,.5)";
        ctx.beginPath();
        ctx.moveTo(0, ey);
        ctx.lineTo(w, ey);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      const lastV = arr[arr.length - 1] ?? 50;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(w - 4, h - (lastV / 100) * h, 7, 0, Math.PI * 2);
      ctx.fill();

      if (running && !finished && now - start >= DURATION_MS) {
        finished = true;
        doneRef.current();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [running, finalUp]);

  return (
    <div className="relative h-72 w-full">
      <canvas ref={ref} className="h-full w-full" />
      {marks.map((m, i) => (
        <span
          key={i}
          className={`absolute -translate-x-1/2 rounded-md px-2 py-1 text-sm font-black ${
            m.win ? "bg-fish-green text-fish-bg" : "bg-fish-red text-bet-foreground"
          }`}
          style={{ left: `${m.x}%`, top: `${m.y}%` }}
        >
          {m.win ? "+" : "-"}
          {NUM.format(m.amount)} MT
        </span>
      ))}
    </div>
  );
}

function TradePage() {
  const game = useInstantGame("trade");
  const [running, setRunning] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [marks, setMarks] = useState<Mark[]>([]);
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
      <div className="overflow-hidden rounded-2xl border border-fish-line/70 bg-fish-panel/80">
        <div className="flex items-center justify-between border-b border-fish-line/70 px-4 py-2">
          <p className="font-display font-bold">Índice SQs</p>
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
