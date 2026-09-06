import { useState } from "react";
import { Button } from "@/components/ui/button";

const MZN = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "MZN" });

type StatBet = {
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
  { id: "ganhos", label: "Principais Ganhos" },
];

/** Faixa de estatísticas da ronda com dados exclusivamente confirmados pelo servidor. */
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
    <section className="mt-2 overflow-hidden rounded-2xl border border-bet-line bg-bet-surface">
      <div className="grid grid-cols-3 gap-1 border-b border-bet-line bg-bet-panel p-1">
        {TABS.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant="ghost"
            onClick={() => setTab(item.id)}
            className={`h-8 rounded-full px-1.5 text-[11px] font-semibold sm:text-sm ${
              tab === item.id
                ? "bg-bet-ghost text-bet-ghost-foreground hover:bg-bet-ghost"
                : "text-bet-muted hover:bg-bet-ghost/60 hover:text-bet-foreground"
            }`}
          >
            <span className="sm:hidden">{item.id === "todas" ? "Todas" : item.id === "minhas" ? "Minhas" : "Ganhos"}</span>
            <span className="hidden sm:inline">{item.label}</span>
          </Button>
        ))}
      </div>

      <div className="px-3 py-2.5 sm:px-5">
        <div className="flex items-center justify-between gap-3 border-b border-bet-line pb-2">
          <div>
            <p className="text-xs text-bet-muted">Total de apostas</p>
            <p className="text-base font-semibold tabular-nums text-bet-foreground">
              {rows.length}/{bets.length}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-bet-muted">Ganho total MZN</p>
            <p className="text-base font-semibold tabular-nums text-bet-foreground">
              {MZN.format(totalPaid).replace("MZN", "").trim()}
            </p>
          </div>
        </div>

        <div className="mt-2 space-y-1">
          {rows.length === 0 ? (
            <p className="py-2 text-center text-xs text-bet-muted">
              {tab === "minhas"
                ? "Ainda não tem apostas registadas."
                : tab === "ganhos"
                  ? "Sem ganhos registados até agora."
                  : "Nenhuma aposta nesta ronda ainda."}
            </p>
          ) : (
            rows.slice(0, 5).map((row) => (
              <div key={row.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl px-2 py-2 text-xs odd:bg-bet-panel">
                <span className="truncate text-bet-muted">{row.player}</span>
                <span className="tabular-nums text-bet-foreground">{MZN.format(row.amount)}</span>
                <span className="text-right font-semibold tabular-nums text-bet-green">
                  {row.multiplier ? `${row.multiplier.toFixed(2)}x` : row.status === "active" ? "Em jogo" : "—"}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 border-t border-bet-line pt-2 text-xs">
          <span className="text-bet-muted">Total apostado</span>
          <span className="font-semibold tabular-nums text-bet-foreground">{MZN.format(totalStaked)}</span>
        </div>
      </div>
    </section>
  );
}
