import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Panel } from "@/components/exchange/terminal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createOAuthClient,
  listOAuthClients,
  revokeAuthorization,
  revokeOAuthClient,
} from "@/lib/developer/oauth.functions";

const SCOPES = ["market:read", "trading:read", "trading:write", "stream:read"] as const;
type Scope = (typeof SCOPES)[number];

export function OAuthPanel() {
  const queryClient = useQueryClient();
  const fetchClients = useServerFn(listOAuthClients);
  const create = useServerFn(createOAuthClient);
  const revokeClient = useServerFn(revokeOAuthClient);
  const revokeAccess = useServerFn(revokeAuthorization);

  const [name, setName] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [scopes, setScopes] = useState<Scope[]>(["market:read", "trading:read"]);
  const [issued, setIssued] = useState<{ clientId: string; clientSecret: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const query = useQuery({ queryKey: ["oauth-clients"], queryFn: () => fetchClients({}) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["oauth-clients"] });

  const createMutation = useMutation({
    mutationFn: () =>
      create({ data: { name: name.trim(), redirectUris: [redirectUri.trim()], scopes } }),
    onSuccess: (result) => {
      setIssued({ clientId: result.clientId, clientSecret: result.clientSecret });
      setName("");
      setRedirectUri("");
      setCopied(false);
      void invalidate();
      toast.success("Aplicação registada. Guarde o segredo agora.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const revokeClientMutation = useMutation({
    mutationFn: (id: string) => revokeClient({ data: { id } }),
    onSuccess: () => {
      void invalidate();
      toast.success("Aplicação desactivada.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const revokeAccessMutation = useMutation({
    mutationFn: (id: string) => revokeAccess({ data: { id } }),
    onSuccess: () => {
      void invalidate();
      toast.success("Acesso retirado.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleScope = (scope: Scope) =>
    setScopes((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope],
    );

  const origin = typeof window === "undefined" ? "https://betfcom.com" : window.location.origin;

  return (
    <div className="space-y-3">
      <Panel title="Aplicações externas (OAuth 2.0)">
        <p className="mb-3 text-[12px] leading-relaxed text-muted-foreground">
          Registe uma aplicação para que os utilizadores da Betfcom SQs possam autorizá-la a agir em
          nome deles, sem partilhar palavra-passe. Fluxo: <code>authorization_code</code> com PKCE.
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="app-name" className="text-[12px]">
              Nome da aplicação
            </Label>
            <Input
              id="app-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="O meu robô de investimento"
              maxLength={60}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="app-redirect" className="text-[12px]">
              Endereço de retorno
            </Label>
            <Input
              id="app-redirect"
              value={redirectUri}
              onChange={(event) => setRedirectUri(event.target.value)}
              placeholder="https://a-minha-app.com/callback"
              maxLength={300}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Permissões pedidas</Label>
            <div className="flex flex-wrap gap-2">
              {SCOPES.map((scope) => (
                <Button
                  key={scope}
                  type="button"
                  size="sm"
                  variant={scopes.includes(scope) ? "default" : "outline"}
                  onClick={() => toggleScope(scope)}
                  className="font-mono text-[11px]"
                >
                  {scope}
                </Button>
              ))}
            </div>
          </div>
          <Button
            className="w-full"
            disabled={
              name.trim().length < 2 ||
              !redirectUri.trim().startsWith("http") ||
              scopes.length === 0 ||
              createMutation.isPending
            }
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "A registar…" : "Registar aplicação"}
          </Button>

          {issued && (
            <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
              <p className="text-[12px] font-semibold text-primary">
                Guarde o segredo agora — não voltamos a mostrá-lo.
              </p>
              <code className="block break-all font-mono text-[12px]">
                client_id: {issued.clientId}
              </code>
              <code className="block break-all font-mono text-[12px]">
                client_secret: {issued.clientSecret}
              </code>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => {
                  void navigator.clipboard.writeText(
                    `client_id=${issued.clientId}\nclient_secret=${issued.clientSecret}`,
                  );
                  setCopied(true);
                  toast.success("Credenciais copiadas.");
                }}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copiadas" : "Copiar credenciais"}
              </Button>
            </div>
          )}

          <div className="rounded-lg border border-border/60 bg-background/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <p className="font-semibold text-foreground">Endereços do fluxo</p>
            <code className="mt-1 block break-all">{origin}/api/public/v1/oauth/authorize</code>
            <code className="block break-all">{origin}/api/public/v1/oauth/token</code>
            <code className="block break-all">{origin}/api/public/v1/oauth/revoke</code>
          </div>
        </div>
      </Panel>

      <Panel title="As suas aplicações">
        {query.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (query.data?.clients.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">
            Ainda não registou aplicações.
          </p>
        ) : (
          <div className="space-y-2">
            {query.data?.clients.map((client) => (
              <div
                key={client.id}
                className="rounded-lg border border-border/60 bg-background/40 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <ShieldCheck className="size-4 shrink-0 text-primary" />
                  <p className="min-w-0 flex-1 truncate text-[13px] font-semibold">{client.name}</p>
                  {client.revokedAt ? (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Desactivada
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => revokeClientMutation.mutate(client.id)}
                      disabled={revokeClientMutation.isPending}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
                <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                  {client.clientId}
                </p>
                <p className="text-[11px] text-muted-foreground">{client.scopes.join(" · ")}</p>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Acessos que concedeu">
        {(query.data?.authorizations.length ?? 0) === 0 ? (
          <p className="py-4 text-center text-[12px] text-muted-foreground">
            Nenhuma aplicação tem acesso à sua conta.
          </p>
        ) : (
          <div className="space-y-1">
            {query.data?.authorizations.map((token) => (
              <div
                key={token.id}
                className="flex flex-wrap items-center gap-2 border-b border-border/40 py-1.5 text-[11px] last:border-0"
              >
                <span className="min-w-0 flex-1 truncate font-semibold">{token.clientName}</span>
                <span className="text-muted-foreground">{token.scopes.join(" · ")}</span>
                {token.revokedAt ? (
                  <Badge variant="outline" className="text-[10px]">
                    Retirado
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => revokeAccessMutation.mutate(token.id)}
                    disabled={revokeAccessMutation.isPending}
                  >
                    Retirar
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
