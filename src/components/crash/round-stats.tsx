import { useState } from "react";

import { Card, CardContent } from "@/components/ui/card";

const MZN = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "MZN" });

export type StatBet = {
  id: string;
  player: string;
  amount: number;
  multiplier: number | null;
  payout: number | null;
  status: string;
};

type Tab = "todas" | "minhas" | "ganhos";

const TABS: { id: Tab; label: string }[] = [
  { id: "todas", label: "Todas as apostas" },
  { id: "minhas", label: "As minhas apostas" },
  { id: "ganhos", label: "Maiores ganhos" },
];

/** Painel de estatísticas — só mostra dados vindos do servidor. */
export function RoundStats({
  bets,
  top,
  myBets,
  totalStaked,
  totalPaid,
}: {
  bets: StatBet[];
  top: StatBet[];
  myBets: StatBet[];
  totalStaked: number;
  totalPaid: number;
}) {
  const [tab, setTab] = useState<Tab>("todas");
  const rows = tab === "todas" ? bets : tab === "minhas" ? myBets : top;

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex gap-1 rounded-full bg-secondary/60 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-full px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                tab === t.id
                  ? "bg-card text-foreground shadow-card"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between border-b border-border/50 pb-2 text-xs">
          <span className="text-muted-foreground">
            Apostas nesta ronda: <span className="font-semibold text-foreground">{bets.length}</span>
          </span>
          <span className="text-muted-foreground">
            Apostado: <span className="font-semibold text-foreground">{MZN.format(totalStaked)}</span>
          </span>
        </div>

        <div className="space-y-1.5">
          {rows.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">
              {tab === "minhas"
                ? "Ainda não tem apostas registadas."
                : tab === "ganhos"
                  ? "Sem ganhos registados até agora."
                  : "Nenhuma aposta nesta ronda ainda."}
            </p>
          )}
          {rows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-lg px-2 py-1.5 text-xs odd:bg-secondary/30"
            >
              <span className="truncate text-muted-foreground">{row.player}</span>
              <span className="tabular-nums text-foreground">{MZN.format(row.amount)}</span>
              <span
                className={
                  row.multiplier
                    ? "w-24 text-right font-semibold tabular-nums text-primary"
                    : "w-24 text-right tabular-nums text-muted-foreground"
                }
              >
                {row.multiplier
                  ? `${row.multiplier.toFixed(2)}x · ${MZN.format(row.payout ?? 0)}`
                  : row.status === "active"
                    ? "em voo"
                    : "—"}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border/50 pt-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Pago nesta ronda
          </span>
          <span className="font-display text-sm font-bold tabular-nums text-chart-3">
            {MZN.format(totalPaid)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
