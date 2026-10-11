import { useEffect, useRef } from "react";

const DURATION_MS = 5000;
const NUM = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export type TradeMark = { x: number; y: number; win: boolean; amount: number };

/** Visual-only game index. Never used to price, debit or settle a wager. */
export function TradeChart({ running, finalUp, onDone, marks }: {
  running: number;
  finalUp: boolean | null;
  onDone: () => void;
  marks: TradeMark[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const points = useRef(Array.from({ length: 120 }, (_, i) => 50 + Math.sin(i / 7) * 8));
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const css = getComputedStyle(canvas);
    const color = (name: string) => css.getPropertyValue(name).trim();
    const colors = {
      bg: color("--bet-surface"), grid: color("--bet-line"), muted: color("--bet-muted"),
      up: color("--fish-green"), down: color("--fish-red"), level: color("--game-low"),
      text: color("--bet-foreground"), label: color("--bet-panel"),
    };
    let raf = 0;
    let last = 0;
    const start = performance.now();
    const entry = points.current.at(-1) ?? 50;
    let finished = false;

    const draw = (now: number) => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (now - last > 120) {
        last = now;
        const arr = points.current;
        let next = (arr.at(-1) ?? 50) + (Math.random() - 0.5) * 4;
        if (running && finalUp !== null) {
          const t = Math.min(1, (now - start) / DURATION_MS);
          next += (entry + (finalUp ? 12 : -12) - next) * t * 0.35;
        }
        arr.push(Math.max(8, Math.min(92, next)));
        if (arr.length > 120) arr.shift();
      }
      const arr = points.current;
      const left = 12;
      const right = w - 61;
      const top = 20;
      const bottom = h - 32;
      const plotW = right - left;
      const plotH = bottom - top;
      const y = (value: number) => bottom - (value / 100) * plotH;
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, w, h);
      ctx.font = "10px Manrope, sans-serif";
      ctx.lineWidth = 1;
      ctx.textAlign = "left";
      for (let i = 0; i <= 5; i++) {
        const gy = top + plotH * i / 5;
        ctx.strokeStyle = colors.grid;
        ctx.beginPath(); ctx.moveTo(left, gy); ctx.lineTo(right, gy); ctx.stroke();
        ctx.fillStyle = colors.muted;
        ctx.fillText(NUM.format(100 - i * 20), right + 8, gy + 3);
      }
      for (let i = 0; i <= 4; i++) {
        const gx = left + plotW * i / 4;
        ctx.strokeStyle = colors.grid;
        ctx.beginPath(); ctx.moveTo(gx, top); ctx.lineTo(gx, bottom); ctx.stroke();
        ctx.fillStyle = colors.muted;
        ctx.textAlign = i === 0 ? "left" : i === 4 ? "right" : "center";
        ctx.fillText(i === 4 ? "Agora" : `−${Math.round((4 - i) * 3.6)} s`, gx, h - 12);
      }
      // Reference bands only; no invented market volume or projected returns.
      for (const value of [30, 70]) {
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = value === 70 ? colors.down : colors.level;
        ctx.fillRect(left, y(value + 2), plotW, plotH * 0.04);
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = value === 70 ? colors.down : colors.level;
        ctx.beginPath(); ctx.moveTo(left, y(value)); ctx.lineTo(right, y(value)); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      const count = 40;
      const step = plotW * 0.86 / count;
      for (let i = 0; i < count; i++) {
        const values = arr.slice(i * 3, i * 3 + 3);
        const open = i === 0 ? values[0] ?? 50 : arr[i * 3 - 1] ?? 50;
        const close = values.at(-1) ?? open;
        const high = Math.max(open, ...values);
        const low = Math.min(open, ...values);
        const x = left + step * (i + 0.5);
        ctx.strokeStyle = ctx.fillStyle = close >= open ? colors.up : colors.down;
        ctx.beginPath(); ctx.moveTo(x, y(high)); ctx.lineTo(x, y(low)); ctx.stroke();
        ctx.fillRect(x - Math.max(2, step * 0.55) / 2, Math.min(y(open), y(close)), Math.max(2, step * 0.55), Math.max(1.5, Math.abs(y(close) - y(open))));
      }
      if (running) {
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = colors.text;
        ctx.globalAlpha = 0.65;
        ctx.beginPath(); ctx.moveTo(left, y(entry)); ctx.lineTo(right, y(entry)); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
        ctx.textAlign = "right"; ctx.fillStyle = colors.text;
        ctx.fillText(`Entrada · ${Math.max(0, 5 - (now - start) / 1000).toFixed(1)} s`, right - 6, y(entry) - 8);
      }
      const value = arr.at(-1) ?? 50;
      const up = value >= (arr.at(-2) ?? value);
      const currentY = y(value);
      ctx.strokeStyle = up ? colors.up : colors.down;
      ctx.setLineDash([2, 4]);
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.moveTo(left, currentY); ctx.lineTo(right, currentY); ctx.stroke();
      ctx.globalAlpha = 1; ctx.setLineDash([]);
      ctx.fillStyle = up ? colors.up : colors.down;
      ctx.fillRect(right + 1, currentY - 11, 58, 22);
      ctx.fillStyle = colors.bg; ctx.textAlign = "center";
      ctx.font = "bold 10px Manrope, sans-serif";
      ctx.fillText(NUM.format(value), right + 30, currentY + 3);
      const cross = pointer.current;
      if (cross && cross.x >= left && cross.x <= right && cross.y >= top && cross.y <= bottom) {
        ctx.strokeStyle = colors.muted; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(cross.x, top); ctx.lineTo(cross.x, bottom);
        ctx.moveTo(left, cross.y); ctx.lineTo(right, cross.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = colors.label; ctx.fillRect(right + 1, cross.y - 10, 58, 20);
        ctx.fillStyle = colors.text;
        ctx.fillText(NUM.format((bottom - cross.y) / plotH * 100), right + 30, cross.y + 3);
      }
      if (running && !finished && now - start >= DURATION_MS) {
        finished = true; doneRef.current();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [running, finalUp]);

  return (
    <div className="relative h-[300px] w-full sm:h-[360px]">
      <canvas ref={ref} className="h-full w-full cursor-crosshair" role="img"
        aria-label="Gráfico de velas do índice ilustrativo SQs, não representa cotações de mercado"
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          pointer.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        }} onPointerLeave={() => { pointer.current = null; }} />
      {marks.map((m, i) => (
        <span key={i} className={`pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 rounded px-3 py-1 text-xs font-bold tabular-nums ${m.win ? "bg-fish-green text-fish-bg" : "bg-fish-red text-bet-foreground"}`}>
          {m.win ? "+" : "−"}{NUM.format(m.amount)} MT
        </span>
      ))}
    </div>
  );
}