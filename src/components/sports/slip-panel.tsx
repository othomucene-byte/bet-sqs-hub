import { Minus, Plus, Ticket, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { selectionLabel, MARKET_NAMES, SLIP_LIMITS, type Market } from "@/lib/sports/markets";
import { cn } from "@/lib/utils";

export type SlipSelection = {
  eventId: string;
  market: "h2h" | "dc" | "totals" | "btts";
  selection: string;
  line: number | null;
  price: number;
  homeTeam: string;
  awayTeam: string;
};

const money = (value: number) =>
  new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

export function totalOdds(selections: SlipSelection[]): number {
  return selections.reduce((acc, item) => acc * item.price, 1);
}

type Props = {
  selections: SlipSelection[];
  stake: number;
  signedIn: boolean;
  pending: boolean;
  error: string | null;
  onStake: (value: number) => void;
  onRemove: (selection: SlipSelection) => void;
  onClear: () => void;
  onSubmit: () => void;
  className?: string;
};

export function SlipPanel({
  selections,
  stake,
  signedIn,
  pending,
  error,
  onStake,
  onRemove,
  onClear,
  onSubmit,
  className,
}: Props) {
  const odds = totalOdds(selections);
  const payout = Math.min(stake * odds, SLIP_LIMITS.maxPayout);
  const capped = stake * odds > SLIP_LIMITS.maxPayout;
  const multiple = selections.length > 1;

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm", className)}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b bg-muted/40 px-3 py-2.5">
        <p className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <Ticket className="size-4 shrink-0 text-primary" />
          <span className="truncate">{multiple ? "Bilhete múltiplo" : "Bilhete"}</span>
          <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 font-mono text-xs text-primary">
            {selections.length}
          </span>
        </p>
        {selections.length > 0 && (
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onClear}>
            <Trash2 className="size-3.5" /> Limpar
          </Button>
        )}
      </div>

      {selections.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Toque numa cotação para começar.
          <br />
          Aposta mínima {money(SLIP_LIMITS.minStake)} MZN.
        </p>
      ) : (
        <ul className="max-h-[34vh] divide-y overflow-y-auto lg:max-h-[38vh]">
          {selections.map((item) => (
            <li
              key={`${item.eventId}:${item.market}:${item.selection}:${item.line ?? ""}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {selectionLabel(item.market, item.selection, item.line, item.homeTeam, item.awayTeam)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.homeTeam} — {item.awayTeam}
                </p>
                <p className="mt-0.5 truncate text-[11px] uppercase tracking-wide text-muted-foreground/80">
                  {MARKET_NAMES[item.market as Market]}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-md bg-muted px-2 py-1 font-mono text-sm font-bold">
                  {item.price.toFixed(2)}
                </span>
                <button
                  type="button"
                  aria-label="Remover seleção"
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={() => onRemove(item)}
                >
                  <X className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 border-t px-3 py-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="size-10 shrink-0 rounded-xl"
            aria-label="Diminuir valor"
            onClick={() => onStake(Math.max(SLIP_LIMITS.minStake, stake - 5))}
          >
            <Minus className="size-4" />
          </Button>
          <div className="relative min-w-0">
            <Input
              inputMode="decimal"
              value={String(stake)}
              aria-label="Valor da aposta em meticais"
              className="h-10 rounded-xl pr-12 text-center font-mono text-base font-bold"
              onChange={(event) => {
                const next = Number(event.target.value.replace(",", "."));
                if (Number.isFinite(next)) onStake(next);
              }}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
              MZN
            </span>
          </div>
          <Button
            variant="secondary"
            size="icon"
            className="size-10 shrink-0 rounded-xl"
            aria-label="Aumentar valor"
            onClick={() => onStake(Math.min(SLIP_LIMITS.maxStake, stake + 5))}
          >
            <Plus className="size-4" />
          </Button>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {[3, 5, 10, 20, 50].map((value) => (
            <Button
              key={value}
              variant={stake === value ? "default" : "outline"}
              size="sm"
              className="h-8 rounded-lg px-0 font-mono text-xs"
              onClick={() => onStake(value)}
            >
              {value}
            </Button>
          ))}
        </div>

        <div className="space-y-1.5 rounded-xl bg-muted/60 p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Cotação total</span>
            <span className="font-mono font-bold">{odds.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Ganho possível</span>
            <span className="font-mono font-bold text-primary">{money(payout)} MZN</span>
          </div>
          {capped && (
            <p className="text-xs text-muted-foreground">
              Ganho limitado ao máximo por bilhete ({money(SLIP_LIMITS.maxPayout)} MZN).
            </p>
          )}
        </div>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        <Button
          className="h-12 w-full rounded-xl text-base font-bold"
          disabled={pending || selections.length === 0 || stake < SLIP_LIMITS.minStake}
          onClick={onSubmit}
        >
          {!signedIn ? "Entrar para apostar" : pending ? "A registar…" : "Apostar"}
        </Button>
        <p className="text-[11px] leading-snug text-muted-foreground">
          O valor é debitado e validado no servidor. Apostar envolve risco de perda total do valor
          apostado.
        </p>
      </div>
    </div>
  );
}
