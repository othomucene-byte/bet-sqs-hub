import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { SiteHeader } from "@/components/site-header";
import { ExchangeNav } from "@/components/exchange/exchange-nav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MZN, pct } from "@/lib/exchange/format";

/** Chrome comum dos ecrãs do SQs Exchange: cabeçalho, título, separadores e conteúdo denso. */
export function TerminalShell({
  title,
  badges,
  subtitle,
  actions,
  children,
  wide,
}: {
  title: string;
  badges?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <SiteHeader />
      <div className={cn("mx-auto flex w-full max-w-full", wide ? "max-w-[1480px]" : "max-w-6xl")}>
        <ExchangeNav variant="sidebar" />
        <main className="min-w-0 flex-1 space-y-3 overflow-x-hidden px-3 py-4 sm:px-4">
        <header className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
            {badges}
            {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
          </div>
          {subtitle && (
            <p className="text-[12px] leading-relaxed text-muted-foreground">{subtitle}</p>
          )}
        </header>
        {children}

        </main>
      </div>
      <ExchangeNav variant="mobile" />
    </div>
  );
}

/** Paletas fixas para o emblema de cada empresa (cor estável por símbolo). */
const LOGO_TONES = [
  "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "bg-sky-500/20 text-sky-300 border-sky-500/30",
  "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "bg-violet-500/20 text-violet-300 border-violet-500/30",
  "bg-rose-500/20 text-rose-300 border-rose-500/30",
  "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
];

/**
 * Emblema visual da empresa: usa o logótipo oficial quando existir e, enquanto
 * não existir, um monograma com cor estável — nunca inventa marcas.
 */
export function AssetLogo({
  symbol,
  name,
  logoUrl,
  size = 36,
  className,
}: {
  symbol: string;
  name?: string;
  logoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const tone = LOGO_TONES[
    [...symbol].reduce((acc, c) => acc + c.charCodeAt(0), 0) % LOGO_TONES.length
  ] as string;
  const style = { width: size, height: size };
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name ?? symbol}
        style={style}
        className={cn("shrink-0 rounded-full border border-border/60 object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={style}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border font-bold tracking-tight",
        size <= 28 ? "text-[9px]" : size >= 48 ? "text-sm" : "text-[11px]",
        tone,
        className,
      )}
    >
      {symbol.slice(0, 3)}
    </span>
  );
}

/** Painel escuro com título discreto, no estilo de terminal. */
export function Panel({
  title,
  right,
  children,
  className,
  padded = true,
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border/60 bg-card/70 shadow-sm",
        className,
      )}
    >
      {title && (
        <div className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {title}
          </h2>
          {right}
        </div>
      )}
      <div className={padded ? "p-3" : undefined}>{children}</div>
    </section>
  );
}

/** Cartão de destaque com o valor total e a variação. */
export function TotalCard({
  label,
  value,
  changeValue,
  changePct,
  note,
  spark,
}: {
  label: string;
  value: number;
  changeValue?: number | null;
  changePct?: number | null;
  note?: ReactNode;
  spark?: number[];
}) {
  const up = (changeValue ?? changePct ?? 0) >= 0;
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 p-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{ backgroundImage: "var(--gradient-primary)" }}
      />
      <div className="relative space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p className="font-mono text-3xl font-bold tabular-nums sm:text-4xl">{MZN.format(value)}</p>
        {(changeValue != null || changePct != null) && (
          <p className="flex items-center gap-2 text-sm">
            {changeValue != null && (
              <span className={up ? "text-primary" : "text-destructive"}>
                {up ? "+" : ""}
                {MZN.format(changeValue)}
              </span>
            )}
            {changePct != null && (
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums",
                  up ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive",
                )}
              >
                {pct(changePct)}
              </span>
            )}
          </p>
        )}
        {note && <div className="pt-1 text-[11px] text-muted-foreground">{note}</div>}
        {spark && spark.length > 1 && (
          <div className="h-20 pt-2">
            <Spark values={spark} up={up} />
          </div>
        )}
      </div>
    </section>
  );
}

/** Mini-gráfico de linha usado nas listas e nos cartões. */
export function Spark({ values, up }: { values: number[]; up: boolean }) {
  const stroke = up ? "var(--primary)" : "var(--destructive)";
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={values.map((p, i) => ({ i, p }))} margin={{ top: 2, bottom: 2 }}>
        <defs>
          <linearGradient id={`spark-${up ? "up" : "down"}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="p"
          stroke={stroke}
          strokeWidth={2}
          fill={`url(#spark-${up ? "up" : "down"})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Quadrado de indicador para as grelhas de métricas. */
export function StatTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "up" | "down";
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/60 p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "font-mono text-sm font-semibold tabular-nums",
          tone === "up" && "text-primary",
          tone === "down" && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}

/** Grupo de separadores em pílula (filtros de classe, períodos, etc.). */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Record<string, string>;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {options.map((o) => (
        <Button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          size="sm"
          variant="outline"
          className={cn(
            "h-7 shrink-0 rounded-full px-3 text-xs font-medium",
            value === o
              ? "border-primary bg-primary/15 text-primary"
              : "border-border/60 text-muted-foreground hover:text-foreground",
          )}
        >
          {labels?.[o] ?? o}
        </Button>
      ))}
    </div>
  );
}

/** Gráfico grande com grelha discreta e preenchimento em gradiente. */
export function BigChart({
  values,
  up,
  height = 200,
}: {
  values: { label: string; price: number }[];
  up: boolean;
  height?: number;
}) {
  const stroke = up ? "var(--primary)" : "var(--destructive)";
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={values} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="bigchart" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.4} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeOpacity={0.08} vertical={false} />
          <XAxis dataKey="label" fontSize={10} tickLine={false} axisLine={false} minTickGap={28} />
          <YAxis
            fontSize={10}
            tickLine={false}
            axisLine={false}
            width={44}
            domain={["auto", "auto"]}
            orientation="right"
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke={stroke}
            strokeWidth={2}
            fill="url(#bigchart)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Linha do livro de ordens com barra de profundidade proporcional. */
export function DepthRow({
  price: p,
  qty,
  max,
  tone,
}: {
  price: number;
  qty: number;
  max: number;
  tone: "buy" | "sell";
}) {
  const width = max > 0 ? Math.max(4, Math.round((qty / max) * 100)) : 0;
  return (
    <div className="relative flex items-center justify-between px-2 py-1 font-mono text-xs tabular-nums">
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0.5 rounded-sm",
          tone === "buy" ? "left-0 bg-primary/15" : "right-0 bg-destructive/15",
        )}
        style={{ width: `${width}%` }}
      />
      <span className={cn("relative", tone === "buy" ? "text-primary" : "text-destructive")}>
        {p.toFixed(2)}
      </span>
      <span className="relative text-muted-foreground">{qty}</span>
    </div>
  );
}
