type Item = { roundNumber: number; multiplier: number | null };

/** Pills do histórico. Clicar preenche o verificador provably fair. */
export function HistoryBar({
  items,
  onSelect,
}: {
  items: Item[];
  onSelect?: (roundNumber: number) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Sem rondas terminadas para mostrar ainda.
      </p>
    );
  }

  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => {
        const m = item.multiplier ?? 0;
        const tone =
          m >= 3
            ? "bg-primary/15 text-primary"
            : m >= 1.5
              ? "bg-chart-3/15 text-chart-3"
              : "bg-destructive/15 text-destructive";
        return (
          <button
            key={item.roundNumber}
            type="button"
            onClick={() => onSelect?.(item.roundNumber)}
            title={`Verificar ronda #${item.roundNumber}`}
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums transition-transform hover:scale-105 ${tone}`}
          >
            {m.toFixed(2)}x
          </button>
        );
      })}
    </div>
  );
}
