import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getAiSupervision,
  resumeAiJob,
  reviewCompanyData,
} from "@/lib/exchange/company-data.functions";

/** Supervisão da camada de inteligência e validação humana dos dados recolhidos. */
export function AdminAi() {
  const queryClient = useQueryClient();
  const fetchState = useServerFn(getAiSupervision);
  const review = useServerFn(reviewCompanyData);
  const resume = useServerFn(resumeAiJob);

  const query = useQuery({ queryKey: ["admin-ai"], queryFn: () => fetchState() });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-ai"] });

  const decide = useMutation({
    mutationFn: (vars: { id: string; decision: "approved" | "rejected" }) =>
      review({ data: vars }),
    onSuccess: () => {
      toast.success("Registo validado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unpause = useMutation({
    mutationFn: () => resume({}),
    onSuccess: () => {
      toast.success("Trabalho automático retomado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <Skeleton className="h-32 w-full" />;
  const state = query.data;
  const job = state?.job;

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="space-y-2 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">Atualização automática (hora a hora)</span>
            <Badge
              variant={job?.status === "paused" ? "destructive" : "secondary"}
              className="text-[10px] uppercase"
            >
              {job?.status ?? "não iniciado"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {state?.approvedCount ?? 0} registos publicados
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Última execução:{" "}
            {job?.lastRunAt ? new Date(job.lastRunAt).toLocaleString("pt-PT") : "—"} · último sucesso:{" "}
            {job?.lastSuccessAt ? new Date(job.lastSuccessAt).toLocaleString("pt-PT") : "—"}
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
            A inteligência apenas propõe informação sobre empresas, com fonte e data. Nunca altera
            saldos, ledger, ordens ou negócios.
          </p>
        </CardContent>
      </Card>

      {(state?.pending.length ?? 0) === 0 && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Nada à espera de validação.
          </CardContent>
        </Card>
      )}

      {(state?.pending ?? []).map((d) => (
        <Card key={d.id}>
          <CardContent className="space-y-2 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{d.symbol}</span>
              <Badge variant="outline" className="text-[10px] uppercase">
                {d.kind}
              </Badge>
              <span className="text-[11px] text-muted-foreground">
                Confiança {(d.confidence * 100).toFixed(0)}% ·{" "}
                {new Date(d.collectedAt).toLocaleString("pt-PT")}
              </span>
            </div>
            <p className="text-sm">{d.title}</p>
            {d.summary && <p className="text-xs text-muted-foreground">{d.summary}</p>}
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
