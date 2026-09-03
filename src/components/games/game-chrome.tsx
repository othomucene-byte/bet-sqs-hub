import { Link } from "@tanstack/react-router";
import { ChevronLeft, History, Volume2, VolumeX } from "lucide-react";

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
  accent: string;
  balance: number | null;
  clock: string;
  muted: boolean;
  onToggleMute: () => void;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-fish-line/70 bg-fish-panel px-3 py-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <Link to="/" aria-label="Voltar" className="grid size-7 shrink-0 place-items-center rounded-full bg-fish-step text-fish-muted">
          <ChevronLeft className="size-4" />
        </Link>
        <span className="truncate font-display text-lg font-black italic tracking-tight sm:text-xl" style={{ color: accent }}>
          {title}
        </span>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-fish-muted">{clock}</span>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-bold tabular-nums">
          <span className="text-fish-green">{balance === null ? "—" : NUM.format(balance)}</span>{" "}
          <span className="text-fish-muted">MZN</span>
        </span>
        <button type="button" onClick={onToggleMute} aria-label={muted ? "Ligar som" : "Desligar som"} className="grid size-7 place-items-center rounded-full bg-fish-step text-fish-muted">
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
    <div className="flex gap-2 overflow-x-auto border-b border-fish-line/70 bg-fish-bg px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.length === 0 && <span className="text-xs text-fish-muted">Sem rondas terminadas ainda.</span>}
      {items.map((item) => {
        const m = item.multiplier ?? 0;
        const tone = m >= 10 ? "border-game-high/60 bg-game-high/15 text-game-high" : m >= 2 ? "border-game-mid/60 bg-game-mid/15 text-game-mid" : "border-game-low/60 bg-game-low/15 text-game-low";
        return (
          <button key={item.roundNumber} type="button" onClick={() => onSelect?.(item.roundNumber)} className={`shrink-0 rounded-full border px-2.5 py-0.5 text-sm font-extrabold tabular-nums ${tone}`}>
            {m.toFixed(2)}x
          </button>
        );
      })}
    </div>
  );
}

/** Totais confirmados pelo servidor e acesso visual à ronda anterior. */
export function TotalsBar({
  totalBets,
  staked,
  paid,
  onPreviousRound,
}: {
  totalBets: number;
  staked: number;
  paid: number;
  onPreviousRound?: () => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-bet-line bg-bet-surface px-4 py-3.5 sm:px-5">
      <div className="min-w-0">
        <p className="text-xs text-bet-muted">Total de apostas</p>
        <p className="mt-0.5 text-xl font-semibold tabular-nums text-bet-foreground">{totalBets}</p>
        <p className="text-[11px] text-bet-muted">{NUM.format(staked)} MZN apostados</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-xs text-bet-muted">Ganho total MZN</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-bet-foreground">{NUM.format(paid).replace("MZN", "").trim()}</p>
        </div>
        {onPreviousRound && (
          <button type="button" onClick={onPreviousRound} aria-label="Ver ronda anterior" className="flex h-10 items-center gap-1.5 rounded-full bg-bet-panel px-3 text-xs font-semibold text-bet-foreground transition hover:bg-bet-ghost">
            <History className="size-4" />
            <span className="hidden sm:inline">Ronda anterior</span>
          </button>
        )}
      </div>
    </div>
  );
}
