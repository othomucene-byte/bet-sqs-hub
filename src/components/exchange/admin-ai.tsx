import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  getAiSupervision,
  resumeAiJob,
  reviewCompanyData,
} from "@/lib/exchange/company-data.functions";
import {
  getAgentAdmin,
  runAgentNow,
  setAssetMonitored,
  updateAgentConfig,
} from "@/lib/exchange/ai-agent.functions";

const dt = (value: string | null) =>
  value ? new Date(value).toLocaleString("pt-PT", { timeZone: "Africa/Maputo" }) : "—";

/** Configuração do agente de pesquisa, monitoramento e validação humana. */
export function AdminAi() {
  const queryClient = useQueryClient();
  const fetchState = useServerFn(getAiSupervision);
  const fetchAgent = useServerFn(getAgentAdmin);
  const review = useServerFn(reviewCompanyData);
  const resume = useServerFn(resumeAiJob);
  const saveConfig = useServerFn(updateAgentConfig);
  const toggleAsset = useServerFn(setAssetMonitored);
  const runNow = useServerFn(runAgentNow);

  const [newSource, setNewSource] = useState("");

  const query = useQuery({ queryKey: ["admin-ai"], queryFn: () => fetchState() });
  const agentQuery = useQuery({
    queryKey: ["admin-ai-agent"],
    queryFn: () => fetchAgent(),
    refetchInterval: 60_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-ai"] });
    queryClient.invalidateQueries({ queryKey: ["admin-ai-agent"] });
  };

  const decide = useMutation({
    mutationFn: (vars: { id: string; decision: "approved" | "rejected" }) => review({ data: vars }),
    onSuccess: () => {
      toast.success("Registo validado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unpause = useMutation({
    mutationFn: () => resume({}),
    onSuccess: () => {
      toast.success("Agente retomado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const config = useMutation({
    mutationFn: (vars: {
      enabled?: boolean;
      intervalMinutes?: 30 | 60;
      allowedSources?: string[];
    }) => saveConfig({ data: vars }),
    onSuccess: () => {
      toast.success("Configuração guardada");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const monitored = useMutation({
    mutationFn: (vars: { assetId: string; monitored: boolean }) => toggleAsset({ data: vars }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const manual = useMutation({
    mutationFn: (vars: { assetId?: string }) => runNow({ data: vars }),
    onSuccess: (result) => {
      const failed = result.results.filter((r) => r.error);
      if (failed.length) toast.error(failed[0]?.error ?? "Pesquisa falhou");
      else
        toast.success(
          `Pesquisa concluída: ${result.results.reduce((sum, r) => sum + r.inserted, 0)} novos registos`,
        );
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading || agentQuery.isLoading) return <Skeleton className="h-40 w-full" />;

  const state = query.data;
  const agent = agentQuery.data;
  const cfg = agent?.config;
  const job = cfg?.job ?? state?.job ?? null;

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            Agente de pesquisa e atualização
            <Badge
              variant={job?.status === "paused" ? "destructive" : cfg?.enabled ? "secondary" : "outline"}
              className="text-[10px] uppercase"
            >
              {job?.status === "paused" ? "pausado" : cfg?.enabled ? "activo" : "desligado"}
            </Badge>
            <span className="text-xs font-normal text-muted-foreground">
              {state?.approvedCount ?? 0} registos publicados
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={Boolean(cfg?.enabled)}
                onCheckedChange={(value) => config.mutate({ enabled: value })}
              />
              Monitoramento ligado
            </label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Intervalo</span>
              {([30, 60] as const).map((minutes) => (
                <Button
                  key={minutes}
                  size="sm"
                  variant={cfg?.intervalMinutes === minutes ? "default" : "outline"}
                  disabled={config.isPending}
                  onClick={() => config.mutate({ intervalMinutes: minutes })}
                >
                  {minutes === 30 ? "30 min" : "1 hora"}
                </Button>
              ))}
            </div>
            <Button
              size="sm"
              disabled={manual.isPending}
              onClick={() => manual.mutate({})}
            >
              {manual.isPending ? "A pesquisar…" : "Atualizar agora (todas)"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Última execução: {dt(job?.lastRunAt ?? null)} · último sucesso:{" "}
            {dt(job?.lastSuccessAt ?? null)} · próxima: {dt(cfg?.nextRunAt ?? null)}
          </p>
          {job?.lastError && <p className="text-xs text-destructive">Erro: {job.lastError}</p>}
          {job?.pausedReason && (
            <div className="space-y-2">
              <p className="text-xs text-amber-400">Pausado: {job.pausedReason}</p>
              <Button size="sm" disabled={unpause.isPending} onClick={() => unpause.mutate()}>
                Retomar
              </Button>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            O agente pesquisa na web, guarda a ligação real de cada fonte e só publica informação
            verificável. Nunca altera saldos, ledger, ordens ou negócios, e nunca cria preços.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm">Fontes utilizadas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-3">
          <div className="flex flex-wrap gap-1">
            {(cfg?.allowedSources ?? []).map((source) => (
              <Badge key={source} variant="outline" className="gap-1 text-[11px]">
                {source}
                <button
                  type="button"
                  aria-label={`Remover ${source}`}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    config.mutate({
                      allowedSources: (cfg?.allowedSources ?? []).filter((entry) => entry !== source),
                    })
                  }
                >
                  ×
                </button>
              </Badge>
            ))}
            {(cfg?.allowedSources ?? []).length === 0 && (
              <span className="text-xs text-muted-foreground">
                Sem lista definida — o agente pesquisa em fontes públicas gerais.
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={newSource}
              placeholder="ex.: bolsadevalores.co.mz"
              onChange={(event) => setNewSource(event.target.value)}
              className="h-8 max-w-xs text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!newSource.trim() || config.isPending}
              onClick={() => {
                config.mutate({
                  allowedSources: [...(cfg?.allowedSources ?? []), newSource.trim()],
                });
                setNewSource("");
              }}
            >
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm">Empresas monitoradas</CardTitle>
        </CardHeader>
        <CardContent className="p-3 text-xs">
          {(agent?.assets ?? []).map((asset) => (
            <div
              key={asset.assetId}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 py-2 last:border-0"
            >
              <div className="min-w-[160px]">
                <p className="font-semibold">
                  {asset.symbol}{" "}
                  <span className="font-normal text-muted-foreground">
                    {asset.companyName ?? asset.name}
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {asset.approvedCount} registos · última pesquisa {dt(asset.lastRunAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={asset.monitored}
                  onCheckedChange={(value) =>
                    monitored.mutate({ assetId: asset.assetId, monitored: value })
                  }
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={manual.isPending}
                  onClick={() => manual.mutate({ assetId: asset.assetId })}
                >
                  Atualizar agora
                </Button>
              </div>
            </div>
          ))}
          {(agent?.assets ?? []).length === 0 && (
            <p className="py-3 text-center text-muted-foreground">Sem instrumentos activos.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm">Histórico das execuções</CardTitle>
        </CardHeader>
        <CardContent className="p-3 text-xs">
          {(cfg?.runs ?? []).map((run) => (
            <div key={run.id} className="space-y-1 border-b border-border/40 py-2 last:border-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">{dt(run.finishedAt)}</span>
                <span className="font-semibold">{run.symbol ?? "—"}</span>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {run.trigger === "manual" ? "manual" : "automático"}
                </Badge>
                <span
                  className={run.status === "ok" ? "text-muted-foreground" : "text-destructive"}
                >
                  {run.status}
                </span>
                <span className="text-muted-foreground">
                  {run.inserted} novos · {run.approved} publicados · {run.conflicts} conflitos ·{" "}
                  {run.skipped} descartados
                </span>
              </div>
              {run.error && <p className="text-destructive">{run.error}</p>}
              {run.changes.slice(0, 4).map((change, index) => (
                <p key={`${run.id}-${index}`} className="text-muted-foreground">
                  · [{change.kind}] {change.change}
                </p>
              ))}
              {run.sources.length > 0 && (
                <p className="flex flex-wrap gap-2">
                  {run.sources.slice(0, 6).map((source) => (
                    <a
                      key={source.url}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="underline text-muted-foreground"
                    >
                      {source.domain || source.title}
                    </a>
                  ))}
                </p>
              )}
            </div>
          ))}
          {(cfg?.runs ?? []).length === 0 && (
            <p className="py-3 text-center text-muted-foreground">Ainda sem execuções registadas.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm">Fila de revisão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-3">
          {(state?.pending.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">Nada à espera de validação.</p>
          )}
          {(state?.pending ?? []).map((d) => (
            <div key={d.id} className="space-y-2 rounded-lg border border-border/60 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{d.symbol}</span>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {d.kind}
                </Badge>
                {d.status === "conflict" && (
                  <Badge variant="destructive" className="text-[10px] uppercase">
                    inconsistência
                  </Badge>
                )}
                <span className="text-[11px] text-muted-foreground">
                  Confiança {(d.confidence * 100).toFixed(0)}% ·{" "}
                  {new Date(d.collectedAt).toLocaleString("pt-PT")}
                </span>
              </div>
              <p className="text-sm">{d.title}</p>
              {d.summary && <p className="text-xs text-muted-foreground">{d.summary}</p>}
              {d.changeSummary && (
                <p className="text-[11px] text-muted-foreground">O que mudou: {d.changeSummary}</p>
              )}
              {d.conflictNote && (
                <p className="text-[11px] text-amber-400">Divergência: {d.conflictNote}</p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Fonte:{" "}
                {d.sourceUrl ? (
                  <a href={d.sourceUrl} target="_blank" rel="noreferrer noopener" className="underline">
                    {d.sourceName}
                  </a>
                ) : (
                  d.sourceName
                )}{" "}
                · {d.provider} {d.model ?? ""}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ id: d.id, decision: "approved" })}
                >
                  Publicar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ id: d.id, decision: "rejected" })}
                >
                  Recusar
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
