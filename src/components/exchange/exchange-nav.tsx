import { Link } from "@tanstack/react-router";
import { BarChart3, ClipboardList, LineChart, User, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/exchange", label: "Mercado", icon: LineChart, exact: true },
  { to: "/exchange/portfolio", label: "Carteira", icon: BarChart3, exact: false },
  { to: "/exchange/orders", label: "Ordens", icon: ClipboardList, exact: false },
  { to: "/exchange/wallet", label: "Fundos", icon: Wallet, exact: false },
  { to: "/investidor", label: "Conta", icon: User, exact: false },
] as const;

/** Navegação do módulo: barra inferior no telefone, linha de separadores no ecrã grande. */
export function ExchangeNav({ className }: { className?: string }) {
  return (
    <>
      <nav
        className={cn(
          "hidden gap-1 overflow-x-auto rounded-lg border border-border/60 bg-card/50 p-1 md:flex",
          className,
        )}
      >
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.exact }}
            className="shrink-0 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[status=active]:bg-primary/15 data-[status=active]:text-primary"
          >
            {item.label}
          </Link>
        ))}
        <Link
          to="/exchange/trades"
          className="shrink-0 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[status=active]:bg-primary/15 data-[status=active]:text-primary"
        >
          Negócios
        </Link>
        <Link
          to="/exchange/history"
          className="shrink-0 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[status=active]:bg-primary/15 data-[status=active]:text-primary"
        >
          Histórico
        </Link>
      </nav>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border/60 bg-background/95 backdrop-blur md:hidden">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.exact }}
            className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground data-[status=active]:text-primary"
          >
            <item.icon className="size-5" />
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

export function PaperBadge() {
  return (
    <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-400">
      Simulação · Paper trading
    </span>
  );
}

/** Identifica claramente se o ecrã está a mostrar dinheiro real ou simulação. */
export function EnvBadge({ environment }: { environment: "LIVE" | "PAPER" }) {
  if (environment === "PAPER") return <PaperBadge />;
  return (
    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-400">
      Mercado real · MZN
    </span>
  );
}
