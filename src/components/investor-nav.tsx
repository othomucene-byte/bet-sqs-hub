import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const items = [
  { to: "/investidor", label: "Resumo" },
  { to: "/investidor/ordens", label: "Ordens" },
  { to: "/investidor/rendimentos", label: "Rendimentos" },
  { to: "/investidor/extrato", label: "Extrato" },
  { to: "/notificacoes", label: "Notificações" },
  { to: "/kyc", label: "KYC" },
] as const;

export function InvestorNav({ className }: { className?: string }) {
  return (
    <nav
      className={cn(
        "flex gap-1 overflow-x-auto rounded-lg border border-border/60 bg-card/50 p-1",
        className,
      )}
    >
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: item.to === "/investidor" }}
          className="shrink-0 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[status=active]:bg-primary/15 data-[status=active]:text-primary"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
