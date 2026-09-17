import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Send, Trash2, Webhook } from "lucide-react";
import { toast } from "sonner";

import { Panel } from "@/components/exchange/terminal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createWebhook,
  listWebhooks,
  sendWebhookTest,
  updateWebhook,
} from "@/lib/developer/webhooks.functions";

const EVENTS = [
  { id: "order.updated", label: "Ordem actualizada" },
  { id: "trade.executed", label: "Negócio executado" },
  { id: "price.updated", label: "Preço actualizado" },
] as const;

type EventId = (typeof EVENTS)[number]["id"];

export function WebhooksPanel() {
  const queryClient = useQueryClient();
  const fetchWebhooks = useServerFn(listWebhooks);
  const create = useServerFn(createWebhook);
  const update = useServerFn(updateWebhook);
  const test = useServerFn(sendWebhookTest);

  const [url, setUrl] = useState("");
  const [environment, setEnvironment] = useState<"SANDBOX" | "LIVE">("SANDBOX");
  const [events, setEvents] = useState<EventId[]>(["order.updated", "trade.executed"]);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const query = useQuery({ queryKey: ["webhooks"], queryFn: () => fetchWebhooks({}) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["webhooks"] });

  const createMutation = useMutation({
    mutationFn: () =>
      create({ data: { url: url.trim(), events, environment } }),
    onSuccess: (result) => {
      setSecret(result.secret);
      setUrl("");
      setCopied(false);
      void invalidate();
      toast.success("Aviso automático criado. Guarde a chave de assinatura agora.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; action: "activate" | "deactivate" | "delete" }) =>
      update({ data: input }),
    onSuccess: () => {
      void invalidate();
      toast.success("Aviso automático actualizado.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => test({ data: { id } }),
    onSuccess: (result) => {
      void invalidate();
      if (result.delivered > 0) toast.success("Teste entregue com sucesso.");
      else toast.error("O seu servidor não aceitou o teste. Veja as entregas abaixo.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleEvent = (id: EventId) =>
    setEvents((current) =>
      current.includes(id) ? current.filter((event) => event !== id) : [...current, id],
    );

  return (
    <div className="space-y-3">
      <Panel title="Avisos automáticos (webhooks)">
        <p className="mb-3 text-[12px] leading-relaxed text-muted-foreground">
          Recebe um pedido no seu servidor sempre que algo acontece na sua conta. Cada envio é
          assinado (HMAC-SHA256) nos cabeçalhos <code>x-sqs-signature</code> e{" "}
          <code>x-sqs-timestamp</code>, e é repetido até 6 vezes se o seu servidor falhar.
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="hook-url" className="text-[12px]">
              Endereço (https)
            </Label>
            <Input
              id="hook-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://o-meu-servidor.com/betfcom"
              maxLength={300}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Eventos</Label>
            <div className="flex flex-wrap gap-2">
              {EVENTS.map((event) => (
                <Button
                  key={event.id}
                  type="button"
                  size="sm"
                  variant={events.includes(event.id) ? "default" : "outline"}
                  onClick={() => toggleEvent(event.id)}
                >
                  {event.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Ambiente</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["SANDBOX", "LIVE"] as const).map((env) => (
                <Button
                  key={env}
                  type="button"
                  size="sm"
                  variant={environment === env ? "default" : "outline"}
                  onClick={() => setEnvironment(env)}
                >
                  {env === "SANDBOX" ? "Teste" : "Real"}
                </Button>
              ))}
            </div>
          </div>
          <Button
            className="w-full"
            disabled={!url.trim().startsWith("https://") || events.length === 0 || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "A criar…" : "Criar aviso automático"}
          </Button>

          {secret && (
            <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
              <p className="text-[12px] font-semibold text-primary">
                Chave de assinatura — copie agora, não voltamos a mostrá-la.
              </p>
              <code className="block break-all font-mono text-[12px]">{secret}</code>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => {
                  void navigator.clipboard.writeText(secret);
                  setCopied(true);
                  toast.success("Chave copiada.");
                }}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copiada" : "Copiar chave"}
              </Button>
            </div>
          )}
        </div>
      </Panel>

      <Panel title="Os seus avisos">
        {query.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (query.data?.endpoints.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">
            Ainda não configurou avisos automáticos.
          </p>
        ) : (
          <div className="space-y-2">
            {query.data?.endpoints.map((endpoint) => (
              <div
                key={endpoint.id}
                className="rounded-lg border border-border/60 bg-background/40 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Webhook className="size-4 shrink-0 text-primary" />
                  <code className="min-w-0 flex-1 truncate text-[12px]">{endpoint.url}</code>
                  <Badge variant={endpoint.environment === "LIVE" ? "default" : "secondary"} className="text-[10px]">
                    {endpoint.environment === "LIVE" ? "Real" : "Teste"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {endpoint.active ? "Activo" : "Inactivo"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Enviar teste"
                    onClick={() => testMutation.mutate(endpoint.id)}
                    disabled={testMutation.isPending}
                  >
                    <Send className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      updateMutation.mutate({
                        id: endpoint.id,
                        action: endpoint.active ? "deactivate" : "activate",
                      })
                    }
                    disabled={updateMutation.isPending}
                  >
                    {endpoint.active ? "Desligar" : "Ligar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => updateMutation.mutate({ id: endpoint.id, action: "delete" })}
                    disabled={updateMutation.isPending}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {endpoint.events.join(" · ")}
                  {endpoint.failureCount > 0 ? ` · ${endpoint.failureCount} falhas seguidas` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Últimas entregas">
        {(query.data?.deliveries.length ?? 0) === 0 ? (
          <p className="py-4 text-center text-[12px] text-muted-foreground">Sem entregas registadas.</p>
        ) : (
          <div className="space-y-1">
            {query.data?.deliveries.map((delivery) => (
              <div
                key={delivery.id}
                className="flex flex-wrap items-center gap-2 border-b border-border/40 py-1.5 text-[11px] last:border-0"
              >
                <span
                  className={
                    delivery.status === "delivered"
                      ? "font-mono text-emerald-400"
                      : delivery.status === "failed"
                        ? "font-mono text-destructive"
                        : "font-mono text-muted-foreground"
                  }
                >
                  {delivery.status}
                </span>
                <code className="min-w-0 flex-1 truncate">{delivery.event}</code>
                <span className="text-muted-foreground">
                  {delivery.responseStatus ?? "—"} · {delivery.attempts}x
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(delivery.createdAt).toLocaleTimeString("pt-MZ", {
                    timeZone: "Africa/Maputo",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
