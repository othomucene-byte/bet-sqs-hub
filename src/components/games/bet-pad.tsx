/**
 * Painel de aposta no formato de casino (mobile-first): stepper, fichas rápidas
 * e um único botão grande que alterna entre Apostar e Levantar.
 *
 * Puramente visual: o servidor continua a ser a autoridade sobre aposta,
 * cash-out e saldo.
 */
const NUM = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CHIPS = [1, 2, 5, 10];

export function BetPad({
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
  footer,
}: {
  value: string;
  onValue: (next: string) => void;
  minBet: number;
  maxBet: number;
  disabled: boolean;
  /** "bet" mostra Apostar, "cashout" mostra Levantar, "locked" desativa tudo. */
  mode: "bet" | "cashout" | "locked";
  stateLabel: string;
  cashoutValue?: number;
  busy?: boolean;
  onPlace?: () => void;
  onCashout?: () => void;
  footer?: React.ReactNode;
}) {
  const amount = Number(value) || 0;
  const step = (delta: number) =>
    onValue(String(Math.min(maxBet, Math.max(minBet, Math.round((amount + delta) * 100) / 100))));

  return (
    <div className="rounded-2xl border border-fish-line/70 bg-fish-panel p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-fish-muted">
          {mode === "cashout" ? "Em jogo" : "Aposta"}
        </span>
        <span className="truncate text-[11px] font-semibold text-fish-muted">{stateLabel}</span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-2.5">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center justify-between rounded-full bg-fish-input px-2 py-1.5">
            <button
              type="button"
              aria-label="Diminuir aposta"
              disabled={disabled}
              onClick={() => step(-1)}
              className="grid size-8 shrink-0 place-items-center rounded-full bg-fish-step text-lg font-bold text-fish-foreground disabled:opacity-40"
            >
              −
            </button>
            <input
              inputMode="decimal"
              aria-label="Valor da aposta"
              value={value}
              disabled={disabled}
              onChange={(event) => onValue(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-center text-lg font-bold tabular-nums text-fish-foreground outline-none disabled:opacity-40"
            />
            <button
              type="button"
              aria-label="Aumentar aposta"
              disabled={disabled}
              onClick={() => step(1)}
              className="grid size-8 shrink-0 place-items-center rounded-full bg-fish-step text-lg font-bold text-fish-foreground disabled:opacity-40"
            >
              +
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                disabled={disabled}
                onClick={() => onValue(String(Math.max(minBet, chip)))}
                className="rounded-full bg-fish-quick py-1.5 text-xs font-bold tabular-nums text-fish-quick-foreground disabled:opacity-40"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {mode === "cashout" ? (
          <button
            type="button"
            disabled={busy}
            onClick={onCashout}
            className="min-h-[72px] rounded-2xl bg-fish-amber px-2 text-center font-display text-fish-ink shadow-[0_6px_0_rgba(0,0,0,0.35)] transition active:translate-y-[2px] disabled:opacity-45"
          >
            <span className="block text-sm font-bold">Levantar</span>
            <span className="block text-lg font-black tabular-nums">
              {NUM.format(cashoutValue ?? 0)} MZN
            </span>
          </button>
        ) : (
          <button
            type="button"
            disabled={mode === "locked" || disabled || busy}
            onClick={onPlace}
            className="min-h-[72px] rounded-2xl bg-fish-green px-2 text-center font-display text-fish-ink shadow-[0_6px_0_rgba(0,0,0,0.35)] transition active:translate-y-[2px] disabled:opacity-45"
          >
            <span className="block text-sm font-bold">Aposta</span>
            <span className="block text-lg font-black tabular-nums">
              {NUM.format(amount)} MZN
            </span>
          </button>
        )}
      </div>

      {footer && <div className="mt-2.5">{footer}</div>}
    </div>
  );
}
