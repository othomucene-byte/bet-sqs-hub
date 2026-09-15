import { Link } from "@tanstack/react-router";
import { BarChart3, ClipboardList, Code2, History, LineChart, ListChecks, Star, User, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/exchange", label: "Mercado", icon: LineChart, exact: true },
  { to: "/exchange/portfolio", label: "Carteira", icon: BarChart3, exact: false },
  { to: "/exchange/orders", label: "Ordens", icon: ClipboardList, exact: false },
  { to: "/exchange/wallet", label: "Fundos", icon: Wallet, exact: false },
  { to: "/investidor", label: "Conta", icon: User, exact: false },
] as const;

/** Navegação do módulo: barra inferior no telefone, linha de separadores no ecrã grande. */
export function ExchangeNav({ className, variant = "all" }: { className?: string; variant?: "all" | "sidebar" | "mobile" }) {
  return (
    <>
      {(variant === "all" || variant === "sidebar") && <nav
        className={cn(
          "hidden w-52 shrink-0 flex-col gap-1 border-r border-border/60 bg-card/30 px-3 py-5 md:flex",
          className,
        )}
      >
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">SQs Exchange</p>
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.exact }}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[status=active]:bg-primary/15 data-[status=active]:text-primary"
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        ))}
        <Link
          to="/exchange/trades"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[status=active]:bg-primary/15 data-[status=active]:text-primary"
        >
          <ListChecks className="size-4" />
          Negócios
        </Link>
        <Link
          to="/exchange/history"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[status=active]:bg-primary/15 data-[status=active]:text-primary"
        >
          <History className="size-4" />
          Histórico
        </Link>
        <Link to="/exchange/watchlist" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground data-[status=active]:bg-primary/15 data-[status=active]:text-primary">
          <Star className="size-4" /> Favoritos
        </Link>
        <Link to="/developers" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground data-[status=active]:bg-primary/15 data-[status=active]:text-primary">
          <Code2 className="size-4" /> API developers
        </Link>
      </nav>}

      {(variant === "all" || variant === "mobile") && <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border/60 bg-background/95 backdrop-blur md:hidden">
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
      </nav>}
    </>
  );
}

/** Identifica o mercado real em meticais. */
export function LiveBadge() {
  return (
    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-400">
      Mercado real · MZN
    </span>
  );
}

