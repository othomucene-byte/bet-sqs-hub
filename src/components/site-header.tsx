import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouter } from "@tanstack/react-router";
import {
  Gift,
  Banknote,
  Bell,
  Building2,
  Car,
  ChevronDown,
  Code2,
  CreditCard,
  Fish,
  IdCard,
  LineChart,
  LogOut,
  Menu,
  Plane,
  ShieldCheck,
  ShieldHalf,
  Ship,
  Ticket,
  Trophy,
  UserRound,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { getWalletBalances } from "@/lib/investments/investments.functions";
import { amIAdmin } from "@/lib/admin/admin.functions";

const MZN = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "MZN",
  minimumFractionDigits: 2,
});

type NavLink = { href: string; label: string; icon: typeof Wallet };
type NavGroup = { title: string; links: NavLink[] };

/** Navegação pública — visível a quem não tem sessão. */
const publicGroups: NavGroup[] = [
  {
    title: "Apostas",
    links: [{ href: "/desportos", label: "Desportos", icon: Trophy }],
  },
  {
    title: "Investimentos",
    links: [
      { href: "/exchange", label: "SQs Exchange", icon: LineChart },
      { href: "/investimentos", label: "Investimentos", icon: LineChart },
      { href: "/empresas", label: "Empresas", icon: Building2 },
      { href: "/pagamentos", label: "Pagamentos", icon: CreditCard },
    ],
  },

  {
    title: "Plataforma",
    links: [{ href: "/#seguranca", label: "Segurança", icon: ShieldCheck }],
  },
];

/** Navegação da conta — só depois de autenticação. */
const memberGroups: NavGroup[] = [
  {
    title: "Conta",
    links: [
      { href: "/investidor", label: "A minha conta", icon: UserRound },
      { href: "/carteira", label: "Carteira", icon: Wallet },
      { href: "/kyc", label: "KYC", icon: IdCard },
      { href: "/notificacoes", label: "Notificações", icon: Bell },
    ],
  },
  {
    title: "Apostas",
    links: [
      { href: "/desportos", label: "Desportos", icon: Trophy },
      { href: "/bilhetes", label: "Os meus bilhetes", icon: Ticket },
      { href: "/crash", label: "Aviator", icon: Plane },
      { href: "/fish", label: "Fish Crash", icon: Fish },
      { href: "/navigator", label: "Navigator", icon: Ship },
      { href: "/boost", label: "Boost Race", icon: Car },
      { href: "/promocoes", label: "Promoções", icon: Gift },
    ],
  },
  {
    title: "Investimentos",
    links: [
      { href: "/exchange", label: "SQs Exchange", icon: LineChart },
      { href: "/exchange/portfolio", label: "Carteira do mercado", icon: LineChart },
      { href: "/investimentos", label: "Investimentos", icon: LineChart },
      { href: "/empresas", label: "Empresas", icon: Building2 },
      { href: "/pagamentos", label: "Pagamentos", icon: CreditCard },
    ],
  },

  {
    title: "Plataforma",
    links: [
      { href: "/developers", label: "API developers", icon: Code2 },
      { href: "/#seguranca", label: "Segurança", icon: ShieldCheck },
    ],
  },
];

