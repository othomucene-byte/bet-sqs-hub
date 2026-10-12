import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouter, useRouterState } from "@tanstack/react-router";
import {
  Gift,
  Banknote,
  Bell,
  Building2,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  Code2,
  CreditCard,
  Gamepad2,
  Handshake,
  IdCard,
  LineChart,
  LogOut,
  Menu,
  ShieldCheck,
  ShieldHalf,
  Ticket,
  Radio,
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
    links: [
      { href: "/jogos", label: "Jogos", icon: Gamepad2 },
      { href: "/trade", label: "SQs Trade", icon: LineChart },
      { href: "/sports", label: "Jogos em direto", icon: Radio },
      { href: "/desportos", label: "Desportos", icon: Trophy },
    ],
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
    links: [
      { href: "/afiliados", label: "Programa de Afiliados", icon: Handshake },
      { href: "/#seguranca", label: "Segurança", icon: ShieldCheck },
    ],
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
      { href: "/jogos", label: "Jogos", icon: Gamepad2 },
      { href: "/trade", label: "SQs Trade", icon: LineChart },
      { href: "/sports", label: "Jogos em direto", icon: Radio },
      { href: "/desportos", label: "Desportos", icon: Trophy },
      { href: "/bilhetes", label: "Os meus bilhetes", icon: Ticket },
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
      { href: "/afiliados", label: "Programa de Afiliados", icon: Handshake },
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
  const pathname = useRouterState({ select: (state) => state.location.pathname });

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
      <div className="mx-auto grid min-h-18 w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 sm:flex sm:justify-between sm:px-6">
        <div className="min-w-0"><BrandLogo /></div>

        <nav className="hidden min-w-0 items-center gap-1 xl:flex">
          {desktopLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-md px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          {signedIn ? (
            <>
              <Button
                asChild
                className="h-10 rounded-md px-3 text-xs font-semibold shadow-none sm:px-4 sm:text-sm"
              >
                <a href="/pagamentos"><ArrowUpRight className="hidden sm:block" />Depósito</a>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    aria-label="Saldo e conta"
                    className="hidden h-10 items-center gap-2 rounded-md border border-border px-3 shadow-none sm:inline-flex"
                  >
                    <Banknote className="size-4 shrink-0 text-muted-foreground" />
                    <span className="font-display text-sm font-bold tabular-nums">
                      {bettingLabel}
                    </span>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  </Button>
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
              <Button variant="ghost" size="icon" className="size-10 rounded-md border border-border bg-card" aria-label="Abrir menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" aria-describedby={undefined} className="flex w-[min(22rem,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden bg-sidebar p-0 text-sidebar-foreground sm:max-w-none">
              <div className="shrink-0 border-b border-sidebar-border px-5 py-5 pr-12">
                <SheetTitle className="sr-only">Menu Betfcom SQs</SheetTitle>
                <BrandLogo />
              </div>

              <div className="shrink-0 space-y-4 border-b border-sidebar-border px-5 py-4">
                {signedIn ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Saldo de apostas
                      </p>
                      <p className="font-display text-2xl font-semibold tabular-nums">{bettingLabel}</p>
                      {email && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">{email}</p>
                      )}
                    </div>
                    <Button
                      asChild
                      className="h-11 w-full justify-between rounded-md text-sm font-semibold shadow-none"
                    >
                      <a href="/pagamentos" onClick={() => setOpen(false)}>
                        Depósito <ArrowUpRight className="size-4" />
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

              <nav aria-label="Navegação principal" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
                {groups.map((group) => (
                  <div key={group.title} className="border-b border-sidebar-border py-3 last:border-0">
                    <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.title}
                    </p>
                    {group.links.map((l) => {
                      const Icon = l.icon;
                      const active =
                        pathname === l.href;
                      return (
                        <a
                          key={`${group.title}-${l.href}`}
                          href={l.href}
                          onClick={() => setOpen(false)}
                          className={`group flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                            active
                              ? "bg-sidebar-accent font-semibold text-sidebar-primary"
                              : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                          }`}
                        >
                          <Icon className="size-5 shrink-0" />
                          {l.label}
                        </a>
                      );
                    })}
                  </div>
                ))}

                <div className="flex h-12 items-center justify-between px-3">
                  <span className="text-sm text-muted-foreground">Tema</span>
                  <ThemeToggle />
                </div>
              </nav>

              {signedIn && (
                <div className="shrink-0 border-t border-sidebar-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  <Button
                    variant="outline"
                    className="h-10 w-full justify-start gap-3 rounded-md text-sm shadow-none"
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
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
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
