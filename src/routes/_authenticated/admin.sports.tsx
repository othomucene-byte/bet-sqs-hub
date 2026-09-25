import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, PlugZap, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getSportsAdminState,
  syncLiveNow,
  testSportsProvider,
  updateSportsConfig,
  type SportsAdminState,
} from "@/lib/sports/live.functions";

export const Route = createFileRoute("/_authenticated/admin/sports")({
  head: () => ({ meta: [{ title: "Administração — Desportos em direto | Betfcom SQs" }] }),
  component: AdminSportsPage,
});

function when(value: string | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("pt-PT", {
      dateStyle: "short",
      timeStyle: "medium",
      timeZone: "Africa/Maputo",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function AdminSportsPage() {
  const fetchState = useServerFn(getSportsAdminState);
  const saveConfig = useServerFn(updateSportsConfig);
  const testProvider = useServerFn(testSportsProvider);
  const runSync = useServerFn(syncLiveNow);

  const query = useQuery<SportsAdminState>({
    queryKey: ["admin-sports"],
    queryFn: () => fetchState(),
    refetchInterval: 30_000,
  });

  const config = query.data?.config ?? null;
  const [interval, setInterval] = useState<string>("");
  const [budget, setBudget] = useState<string>("");

  const save = useMutation({
    mutationFn: (patch: {
      active?: boolean;
      liveIntervalSeconds?: number;
      catalogIntervalSeconds?: number;
      dailyRequestBudget?: number;
      enabledSports?: string[];
    }) => saveConfig({ data: patch }),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success("Configuração guardada.");
        void query.refetch();
      } else toast.error(result.error ?? "Não foi possível guardar.");
    },
  });

  const test = useMutation({
    mutationFn: () => testProvider(),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(
          `Ligação válida — plano ${result.plan ?? "?"}, ${result.used ?? 0}/${result.limit ?? 0} pedidos hoje.`,
        );
      } else toast.error(result.error ?? "Sem ligação ao fornecedor.");
    },
  });

  const sync = useMutation({
    mutationFn: () => runSync(),
    onSuccess: (response) => {
      if (response.ok) {
        const result = "result" in response ? response.result : null;
        toast.success(
          result
            ? `Sincronizado: ${result.matches} jogos, ${result.changed} alterações, ${result.eventsInserted} acontecimentos.`
            : "Sincronizado.",
        );
      } else {
        toast.error(
          ("error" in response && response.error) ||
            ("result" in response && response.result?.errors?.[0]) ||
            "Sincronização falhou.",
        );
      }
      void query.refetch();
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-6">
        <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" /> Administração
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Desportos em direto</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fornecedor de dados, intervalo de sincronização, orçamento diário de pedidos e registo de
          execuções.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Fornecedor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Estado</span>
                <Badge variant={query.data?.configured ? "default" : "destructive"}>
                  {query.data?.configured ? "Configurado" : "Não configurado"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Fonte</span>
                <span>{config?.provider ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pedidos hoje</span>
                <span className="tabular-nums">
                  {config?.requestsToday ?? 0} / {config?.dailyRequestBudget ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Última sincronização</span>
                <span>{when(config?.lastLiveSyncAt ?? null)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Sincronização automática</span>
                <Switch
                  checked={Boolean(config?.active)}
                  onCheckedChange={(checked) => save.mutate({ active: checked })}
                />
              </div>
              {config?.lastError && (
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs">
                  Último erro ({when(config.lastErrorAt)}): {config.lastError}
                </p>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => test.mutate()} disabled={test.isPending}>
                  <PlugZap className="mr-1 size-4" /> Testar ligação
                </Button>
                <Button size="sm" onClick={() => sync.mutate()} disabled={sync.isPending}>
                  <RefreshCw className="mr-1 size-4" /> Sincronizar agora
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Sincronização</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <Label htmlFor="interval">Intervalo em direto (segundos)</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    id="interval"
                    inputMode="numeric"
                    placeholder={String(config?.liveIntervalSeconds ?? 60)}
                    value={interval}
                    onChange={(event) => setInterval(event.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const value = Number(interval);
                      if (!Number.isFinite(value) || value < 15) {
                        toast.error("Mínimo 15 segundos.");
                        return;
                      }
                      save.mutate({ liveIntervalSeconds: Math.round(value) });
                    }}
                  >
                    Guardar
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="budget">Orçamento diário de pedidos</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    id="budget"
                    inputMode="numeric"
                    placeholder={String(config?.dailyRequestBudget ?? 100)}
                    value={budget}
                    onChange={(event) => setBudget(event.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const value = Number(budget);
                      if (!Number.isFinite(value) || value < 10) {
                        toast.error("Mínimo 10 pedidos.");
                        return;
                      }
                      save.mutate({ dailyRequestBudget: Math.round(value) });
                    }}
                  >
                    Guardar
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  O plano atual do fornecedor limita os pedidos por dia. O intervalo em direto é
                  respeitado dentro deste orçamento.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-muted/50 p-2">
                  Ao vivo: <strong>{query.data?.counts.live ?? 0}</strong>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  Agendados: <strong>{query.data?.counts.scheduled ?? 0}</strong>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  Terminados: <strong>{query.data?.counts.finished ?? 0}</strong>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  Acontecimentos: <strong>{query.data?.counts.matchEvents ?? 0}</strong>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Últimas execuções</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {(query.data?.logs ?? []).map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 p-2"
              >
                <span className="font-medium">{when(log.createdAt)}</span>
                <Badge variant={log.ok ? "secondary" : "destructive"}>{log.ok ? "ok" : "erro"}</Badge>
                <span>{log.kind}</span>
                <span className="tabular-nums">{log.requestsUsed} pedido(s)</span>
                <span className="tabular-nums">{log.matchesTouched} jogos</span>
                <span className="tabular-nums">{log.eventsInserted} acontecimentos</span>
                <span className="tabular-nums">{log.durationMs ?? "—"} ms</span>
                {log.error && <span className="w-full text-destructive">{log.error}</span>}
              </div>
            ))}
            {!(query.data?.logs ?? []).length && (
              <p className="text-muted-foreground">Sem execuções registadas.</p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