/** Top links do desktop — subconjunto plano dos grupos. */
function flatLinks(groups: NavGroup[]) {
  return groups.flatMap((g) => g.links).slice(0, 5);
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSignedIn(Boolean(data.session));
      setEmail(data.session?.user.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
      setEmail(session?.user.email ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const fetchBalances = useServerFn(getWalletBalances);
  const balances = useQuery({
    queryKey: ["wallet-balances"],
    queryFn: () => fetchBalances(),
    enabled: signedIn,
    staleTime: 15_000,
  });

  const checkAdmin = useServerFn(amIAdmin);
  const adminQuery = useQuery({
    queryKey: ["am-i-admin"],
    queryFn: () => checkAdmin(),
    enabled: signedIn,
    staleTime: 60_000,
  });
  const isAdmin = Boolean(adminQuery.data?.admin);

  const baseGroups = signedIn ? memberGroups : publicGroups;
  const groups: NavGroup[] = isAdmin
    ? [
        ...baseGroups,
        {
          title: "Administração",
          links: [{ href: "/admin", label: "Painel de Administração", icon: ShieldHalf }],
        },
      ]
    : baseGroups;
  const desktopLinks = flatLinks(baseGroups);
  const betting = balances.data?.betting;
  const bettingLabel = betting === undefined ? "—" : MZN.format(betting);

  async function signOut() {
    setOpen(false);
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-3 sm:px-4">
        {signedIn ? (
          <>
            <div className="sm:hidden">
              <BrandLogo compact />
            </div>
            <div className="hidden sm:block">
              <BrandLogo />
            </div>
          </>
        ) : (
          <BrandLogo />
        )}

        <nav className="hidden items-center gap-1 lg:flex">
          {desktopLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          {signedIn ? (
            <>
              <Button
                asChild
                className="h-9 bg-bet-green px-3 text-sm font-bold uppercase tracking-wide text-bet-green-foreground hover:bg-bet-green/90 sm:px-4"
              >
                <a href="/pagamentos">Depósito</a>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Saldo e conta"
                    className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 text-foreground transition-colors hover:bg-secondary/70"
                  >
                    <Banknote className="size-4 shrink-0 text-muted-foreground" />
                    <span className="font-display text-sm font-bold tabular-nums">
                      {bettingLabel}
                    </span>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <div className="space-y-2 px-2 py-2">
                    <Row label="Utilizador" value={email ?? "—"} />
                    <Row label="Saldo de apostas" value={bettingLabel} strong />
                    <Row
                      label="Saldo de investimentos"
                      value={
                        balances.data?.investment === undefined
                          ? "—"
                          : MZN.format(balances.data.investment)
                      }
                      strong
                    />
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="h-10 text-sm">
                    <a href="/pagamentos">Depositar</a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="h-10 text-sm">
                    <a href="/pagamentos">Levantar</a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="h-10 text-sm">
                    <a href="/investidor">A minha conta</a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="h-10 text-sm">
                    <a href="/developers">
                      <Code2 className="size-4" /> API developers
                    </a>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem asChild className="h-10 text-sm">
                      <a href="/admin">
                        <ShieldHalf className="size-4" /> Painel de Administração
                      </a>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="h-10 text-sm" onClick={() => void signOut()}>
                    <LogOut className="size-4" /> Terminar sessão
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="hidden h-9 sm:inline-flex" asChild>
                <a href="/auth">Entrar</a>
              </Button>
              <Button size="sm" className="h-9 px-3 font-semibold sm:px-4" asChild>
                <a href="/auth">Criar conta</a>
              </Button>
            </>
          )}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="size-9 lg:hidden" aria-label="Abrir menu">
                <Menu className="size-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[19rem] gap-0 overflow-y-auto p-0">
              <SheetTitle className="sr-only">Menu</SheetTitle>

              <div className="space-y-3 border-b border-border/60 p-4 pt-12">
                {signedIn ? (
                  <>
                    <div className="rounded-xl border border-border bg-secondary/60 p-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Saldo de apostas
                      </p>
                      <p className="font-display text-2xl font-bold tabular-nums">{bettingLabel}</p>
                      {email && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">{email}</p>
                      )}
                    </div>
                    <Button
                      asChild
                      className="h-11 w-full bg-bet-green text-base font-bold uppercase tracking-wide text-bet-green-foreground hover:bg-bet-green/90"
                    >
                      <a href="/pagamentos" onClick={() => setOpen(false)}>
                        Depósito
                      </a>
                    </Button>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="h-11" asChild>
                      <a href="/auth" onClick={() => setOpen(false)}>
                        Entrar
                      </a>
                    </Button>
                    <Button className="h-11 font-semibold" asChild>
                      <a href="/auth" onClick={() => setOpen(false)}>
                        Criar conta
                      </a>
                    </Button>
                  </div>
                )}
              </div>

              <nav className="p-3">
                {groups.map((group) => (
                  <div key={group.title} className="mb-2">
                    <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.title}
                    </p>
                    {group.links.map((l) => {
                      const Icon = l.icon;
                      const active =
                        typeof window !== "undefined" && window.location.pathname === l.href;
                      return (
                        <a
                          key={`${group.title}-${l.href}`}
                          href={l.href}
                          onClick={() => setOpen(false)}
                          className={`flex h-12 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors ${
                            active
                              ? "bg-primary/15 font-semibold text-foreground"
                              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                          }`}
                        >
                          <Icon className="size-5 shrink-0" />
                          {l.label}
                        </a>
                      );
                    })}
                  </div>
                ))}

                <div className="flex h-12 items-center justify-between rounded-xl px-3">
                  <span className="text-[15px] text-muted-foreground">Tema</span>
                  <ThemeToggle />
                </div>
              </nav>

              {signedIn && (
                <div className="border-t border-border/60 p-3">
                  <Button
                    variant="outline"
                    className="h-11 w-full justify-start gap-3 text-[15px]"
                    onClick={() => void signOut()}
                  >
                    <LogOut className="size-5" /> Terminar sessão
                  </Button>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={`truncate text-right text-sm ${strong ? "font-display font-bold tabular-nums" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
