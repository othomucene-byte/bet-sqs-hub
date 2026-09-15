import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Panel } from "@/components/exchange/terminal";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getAgentStatus } from "@/lib/exchange/ai-agent.functions";

const dt = (value: string | null) =>
  value ? new Date(value).toLocaleString("pt-PT", { timeZone: "Africa/Maputo" }) : "—";

/**
 * Estado da pesquisa automática desta empresa: última e próxima atualização,
 * fontes consultadas e histórico do que a IA alterou.
 */
export function CompanyAiPanel({ assetId }: { assetId: string }) {
  const fetchStatus = useServerFn(getAgentStatus);
  const query = useQuery({
    queryKey: ["agent-status", assetId],
    queryFn: () => fetchStatus({ data: { assetId } }),
    refetchInterval: 120_000,
  });

  if (query.isLoading) return <Skeleton className="h-24 w-full" />;
  const status = query.data;
  if (!status) return null;

  const runs = status.runs;
  const sources = Array.from(
    new Map(runs.flatMap((run) => run.sources).map((source) => [source.url, source])).values(),
  ).slice(0, 10);

  return (
    <Panel title="Pesquisa automática">
      <div className="space-y-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status.enabled ? "secondary" : "outline"} className="text-[10px] uppercase">
            {status.enabled ? `a cada ${status.intervalMinutes} min` : "desligada"}
          </Badge>
          <span className="text-muted-foreground">
            Última atualização: {dt(runs[0]?.finishedAt ?? status.job?.lastRunAt ?? null)} · próxima:{" "}
            {dt(status.nextRunAt)}
          </span>
        </div>

        {sources.length > 0 && (
          <div>
            <p className="text-muted-foreground">Fontes consultadas</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {sources.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline text-primary"
                >
                  {source.domain || source.title}
                </a>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-muted-foreground">Histórico das atualizações</p>
          {runs.length === 0 && (
            <p className="pt-1 text-muted-foreground">
              Ainda sem pesquisas registadas para esta empresa.
            </p>
          )}
          <div className="pt-1">
            {runs.slice(0, 8).map((run) => (
              <div key={run.id} className="border-b border-border/40 py-1.5 last:border-0">
                <p className="text-muted-foreground">
                  {dt(run.finishedAt)} · {run.inserted} novos · {run.approved} publicados ·{" "}
                  {run.conflicts} conflitos
                  {run.status !== "ok" ? ` · ${run.status}` : ""}
                </p>
                {run.changes.slice(0, 3).map((change, index) => (
                  <p key={`${run.id}-${index}`}>
                    [{change.kind}] {change.change}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          A pesquisa guarda a ligação de cada fonte. Informação sem fonte verificada é descartada e
          divergências entre fontes ficam marcadas para revisão humana.
        </p>
      </div>
    </Panel>
  );
}
