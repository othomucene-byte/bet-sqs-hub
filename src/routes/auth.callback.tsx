import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [
      { title: "A confirmar sessão — Betfcom SQs" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthCallback,
});

/** Aceita apenas caminhos relativos da própria aplicação. */
function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

/**
 * O cliente Supabase troca o código/fragmento de retorno por sessão ao carregar
 * a página. Aqui apenas esperamos a sessão e seguimos para o destino guardado.
 */
function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let cancelled = false;
    let attempts = 0;

    const tick = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          const next = safeNext(sessionStorage.getItem("betfcom:next"));
          sessionStorage.removeItem("betfcom:next");
          window.history.replaceState({}, "", "/auth/callback");
          await navigate({ to: next, replace: true });
          return;
        }
      } catch {
        // segue para nova tentativa
      }
      if (attempts >= 40) {
        setError(
          "Não foi possível confirmar a sessão do Google. Volte atrás e tente entrar novamente.",
        );
        return;
      }
      setTimeout(tick, 300);
    };

    tick();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="flex justify-center">
          <BrandLogo />
        </div>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            A confirmar a sua sessão com o Google…
          </p>
        )}
      </div>
    </main>
  );
}
