import { CirclePlay, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const NUM = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CHIPS = [3, 5, 10, 20];

export function BetPad({
  title,
  value,
  onValue,
  minBet,
  maxBet,
  disabled,
  mode,
  stateLabel,
  cashoutValue,
  busy,
  onPlace,
  onCashout,
  autoPlay,
  autoPlayRounds,
  autoPlayRemaining,
  onAutoPlayRounds,
  autoCashout,
  autoCashoutValue,
  onToggleAutoPlay,
  onToggleAutoCashout,
  onAutoCashoutValue,
  funding,
  fundingOptions,
  onFunding,
}: {
  title?: string;
  value: string;
  onValue: (next: string) => void;
  minBet: number;
  maxBet: number;
  disabled: boolean;
  mode: "bet" | "cashout" | "locked";
  stateLabel: string;
  cashoutValue?: number;
  busy?: boolean;
  onPlace?: () => void;
  onCashout?: () => void;
  autoPlay?: boolean;
  autoPlayRounds?: string;
  autoPlayRemaining?: number;
  onAutoPlayRounds?: (next: string) => void;
  autoCashout?: boolean;
  autoCashoutValue?: string;
  onToggleAutoPlay?: () => void;
  onToggleAutoCashout?: () => void;
  onAutoCashoutValue?: (next: string) => void;
  funding?: BetFunding;
  fundingOptions?: { key: BetFunding; label: string }[];
  onFunding?: (next: BetFunding) => void;
}) {
  const amount = Number(value) || 0;
  const step = (delta: number) =>
    onValue(String(Math.min(maxBet, Math.max(minBet, Math.round((amount + delta) * 100) / 100))));
  const locked = disabled || mode === "locked";
  const actionDisabled = mode === "cashout" ? Boolean(busy) : locked || Boolean(busy);
  const sources = fundingOptions ?? [];

  return (
    <section className="rounded-2xl border border-bet-line bg-bet-panel p-2 shadow-sm">
      <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
        <span className="text-[9px] font-black uppercase tracking-[0.16em] text-bet-foreground">
          {title ?? "Aposta"}
        </span>
        <span className="truncate text-[9px] font-bold text-bet-muted">{stateLabel}</span>
      </div>

      {sources.length > 1 && (
        <div className="mb-1.5 flex gap-1">
          {sources.map((option) => {
            const on = (funding ?? "wallet") === option.key;
            return (
              <Button
                key={option.key}
                type="button"
                variant="ghost"
                disabled={locked}
                onClick={() => onFunding?.(option.key)}
                aria-pressed={on}
                className={`h-6 flex-1 rounded-full border px-1 text-[9px] font-bold uppercase tracking-wide disabled:opacity-40 ${
                  on
                    ? "border-bet-green bg-bet-green text-bet-green-foreground hover:bg-bet-green"
                    : "border-bet-line bg-bet-chip text-bet-muted hover:bg-bet-ghost/70"
                }`}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
      )}


      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] gap-1.5">
        <div className="min-w-0">
          <div className="flex h-11 items-center justify-between rounded-full border border-bet-line bg-bet-pill px-1.5">
            <Button
              variant="ghost"
              size="icon"
              type="button"
              disabled={locked}
              onClick={() => step(-1)}
              className="size-7 shrink-0 rounded-full text-bet-foreground hover:bg-bet-ghost/40 disabled:opacity-35"
            >
              <Minus className="size-5" strokeWidth={2.5} />
            </Button>
            <input
              inputMode="decimal"
              aria-label="Valor da aposta"
              value={value}
              disabled={locked}
              onChange={(event) => onValue(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-center font-display text-base font-semibold tabular-nums text-bet-foreground outline-none disabled:opacity-45"
            />
            <Button
              variant="ghost"
              size="icon"
              type="button"
              disabled={locked}
              onClick={() => step(1)}
              className="size-7 shrink-0 rounded-full text-bet-foreground hover:bg-bet-ghost/40 disabled:opacity-35"
            >
              <Plus className="size-5" strokeWidth={2.5} />
            </Button>
          </div>
          <div className="mt-1.5 grid grid-cols-4 gap-1">
            {CHIPS.map((chip) => (
              <Button
                key={chip}
                type="button"
                disabled={locked}
                onClick={() => onValue(String(Math.min(maxBet, Math.max(minBet, chip))))}
                variant="ghost"
                className="h-7 rounded-full border border-bet-line bg-bet-chip px-1 text-[11px] font-semibold tabular-nums text-bet-foreground hover:bg-bet-ghost/70 disabled:opacity-40"
              >
                {chip}
              </Button>
            ))}
          </div>
        </div>

        {mode === "cashout" ? (
          <Button
            type="button"
            disabled={actionDisabled}
            onClick={onCashout}
            className="h-[73px] rounded-xl border border-bet-amber/50 bg-bet-amber px-2 text-center font-display text-bet-surface shadow-[0_3px_0_var(--bet-surface)] hover:bg-bet-amber active:translate-y-0.5 disabled:opacity-45"
          >
            <span className="block text-[15px] font-medium">Levantar</span>
            <span className="mt-0.5 block text-[19px] font-black tabular-nums">
              {NUM.format(cashoutValue ?? 0)} MZN
            </span>
          </Button>
        ) : (
          <Button
            type="button"
            disabled={actionDisabled}
            onClick={onPlace}
            className="h-[73px] rounded-xl border border-bet-green/60 bg-bet-green px-2 text-center font-display text-bet-green-foreground shadow-[0_3px_0_var(--bet-surface)] hover:bg-bet-green active:translate-y-0.5 disabled:opacity-45"
          >
            <span className="block text-[15px] font-medium">Aposta</span>
            <span className="mt-0.5 block text-[19px] font-black tabular-nums">
              {NUM.format(amount)} MZN
            </span>
          </Button>
        )}
      </div>

      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <div className={`flex h-8 min-w-0 items-center rounded-full border px-1 ${autoPlay ? "border-bet-green bg-bet-green" : "border-bet-line bg-bet-ghost"}`}>
          <Button
            variant="ghost"
            type="button"
            disabled={locked && !autoPlay}
            onClick={onToggleAutoPlay}
            aria-pressed={autoPlay}
            className={`h-7 min-w-0 flex-1 justify-center gap-1 px-1 text-[10px] font-semibold hover:bg-transparent disabled:opacity-40 ${autoPlay ? "text-bet-green-foreground" : "text-bet-ghost-foreground"}`}
          >
            <CirclePlay className="size-4 shrink-0" />
            <span className="truncate">{autoPlay ? `Auto (${autoPlayRemaining ?? 0})` : "Jogo Auto."}</span>
          </Button>
          {!autoPlay && (
            <input
              inputMode="numeric"
              aria-label="Rondas automáticas"
              value={autoPlayRounds ?? "5"}
              onChange={(event) => onAutoPlayRounds?.(event.target.value)}
              className="h-6 w-8 shrink-0 rounded-full border border-bet-line bg-bet-pill px-0.5 text-center text-[10px] font-bold text-bet-foreground outline-none"
            />
          )}
        </div>
        
        <div
          className={`flex h-8 min-w-0 items-center gap-1 rounded-full border px-1 ${autoCashout ? "border-bet-amber bg-bet-amber" : "border-bet-line bg-bet-ghost"}`}
        >
          <span
            className={`min-w-0 flex-1 truncate px-1 text-[10px] font-semibold ${autoCashout ? "text-bet-surface" : "text-bet-ghost-foreground"}`}
          >
            Cash Out
          </span>
          {autoCashout && (
            <input
              inputMode="decimal"
              aria-label="Multiplicador de cash out automático"
              value={autoCashoutValue ?? "2.00"}
              disabled={locked}
              onChange={(e) => onAutoCashoutValue?.(e.target.value)}
              className="h-6 w-10 shrink-0 rounded-full border border-bet-line bg-bet-pill px-0.5 text-center text-[10px] font-bold text-bet-foreground outline-none disabled:opacity-50"
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            type="button"
            disabled={locked}
            onClick={onToggleAutoCashout}
            aria-pressed={Boolean(autoCashout)}
            aria-label={autoCashout ? "Desativar cash out automático" : "Ativar cash out automático"}
            className={`size-6 shrink-0 rounded-full border text-[8px] font-black hover:bg-transparent disabled:opacity-40 ${autoCashout ? "border-bet-surface/40 bg-bet-surface text-bet-amber" : "border-bet-line bg-bet-pill text-bet-muted"}`}
          >
            {autoCashout ? "ON" : "OFF"}
          </Button>
        </div>

      </div>
    </section>
  );
}
