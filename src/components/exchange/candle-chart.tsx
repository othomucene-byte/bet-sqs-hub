import { useMemo } from "react";

import { cn } from "@/lib/utils";

export type PricePoint = { t: string; price: number };
export type Candle = {
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const hourFmt = new Intl.DateTimeFormat("pt-PT", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Maputo",
});
const dayFmt = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "short",
  timeZone: "Africa/Maputo",
});

/**
 * Agrupa uma série de preços reais em velas (abertura, máximo, mínimo, fecho).
 * Não inventa valores: quando só existe um preço, devolve uma vela plana.
 */
export function buildCandles(points: PricePoint[], buckets = 28): Candle[] {
  const usable = points.filter((p) => Number.isFinite(p.price));
  if (usable.length === 0) return [];
  const size = Math.max(1, Math.ceil(usable.length / buckets));
  const out: Candle[] = [];
  for (let i = 0; i < usable.length; i += size) {
    const slice = usable.slice(i, i + size);
    const prices = slice.map((p) => p.price);
    const first = slice[0]!;
    const last = slice[slice.length - 1]!;
    const stamp = new Date(first.t);
    const valid = !Number.isNaN(stamp.getTime()) && stamp.getTime() > 0;
    const sameDay =
      new Date(usable[0]!.t).toDateString() === new Date(usable[usable.length - 1]!.t).toDateString();
    out.push({
      label: valid ? (sameDay ? hourFmt.format(stamp) : dayFmt.format(stamp)) : "—",
      open: prices[0]!,
      high: Math.max(...prices),
      low: Math.min(...prices),
      close: last.price,
      volume: slice.length,
    });
  }
  return out;
}

/**
 * Gráfico de velas japonesas com barras de volume, desenhado em SVG puro
 * a partir dos preços efetivos do mercado.
 */
export function CandleChart({
  candles,
  height = 360,
  className,
}: {
  candles: Candle[];
  height?: number;
  className?: string;
}) {
  const view = useMemo(() => {
    if (candles.length === 0) return null;
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    let max = Math.max(...highs);
    let min = Math.min(...lows);
    if (max === min) {
      max = max * 1.01 + 0.5;
      min = Math.max(0, min * 0.99 - 0.5);
    }
    const pad = (max - min) * 0.08;
    return { max: max + pad, min: Math.max(0, min - pad) };
  }, [candles]);

  if (!view || candles.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-xs text-muted-foreground">
        Sem preços suficientes para desenhar o gráfico.
      </div>
    );
  }

  const W = 1000;
  const H = 520;
  const priceH = H * 0.74;
  const volTop = priceH + 24;
  const volH = H - volTop;
  const step = W / candles.length;
  const bodyW = Math.max(2, step * 0.56);
  const maxVol = Math.max(...candles.map((c) => c.volume), 1);
  const y = (p: number) => priceH - ((p - view.min) / (view.max - view.min)) * priceH;
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div style={{ height }} className={cn("relative w-full", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
        {gridLines.map((g) => (
          <line
            key={g}
            x1={0}
            x2={W}
            y1={priceH * g}
            y2={priceH * g}
            stroke="currentColor"
            strokeOpacity={0.08}
            strokeWidth={1}
            className="text-foreground"
          />
        ))}

        {candles.map((c, i) => {
          const cx = i * step + step / 2;
          const up = c.close >= c.open;
          const color = up ? "var(--primary)" : "var(--destructive)";
          const top = y(Math.max(c.open, c.close));
          const bottom = y(Math.min(c.open, c.close));
          const volHeight = (c.volume / maxVol) * volH;
          return (
            <g key={i}>
              <line x1={cx} x2={cx} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth={1.5} />
              <rect
                x={cx - bodyW / 2}
                y={top}
                width={bodyW}
                height={Math.max(2, bottom - top)}
                fill={color}
                rx={1}
              />
              <rect
                x={cx - bodyW / 2}
                y={H - volHeight}
                width={bodyW}
                height={Math.max(1, volHeight)}
                fill={color}
                fillOpacity={0.35}
              />
            </g>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute right-0 top-0 flex h-[74%] flex-col justify-between py-1 pr-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
        {gridLines.map((g) => (
          <span key={g}>{(view.max - (view.max - view.min) * g).toFixed(2)}</span>
        ))}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>{candles[0]?.label}</span>
        <span className="hidden sm:inline">{candles[Math.floor(candles.length / 2)]?.label}</span>
        <span>{candles[candles.length - 1]?.label}</span>
      </div>
    </div>
  );
}
