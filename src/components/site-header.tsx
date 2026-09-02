import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/integrations/supabase/client";

/** Navegação pública — visível a quem não tem sessão. */
const publicLinks = [
  { href: "/investimentos", label: "Investimentos" },
  { href: "/empresas", label: "Empresas" },
  { href: "/pagamentos", label: "Pagamentos" },
  { href: "/#seguranca", label: "Segurança" },
];

/** Navegação da conta — só depois de autenticação. */
const memberLinks = [
  { href: "/investidor", label: "Investidor" },
  { href: "/carteira", label: "Carteira" },
  { href: "/crash", label: "Aviator" },
  { href: "/fish", label: "Fish Crash" },
  { href: "/kyc", label: "KYC" },
  { href: "/notificacoes", label: "Notificações" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const links = signedIn ? memberLinks : publicLinks;

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4">
        <BrandLogo />

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
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
          <ThemeToggle />
          {signedIn ? (
            <Button variant="outline" size="sm" className="hidden sm:inline-flex" asChild>
              <a href="/investidor">A minha conta</a>
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
                <a href="/auth">Entrar</a>
              </Button>
              <Button size="sm" className="hidden sm:inline-flex" asChild>
                <a href="/auth">Criar conta</a>
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Abrir menu"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border/60 bg-background px-4 py-3 lg:hidden">
          <nav className="flex flex-col">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
          </nav>
          {signedIn ? (
            <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
              <a href="/investidor">A minha conta</a>
            </Button>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="/auth">Entrar</a>
              </Button>
              <Button size="sm" asChild>
                <a href="/auth">Criar conta</a>
              </Button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
