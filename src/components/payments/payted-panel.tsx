import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getPaytedAdminData, reconcilePaytedPayment } from "@/lib/payments/payted.functions";

const MZN = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "MZN" });

/** Backoffice PayTED → e-Mola. Nenhum segredo é exibido. */
export function PaytedPanel() {
  const queryClient = useQueryClient();
  const fetchData = useServerFn(getPaytedAdminData);
  const reconcile = useServerFn(reconcilePaytedPayment);

  const query = useQuery({ queryKey: ["admin-payted"], queryFn: () => fetchData() });
  const mutation = useMutation({
    mutationFn: (reference: string) => reconcile({ data: { reference } }),
    onSuccess: (result) => {
      if (result.status === "succeeded") toast.success("PayTED confirmou: ledger atualizado.");
      else if (result.status === "failed") toast.error("PayTED marcou a operação como falhada.");
      else toast.info(result.message ?? "A PayTED mantém a operação pendente.");
      queryClient.invalidateQueries({ queryKey: ["admin-payted"] });
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível reconciliar."),
  });

  const summary = query.data?.summary;
  const rows = query.data?.rows ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">PayTED — e-Mola</CardTitle>
          <CardDescription>
            Gateway dedicado ao e-Mola. Depósitos e levantamentos sem taxa para o cliente; o custo
            do gateway é contabilizado à parte.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {summary ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={summary.configured ? "default" : "destructive"}>
                  {summary.configured ? "Configurado" : "Não configurado"}
                </Badge>
                {summary.missingSecrets.length > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    Credenciais em falta: {summary.missingSecrets.join(", ")}
                  </span>
                ) : null}
              </div>
              <p className="break-all font-mono text-xs text-muted-foreground">
                Webhook: {summary.webhookUrl}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Depósitos concluídos" value={`${summary.deposits.count}`} />
                <Metric label="Bruto depositado" value={MZN.format(summary.deposits.gross)} />
                <Metric label="Custos PayTED (depósitos)" value={MZN.format(summary.deposits.fees)} />
                <Metric label="Líquido (depósitos)" value={MZN.format(summary.deposits.net)} />
                <Metric label="Payouts concluídos" value={`${summary.payouts.count}`} />
                <Metric label="Bruto pago" value={MZN.format(summary.payouts.gross)} />
                <Metric label="Custos PayTED (payouts)" value={MZN.format(summary.payouts.fees)} />
                <Metric
                  label="Estados"
                  value={`${summary.pending} pend. · ${summary.completed} ok · ${summary.failed} falh.`}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">A carregar…</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operações e-Mola</CardTitle>
          <CardDescription>
            Referência única por transação e crédito idempotente: reconciliar nunca duplica dinheiro.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Direcção</TableHead>
                <TableHead>Número</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Webhook</TableHead>
                <TableHead>Ref. Betfcom</TableHead>
                <TableHead>Ref. PayTED</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-sm text-muted-foreground">
                    Sem operações PayTED registadas.
                  </TableCell>
                </TableRow>
              ) : null}
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(row.createdAt).toLocaleString("pt-PT")}
                  </TableCell>
                  <TableCell>{row.direction === "deposit" ? "Depósito" : "Levantamento"}</TableCell>
                  <TableCell className="font-mono text-xs">{row.payerMasked ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{MZN.format(row.amount)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {MZN.format(row.providerFee)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {MZN.format(row.netAmount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.webhookReceived ? (row.webhookEvent ?? "recebido") : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.reference}</TableCell>
                  <TableCell className="font-mono text-xs">{row.paytedReference ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={mutation.isPending || row.status === "succeeded"}
                      onClick={() => mutation.mutate(row.reference)}
                    >
                      Reconciliar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
