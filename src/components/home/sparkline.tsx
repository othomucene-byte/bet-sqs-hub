/** Mini-gráfico de tendência. Só desenha o que vem dos dados reais. */
export function Sparkline({
  points,
  positive,
  className = "h-7 w-20",
}: {
  points: number[];
  positive: boolean;
  className?: string;
}) {
  const series = points.filter((p) => Number.isFinite(p));
  if (series.length < 2) {
    return <div className={`${className} flex items-center text-[10px] text-muted-foreground`}>—</div>;
  }
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const w = 100;
  const h = 32;
  const d = series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const stroke = positive ? "var(--color-chart-1)" : "var(--color-destructive)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden="true">
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={stroke} opacity="0.12" />
      <path d={d} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
