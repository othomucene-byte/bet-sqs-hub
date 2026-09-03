import { CirclePlay, Minus, Plus } from "lucide-react";

const NUM = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CHIPS = [1, 2, 5, 10];

/**
 * Painel de aposta compacto, inspirado no formato de casino mobile.
 * O servidor continua a ser a autoridade sobre aposta, cash-out e saldo.
 */
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
  autoCashout,
  autoCashoutValue,
  onToggleAutoPlay,
  onToggleAutoCashout,
  onAutoCashoutValue,
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
  autoCashout?: boolean;
  autoCashoutValue?: string;
  onToggleAutoPlay?: () => void;
  onToggleAutoCashout?: () => void;
  onAutoCashoutValue?: (next: string) => void;
}) {
  const amount = Number(value) || 0;
  const step = (delta: number) =>
    onValue(String(Math.min(maxBet, Math.max(minBet, Math.round((amount + delta) * 100) / 100))));
  const locked = disabled || mode === "locked";
  const actionDisabled = mode === "cashout" ? Boolean(busy) : locked || Boolean(busy);

  return (
    <section className="rounded-[20px] border border-bet-line bg-bet-panel p-2.5 shadow-[0_10px_30px_-18px_var(--bet-surface)]">
      <div className="mb-2 flex items-center justify-between gap-2 px-1.5">
        <span className="text-[9px] font-black uppercase tracking-[0.16em] text-bet-foreground">
          {title ?? "Aposta"}
        </span>
        <span className="truncate text-[9px] font-bold text-bet-muted">{stateLabel}</span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] gap-2">
        <div className="min-w-0">
          <div className="flex h-[52px] items-center justify-between rounded-full border border-bet-line bg-bet-pill px-2">
            <button
              type="button"
              aria-label="Diminuir aposta"
              disabled={locked}
              onClick={() => step(-1)}
              className="grid size-8 shrink-0 place-items-center rounded-full text-bet-foreground transition hover:bg-bet-ghost/40 disabled:opacity-35"
            >
              <Minus className="size-5" strokeWidth={2.5} />
            </button>
            <input
              inputMode="decimal"
              aria-label="Valor da aposta"
              value={value}
              disabled={locked}
              onChange={(event) => onValue(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-center font-display text-[19px] font-medium tabular-nums text-bet-foreground outline-none disabled:opacity-45"
            />
            <button
              type="button"
              aria-label="Aumentar aposta"
              disabled={locked}
              onClick={() => step(1)}
              className="grid size-8 shrink-0 place-items-center rounded-full text-bet-foreground transition hover:bg-bet-ghost/40 disabled:opacity-35"
            >
              <Plus className="size-5" strokeWidth={2.5} />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                disabled={locked}
                onClick={() => onValue(String(Math.min(maxBet, Math.max(minBet, chip))))}
                className="h-9 rounded-full border border-bet-line bg-bet-chip text-xs font-medium tabular-nums text-bet-foreground transition hover:bg-bet-ghost/70 disabled:opacity-40"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {mode === "cashout" ? (
          <button
            type="button"
            disabled={actionDisabled}
            onClick={onCashout}
            className="min-h-[95px] rounded-[18px] border border-bet-amber/50 bg-bet-amber px-2 text-center font-display text-bet-surface shadow-[0_4px_0_var(--bet-surface)] transition active:translate-y-0.5 disabled:opacity-45"
          >
            <span className="block text-[15px] font-medium">Levantar</span>
            <span className="mt-0.5 block text-[19px] font-black tabular-nums">
              {NUM.format(cashoutValue ?? 0)} MZN
            </span>
          </button>
        ) : (
          <button
            type="button"
            disabled={actionDisabled}
            onClick={onPlace}
            className="min-h-[95px] rounded-[18px] border border-bet-green/60 bg-bet-green px-2 text-center font-display text-bet-green-foreground shadow-[0_4px_0_var(--bet-surface)] transition active:translate-y-0.5 disabled:opacity-45"
          >
            <span className="block text-[15px] font-medium">Aposta</span>
            <span className="mt-0.5 block text-[19px] font-black tabular-nums">
              {NUM.format(amount)} MZN
            </span>
          </button>
        )}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={locked}
          onClick={onToggleAutoPlay}
          aria-pressed={autoPlay}
          className={`flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-full border px-2 text-[11px] font-medium transition disabled:opacity-40 ${
            autoPlay ? "border-bet-green bg-bet-green text-bet-green-foreground" : "border-bet-line bg-bet-ghost text-bet-ghost-foreground"
          }`}
        >
          <CirclePlay className="size-4 shrink-0" />
          <span className="truncate">Jogo Automático</span>
        </button>
        {autoCashout ? (
          <div className="flex h-9 min-w-0 items-center gap-1 rounded-full border border-bet-amber bg-bet-amber px-1.5">
            <button
              type="button"
              disabled={locked}
              onClick={onToggleAutoCashout}
              aria-pressed
              className="min-w-0 flex-1 truncate text-[11px] font-medium text-bet-surface"
            >
              Levantamento Auto.
            </button>
            <input
              inputMode="decimal"
              aria-label="Multiplicador de levantamento automático"
              value={autoCashoutValue ?? "2"}
              onChange={(event) => onAutoCashoutValue?.(event.target.value)}
              className="h-7 w-11 shrink-0 rounded-full border border-bet-line bg-bet-pill px-1 text-center text-[11px] font-bold tabular-nums text-bet-foreground outline-none"
            />
          </div>
        ) : (
          <button
            type="button"
            disabled={locked}
            onClick={onToggleAutoCashout}
            aria-pressed={false}
            className="flex h-9 min-w-0 items-center justify-center rounded-full border border-bet-line bg-bet-ghost px-2 text-[11px] font-medium text-bet-ghost-foreground transition disabled:opacity-40"
          >
            <span className="truncate">Levantamento Automático</span>
          </button>
        )}
      </div>
    </section>
  );
}
