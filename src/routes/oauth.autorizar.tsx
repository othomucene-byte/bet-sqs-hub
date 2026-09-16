import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { approveAuthorization, describeAuthorization } from "@/lib/developer/oauth.functions";

const searchSchema = z.object({
  client_id: z.string().optional(),
  redirect_uri: z.string().optional(),
  scope: z.string().optional(),
  state: z.string().optional(),
  code_challenge: z.string().optional(),
  code_challenge_method: z.enum(["S256", "plain"]).optional(),
});

const SCOPE_LABEL: Record<string, string> = {
  "market:read": "Ver o mercado: empresas, cotações, livro de ofertas e negócios",
  "trading:read": "Ver a sua conta de mercado: saldo, posições, ordens e negócios",
  "trading:write": "Colocar e cancelar ordens em seu nome",
  "stream:read": "Receber cotações em tempo real",
};

export const Route = createFileRoute("/oauth/autorizar")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Autorizar aplicação — Betfcom SQs" },
      {
        name: "description",
        content:
          "Ecrã de consentimento da Betfcom SQs: veja que permissões uma aplicação externa pede à sua conta antes de autorizar.",
      },
      { property: "og:title", content: "Autorizar aplicação — Betfcom SQs" },
      {
        property: "og:description",
        content: "Aprove ou recuse o acesso de uma aplicação externa à sua conta Betfcom SQs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConsentPage,
});

function ConsentPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const describe = useServerFn(describeAuthorization);
  const approve = useServerFn(approveAuthorization);

  const params = {
    clientId: search.client_id ?? "",
    redirectUri: search.redirect_uri ?? "",
    scope: search.scope ?? null,
    state: search.state ?? null,
    codeChallenge: search.code_challenge ?? null,
    codeChallengeMethod: search.code_challenge_method ?? null,
  };

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (data.user) {
        setSignedIn(true);
        return;
      }
      setSignedIn(false);
      const next = `${window.location.pathname}${window.location.search}`;
      void navigate({ to: "/auth", search: { next } });
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  const request = useQuery({
    queryKey: ["oauth-consent", params.clientId, params.redirectUri, params.scope],
    enabled: signedIn === true && params.clientId !== "" && params.redirectUri !== "",
    queryFn: () => describe({ data: params }),
  });

  const approveMutation = useMutation({
    mutationFn: () => approve({ data: params }),
    onSuccess: (result) => {
      window.location.href = result.redirectTo;
    },
  });

  const deny = () => {
    if (!params.redirectUri) return;
    try {
      const url = new URL(params.redirectUri);
      url.searchParams.set("error", "access_denied");
      if (params.state) url.searchParams.set("state", params.state);
      window.location.href = url.toString();
    } catch {
      void navigate({ to: "/" });
    }
  };

  const missing = !params.clientId || !params.redirectUri;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg items-center px-4 py-10">
      <div className="w-full rounded-2xl border border-border bg-card p-6 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">Autorizar aplicação</h1>
            <p className="text-xs text-muted-foreground">Betfcom SQs — acesso em seu nome</p>
          </div>
        </div>

        {missing ? (
          <p className="mt-6 text-sm text-destructive">
            Pedido incompleto: falta a identificação da aplicação ou o endereço de retorno.
          </p>
        ) : signedIn !== true || request.isLoading ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : request.data && "error" in request.data ? (
          <p className="mt-6 text-sm text-destructive">{request.data.error}</p>
        ) : request.data?.client ? (
          <>
            <p className="mt-6 text-sm">
              <span className="font-semibold">{request.data.client.name}</span> pede acesso à sua conta
              Betfcom SQs com as seguintes permissões:
            </p>
            <ul className="mt-4 space-y-2">
              {request.data.scopes.map((scope) => (
                <li key={scope} className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                  <Badge variant="secondary" className="mb-1 font-mono text-[10px]">
                    {scope}
                  </Badge>
                  <p className="text-muted-foreground">{SCOPE_LABEL[scope] ?? scope}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              A aplicação nunca vê a sua palavra-passe. Pode retirar o acesso a qualquer momento na área
              de developers. Levantamentos e pagamentos não estão incluídos nestas permissões.
            </p>
            <p className="mt-2 break-all text-[11px] text-muted-foreground">
              Retorno: {params.redirectUri}
            </p>
            {approveMutation.isError ? (
              <p className="mt-3 text-sm text-destructive">
                {approveMutation.error instanceof Error
                  ? approveMutation.error.message
                  : "Não foi possível autorizar."}
              </p>
            ) : null}
            <div className="mt-6 flex gap-3">
              <Button
                className="flex-1"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending ? "A autorizar…" : "Autorizar"}
              </Button>
              <Button variant="outline" className="flex-1" onClick={deny}>
                Recusar
              </Button>
            </div>
          </>
        ) : (
          <p className="mt-6 text-sm text-destructive">Não foi possível ler o pedido de autorização.</p>
        )}
      </div>
    </main>
  );
}
