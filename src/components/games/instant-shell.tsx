/**
 * Moldura partilhada das mesas de jogada individual.
 *
 * Apenas apresentação: valores, resultado e prémio vêm sempre do servidor.
 */
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { GameTopBar } from "@/components/games/game-chrome";
import * as sound from "@/lib/crash/sound";
import { useClock } from "@/lib/games/use-clock";
import type { InstantRoundView } from "@/lib/games/instant.functions";
import { cn } from "@/lib/utils";

const NUM = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CHIPS = [3, 10, 25, 50, 100, 250];

export function InstantShell({
  title,
  accent,
  balance,
  history,
  children,
  footer,
}: {
  title: string;
  accent: string;
  balance: number | null;
  history: InstantRoundView[];
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const clock = useClock();
  const [muted, setMuted] = useState(false);

  useEffect(() => setMuted(sound.loadMutePreference()), []);

  return (
    <div className="min-h-screen bg-fish-bg text-fish-text">
      <GameTopBar
        title={title}
        accent={accent}
        balance={balance}
        clock={clock}
        muted={muted}
        onToggleMute={() => {
          const next = !muted;
          sound.setMuted(next);
          setMuted(next);
          if (!next) sound.ensureAudio();
        }}
      />

      <div className="flex gap-2 overflow-x-auto border-b border-fish-line/70 bg-fish-bg px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {history.length === 0 && (
          <span className="text-xs text-fish-muted">Ainda não tem jogadas terminadas.</span>
        )}
        {history.map((round) => {
          const won = round.status === "cashed_out" && (round.payout ?? 0) > 0;
          return (
            <span
              key={round.id}
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold tabular-nums",
                won
                  ? "border-game-mid/60 bg-game-mid/15 text-game-mid"
                  : "border-game-low/60 bg-game-low/15 text-game-low",
              )}
            >
              {round.multiplier.toFixed(2)}x
            </span>
          );
        })}
      </div>

      <main className="mx-auto w-full max-w-2xl px-3 pb-28 pt-3">
        {children}

        <p className="mt-4 flex items-start gap-2 rounded-xl border border-fish-line/70 bg-fish-panel/60 p-3 text-[11px] leading-relaxed text-fish-muted">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" style={{ color: accent }} />
          <span>
            O resultado de cada jogada é fixado e selado no servidor antes de escolher. A chave de
            verificação é revelada quando a jogada termina, e o dinheiro só se move pelo registo da
            sua carteira. Retorno oficial de 97%.
          </span>
        </p>
      </main>

      <footer className="fixed inset-x-0 bottom-0 border-t border-fish-line/70 bg-fish-panel/95 px-3 py-3 backdrop-blur">
        <div className="mx-auto w-full max-w-2xl">{footer}</div>
      </footer>
    </div>
  );
}

/** Escolha do valor da aposta, com fichas rápidas e origem do saldo. */
export function StakeBar({
  stake,
  setStake,
  accent,
  disabled,
  options,
  selected,
  onFunding,
  action,
}: {
  stake: string;
  setStake: (value: string) => void;
  accent: string;
  disabled: boolean;
  options: { key: "wallet" | "bonus" | "free_bet"; label: string }[];
  selected: "wallet" | "bonus" | "free_bet";
  onFunding: (value: "wallet" | "bonus" | "free_bet") => void;
  action: React.ReactNode;
}) {
  const value = Number(stake);
  const step = (delta: number) =>
    setStake(String(Math.max(3, Math.min(25000, (Number.isFinite(value) ? value : 3) + delta))));

  return (
    <div className="space-y-2">
      {options.length > 1 && (
        <div className="flex gap-1.5">
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => onFunding(option.key)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-bold",
                selected === option.key
                  ? "border-transparent text-fish-bg"
                  : "border-fish-line/70 bg-fish-step text-fish-muted",
              )}
              style={selected === option.key ? { backgroundColor: accent } : undefined}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-2">
        <div className="rounded-xl border border-fish-line/70 bg-fish-step p-1.5">
          <div className="flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={() => step(-5)}
              aria-label="Diminuir aposta"
              className="grid size-7 place-items-center rounded-full bg-fish-panel text-fish-muted"
            >
              −
            </button>
            <input
              value={stake}
              onChange={(event) => setStake(event.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              aria-label="Valor da aposta em meticais"
              className="w-full bg-transparent text-center text-lg font-black tabular-nums outline-none"
            />
            <button
              type="button"
              onClick={() => step(5)}
              aria-label="Aumentar aposta"
              className="grid size-7 place-items-center rounded-full bg-fish-panel text-fish-muted"
            >
              +
            </button>
          </div>
          <div className="mt-1 flex gap-1">
            {CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setStake(String(chip))}
                disabled={disabled}
                className="flex-1 rounded-md bg-fish-panel py-1 text-[11px] font-bold text-fish-muted disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
        {action}
      </div>

      <p className="text-center text-[11px] text-fish-muted">
        Mínimo 3,00 MZN · Máximo {NUM.format(25000)} MZN
      </p>
    </div>
  );
}

/** Botão grande de ação (abrir jogada ou levantar prémio). */
export function BigButton({
  label,
  sub,
  tone,
  disabled,
  onClick,
}: {
  label: string;
  sub?: string;
  tone: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center justify-center rounded-xl px-3 py-2 font-black leading-tight text-fish-bg transition disabled:opacity-50"
      style={{ backgroundColor: tone }}
    >
      <span className="text-base">{label}</span>
      {sub && <span className="text-xs font-bold opacity-80">{sub}</span>}
    </button>
  );
}
