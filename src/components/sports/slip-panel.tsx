import { Minus, Plus, Ticket, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { selectionLabel, SLIP_LIMITS } from "@/lib/sports/markets";

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
}: Props) {
  const odds = totalOdds(selections);
  const payout = Math.min(stake * odds, SLIP_LIMITS.maxPayout);
  const capped = stake * odds > SLIP_LIMITS.maxPayout;

  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Ticket className="size-4" />
          Bilhete
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{selections.length}</span>
        </p>
        {selections.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <Trash2 className="size-4" /> Limpar
          </Button>
        )}
      </div>

      {selections.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          Escolha uma cotação para começar o bilhete. Aposta mínima {money(SLIP_LIMITS.minStake)} MZN.
        </p>
      ) : (
        <div className="max-h-[38vh] space-y-3 overflow-y-auto px-4 py-3">
          {selections.map((item) => (
            <div key={`${item.eventId}:${item.market}:${item.selection}:${item.line ?? ""}`} className="text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {selectionLabel(item.market, item.selection, item.line, item.homeTeam, item.awayTeam)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.homeTeam} — {item.awayTeam}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold">{item.price.toFixed(2)}</span>
                  <button
                    type="button"
                    aria-label="Remover seleção"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => onRemove(item)}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
              <Separator className="mt-3" />
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            aria-label="Diminuir valor"
            onClick={() => onStake(Math.max(SLIP_LIMITS.minStake, stake - 5))}
          >
            <Minus className="size-4" />
          </Button>
          <Input
            inputMode="decimal"
            value={String(stake)}
            aria-label="Valor da aposta em meticais"
            className="text-center font-mono text-base font-semibold"
            onChange={(event) => {
              const next = Number(event.target.value.replace(",", "."));
              if (Number.isFinite(next)) onStake(next);
            }}
          />
          <Button
            variant="secondary"
            size="icon"
            aria-label="Aumentar valor"
            onClick={() => onStake(Math.min(SLIP_LIMITS.maxStake, stake + 5))}
          >
            <Plus className="size-4" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {[3, 5, 10, 20, 50].map((value) => (
            <Button key={value} variant="outline" size="sm" onClick={() => onStake(value)}>
              {value}
            </Button>
          ))}
        </div>

        <div className="space-y-1 rounded-xl bg-muted/60 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cotação total</span>
            <span className="font-mono font-semibold">{odds.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ganho possível</span>
            <span className="font-mono font-semibold">{money(payout)} MZN</span>
          </div>
          {capped && (
            <p className="text-xs text-muted-foreground">
              Ganho limitado ao máximo por bilhete ({money(SLIP_LIMITS.maxPayout)} MZN).
            </p>
          )}
        </div>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        <Button
          className="h-12 w-full text-base font-bold"
          disabled={pending || selections.length === 0 || stake < SLIP_LIMITS.minStake}
          onClick={onSubmit}
        >
          {!signedIn ? "Entrar para apostar" : pending ? "A registar…" : "Apostar"}
        </Button>
        <p className="text-xs text-muted-foreground">
          O valor é debitado e validado no servidor. Apostar envolve risco de perda total do valor
          apostado.
        </p>
      </div>
    </div>
  );
}
