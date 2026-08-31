import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const MZN = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "MZN" });
const CHIPS = [10, 25, 50, 100];

export type BetState = {
  amount: string;
  autoEnabled: boolean;
  autoValue: string;
};

/**
 * Painel de aposta. O botão reflete o estado que o servidor reporta —
 * nunca antecipa resultados nem calcula saldo.
 */
export function BetPanel({
  state,
  onChange,
  status,
  bet,
  liveMultiplier,
  minBet,
  maxBet,
  onPlace,
  onCashout,
  placing,
  cashingOut,
}: {
  state: BetState;
  onChange: (next: BetState) => void;
  status: string;
  bet: {
    id: string;
    amount: number;
    autoCashout: number | null;
    cashoutMultiplier: number | null;
    payout: number | null;
    status: "active" | "cashed_out" | "lost" | "refunded";
  } | null;
  liveMultiplier: number;
  minBet: number;
  maxBet: number;
  onPlace: () => void;
  onCashout: (betId: string) => void;
  placing: boolean;
  cashingOut: boolean;
}) {
  const amountNumber = Number(state.amount) || 0;
  const locked = Boolean(bet) || status === "RUNNING";
  const canBet = status === "BETTING" && !bet && amountNumber >= minBet && amountNumber <= maxBet;
  const canCashout = status === "RUNNING" && bet?.status === "active";

  const setAmount = (value: number) =>
    onChange({ ...state, amount: String(Math.min(maxBet, Math.max(minBet, Math.round(value)))) });

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="bet-amount" className="text-xs uppercase tracking-wide text-muted-foreground">
              Valor da aposta
            </Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="rounded-full"
                aria-label="Diminuir aposta"
                disabled={locked}
                onClick={() => setAmount(amountNumber - 10)}
              >
                <Minus className="size-4" />
              </Button>
              <Input
                id="bet-amount"
                inputMode="decimal"
                className="text-center font-display text-lg font-semibold tabular-nums"
                value={state.amount}
                disabled={locked}
                onChange={(e) => onChange({ ...state, amount: e.target.value })}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="rounded-full"
                aria-label="Aumentar aposta"
                disabled={locked}
                onClick={() => setAmount(amountNumber + 10)}
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              {CHIPS.map((chip) => (
                <Button
                  key={chip}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-7 flex-1 rounded-full text-xs"
                  disabled={locked}
                  onClick={() => setAmount(chip)}
                >
                  {chip}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Mínimo {MZN.format(minBet)} · máximo {MZN.format(maxBet)}
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2">
            <div className="flex items-center gap-2.5">
              <Switch
                id="auto-cashout"
                checked={state.autoEnabled}
                disabled={locked}
                onCheckedChange={(v) => onChange({ ...state, autoEnabled: v })}
              />
              <Label htmlFor="auto-cashout" className="text-xs">
                Cash-out automático
              </Label>
            </div>
            <Input
              inputMode="decimal"
              aria-label="Multiplicador de cash-out automático"
              className="h-8 w-20 text-center text-sm tabular-nums"
              value={state.autoValue}
              disabled={locked || !state.autoEnabled}
              onChange={(e) => onChange({ ...state, autoValue: e.target.value })}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            O cash-out automático é executado pelo servidor, mesmo se perder a ligação.
          </p>
        </div>

        <div className="sm:w-44">
          {canCashout || bet?.status === "active" ? (
            <Button
              type="button"
              size="lg"
              variant="secondary"
              className="h-24 w-full flex-col gap-0.5 rounded-2xl bg-chart-3 text-base font-bold text-background hover:bg-chart-3/90"
              disabled={!canCashout || cashingOut}
              onClick={() => bet && onCashout(bet.id)}
            >
              <span className="text-xs font-medium opacity-80">Levantar</span>
              <span className="font-display text-xl tabular-nums">
                {MZN.format((bet?.amount ?? 0) * liveMultiplier)}
              </span>
            </Button>
          ) : bet ? (
            <div className="flex h-24 w-full flex-col items-center justify-center gap-0.5 rounded-2xl border border-border/60 bg-secondary/50 text-center">
              <span className="text-xs text-muted-foreground">
                {bet.status === "cashed_out"
                  ? `Levantado a ${bet.cashoutMultiplier?.toFixed(2)}x`
                  : bet.status === "lost"
                    ? "Ronda perdida"
                    : "Aposta reembolsada"}
              </span>
              <span className="font-display text-lg font-semibold tabular-nums text-foreground">
                {MZN.format(bet.payout ?? 0)}
              </span>
            </div>
          ) : (
            <Button
              type="button"
              size="lg"
              className="h-24 w-full flex-col gap-0.5 rounded-2xl text-base font-bold"
              disabled={!canBet || placing}
              onClick={onPlace}
            >
              <span className="text-xs font-medium opacity-80">
                {status === "BETTING" ? "Apostar" : "Aguardar ronda"}
              </span>
              <span className="font-display text-xl tabular-nums">
                {MZN.format(amountNumber)}
              </span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
