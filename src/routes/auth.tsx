import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/brand-logo";

const searchSchema = z.object({
  next: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Entrar na BETFCOM SQs — conta e carteira" },
      {
        name: "description",
        content:
          "Entre ou crie a sua conta BETFCOM SQs para acessar a carteira em meticais, o histórico de movimentos e o Crash.",
      },
      { property: "og:title", content: "Entrar na BETFCOM SQs" },
      {
        property: "og:description",
        content: "Conta BETFCOM SQs: carteira em MZN, histórico imutável e jogo verificável.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

/** Aceita apenas caminhos relativos da própria aplicação. */
function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/crash";
  return next;
}

function AuthPage() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const destination = safeNext(next);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${destination}`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Conta criada. Verifique o email para confirmar o acesso.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: destination });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      // Guardado à parte: o destino não pode ir no redirect_uri (rota protegida).
      sessionStorage.setItem("betfcom:next", destination);
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Não foi possível entrar com o Google.");
        return;
      }
      if (result.redirected) return;
      navigate({ to: destination });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <BrandLogo />
        </div>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-xl">
              {mode === "signin" ? "Entrar na sua conta" : "Criar conta"}
            </CardTitle>
            <CardDescription>
              Saldo, apostas e movimentos são sempre validados no servidor. Jogue com
              responsabilidade — apostar envolve risco de perda.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogle}
              disabled={busy}
            >
              Continuar com Google
            </Button>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">ou</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">Nome</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Como quer ser tratado"
                    autoComplete="name"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Palavra-passe</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
              </div>

              <Button type="submit" className="w-full" disabled={busy}>
                {mode === "signin" ? "Entrar" : "Criar conta"}
              </Button>
            </form>

            <button
              type="button"
              className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin"
                ? "Ainda não tem conta? Criar conta"
                : "Já tem conta? Entrar"}
            </button>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="underline-offset-4 hover:underline">
            Voltar à página inicial
          </Link>
        </p>
      </div>
    </main>
  );
}
