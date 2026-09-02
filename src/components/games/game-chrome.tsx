import { Link } from "@tanstack/react-router";
import { ChevronLeft, Volume2, VolumeX } from "lucide-react";

/** Barra superior do jogo: marca, hora, saldo real da carteira e som. */
const NUM = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function GameTopBar({
  title,
  accent,
  balance,
  clock,
  muted,
  onToggleMute,
}: {
  title: string;
  /** Cor da marca do jogo (token CSS). */
  accent: string;
  balance: number | null;
  clock: string;
  muted: boolean;
  onToggleMute: () => void;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-fish-line/70 bg-fish-panel px-3 py-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <Link
          to="/"
          aria-label="Voltar"
          className="grid size-7 shrink-0 place-items-center rounded-full bg-fish-step text-fish-muted"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <span
          className="truncate font-display text-lg font-black italic tracking-tight sm:text-xl"
          style={{ color: accent }}
        >
          {title}
        </span>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-fish-muted">{clock}</span>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-bold tabular-nums">
          <span className="text-fish-green">{balance === null ? "—" : NUM.format(balance)}</span>{" "}
          <span className="text-fish-muted">MZN</span>
        </span>
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? "Ligar som" : "Desligar som"}
          className="grid size-7 place-items-center rounded-full bg-fish-step text-fish-muted"
        >
          {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
        </button>
      </div>
    </header>
  );
}

/** Faixa de multiplicadores das últimas rondas. */
export function HistoryStrip({
  items,
  onSelect,
}: {
  items: { roundNumber: number; multiplier: number | null }[];
  onSelect?: (roundNumber: number) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto border-b border-fish-line/60 bg-fish-bg px-3 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.length === 0 && (
        <span className="text-xs text-fish-muted">Sem rondas terminadas ainda.</span>
      )}
      {items.map((item) => {
        const m = item.multiplier ?? 0;
        const tone = m >= 10 ? "text-fuchsia-400" : m >= 2 ? "text-violet-400" : "text-sky-400";
        return (
          <button
            key={item.roundNumber}
            type="button"
            onClick={() => onSelect?.(item.roundNumber)}
            className={`shrink-0 text-sm font-bold tabular-nums ${tone}`}
          >
            {m.toFixed(2)}
          </button>
        );
      })}
    </div>
  );
}

/** Rodapé com totais da ronda confirmados pelo servidor. */
export function TotalsBar({ staked, paid }: { staked: number; paid: number }) {
  return (
    <div className="flex items-end justify-between gap-3 border-t border-fish-line/70 bg-fish-panel px-3 py-2">
      <div className="min-w-0">
        <p className="text-[11px] text-fish-muted">Total apostado</p>
        <p className="truncate text-sm font-bold tabular-nums">{NUM.format(staked)} MZN</p>
      </div>
      <div className="min-w-0 text-right">
        <p className="text-[11px] text-fish-muted">Total pago</p>
        <p className="truncate text-sm font-bold tabular-nums text-fish-green">
          {NUM.format(paid)} MZN
        </p>
      </div>
    </div>
  );
}
