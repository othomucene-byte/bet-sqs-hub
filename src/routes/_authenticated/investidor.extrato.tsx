import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { SiteHeader } from "@/components/site-header";
import { InvestorNav } from "@/components/investor-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getInvestmentStatement } from "@/lib/investments/portfolio.functions";

export const Route = createFileRoute("/_authenticated/investidor/extrato")({
  head: () => ({
    meta: [
      { title: "Extrato da carteira de investimentos — BETFCOM SQs" },
      {
        name: "description",
        content:
          "Extrato imutável da carteira de investimentos: cada movimento tem tipo, montante, saldo resultante e referência única.",
      },
      { property: "og:title", content: "Extrato imutável — BETFCOM SQs" },
      {
        property: "og:description",
        content: "Registos append-only: não podem ser alterados nem apagados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StatementPage,
});

const MZN = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "MZN" });

const typeLabel: Record<string, string> = {
  deposit: "Depósito",
  withdrawal: "Levantamento",
  investment_buy: "Subscrição",
  investment_refund: "Reembolso",
  investment_redemption: "Resgate",
  profit: "Rendimento",
  loss: "Prejuízo",
  transfer_in: "Transferência recebida",
  transfer_out: "Transferência enviada",
  fee: "Taxa",
  reversal: "Estorno",
  adjustment: "Ajuste",
};

function StatementPage() {
  const fetchStatement = useServerFn(getInvestmentStatement);
  const statement = useQuery({
    queryKey: ["investment-statement"],
    queryFn: () => fetchStatement({ data: { limit: 100 } }),
  });

  const rows = statement.data ?? [];

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 pb-20">
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">Extrato</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Histórico imutável da carteira de investimentos, tal como está no servidor.
        </p>
        <InvestorNav className="mt-5" />

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Movimentos</CardTitle>
            <CardDescription>Os 100 movimentos mais recentes.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {statement.isLoading ? "A carregar…" : "Sem movimentos."}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Montante</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Referência</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(row.createdAt).toLocaleString("pt-PT")}
                      </TableCell>
                      <TableCell>{typeLabel[row.type] ?? row.type}</TableCell>
                      <TableCell
                        className={
                          row.amount < 0
                            ? "text-right tabular-nums text-destructive"
                            : "text-right tabular-nums text-primary"
                        }
                      >
                        {MZN.format(row.amount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {MZN.format(row.balanceAfter)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.status}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.reference}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
