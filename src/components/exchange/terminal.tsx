import type { ReactNode } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { SiteHeader } from "@/components/site-header";
import { ExchangeNav } from "@/components/exchange/exchange-nav";
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
      <main
        className={cn(
          "mx-auto w-full space-y-3 px-3 py-4 sm:px-4",
          wide ? "max-w-7xl" : "max-w-6xl",
        )}
      >
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
        <ExchangeNav />
        {children}
      </main>
      <ExchangeNav />
    </div>
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
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            value === o
              ? "border-primary bg-primary/15 text-primary"
              : "border-border/60 text-muted-foreground hover:text-foreground",
          )}
        >
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  );
}
