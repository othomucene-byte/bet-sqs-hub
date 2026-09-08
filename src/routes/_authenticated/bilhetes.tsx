import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Ticket } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { selectionLabel } from "@/lib/sports/markets";
import { getMyBetSlips, type BetSlipView } from "@/lib/sports/sports.functions";

export const Route = createFileRoute("/_authenticated/bilhetes")({
  head: () => ({
    meta: [
      { title: "Os meus bilhetes — SQs Apostas Desportivas" },
      {
        name: "description",
        content:
          "Histórico dos seus bilhetes desportivos: seleções, cotação total, estado e ganhos liquidados pelo servidor.",
      },
      { property: "og:title", content: "Os meus bilhetes — Betfcom SQs" },
      {
        property: "og:description",
        content: "Seleções, cotações e estado de liquidação de cada bilhete desportivo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SlipsPage,
});

const MZN = new Intl.NumberFormat("pt-PT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const when = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const STATUS: Record<BetSlipView["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Em jogo", variant: "secondary" },
  won: { label: "Ganho", variant: "default" },
  lost: { label: "Perdido", variant: "destructive" },
  void: { label: "Anulado", variant: "outline" },
};

const RESULT_LABEL: Record<string, string> = {
  pending: "Pendente",
  won: "Certo",
  lost: "Errado",
  void: "Anulado",
};

function SlipsPage() {
  const fetchSlips = useServerFn(getMyBetSlips);
  const slips = useQuery({ queryKey: ["my-bet-slips"], queryFn: () => fetchSlips() });

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Os meus bilhetes</h1>
            <p className="mt-2 text-muted-foreground">
              Cotações, estado e ganhos são registados e liquidados no servidor.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/desportos">
              <Ticket className="size-4" /> Apostar
            </Link>
          </Button>
        </header>

        {slips.isLoading && <p className="text-sm text-muted-foreground">A carregar bilhetes…</p>}
        {slips.isError && (
          <p className="text-sm text-destructive">Não foi possível carregar os bilhetes.</p>
        )}
        {slips.data?.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Ainda não tem bilhetes. Escolha cotações em Desportos para criar o primeiro.
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {(slips.data ?? []).map((slip) => {
            const status = STATUS[slip.status];
            return (
              <Card key={slip.id}>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
                  <div>
                    <CardTitle className="text-base">
                      {slip.kind === "multiple" ? "Múltipla" : "Simples"} ·{" "}
                      <span className="font-mono text-sm text-muted-foreground">
                        {slip.reference}
                      </span>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {when.format(new Date(slip.createdAt))}
                    </p>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {slip.selections.map((selection, index) => (
                    <div key={`${slip.id}-${index}`} className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            {selectionLabel(
                              selection.market,
                              selection.selection,
                              selection.line,
                              selection.homeTeam,
                              selection.awayTeam,
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {selection.homeTeam} — {selection.awayTeam}
                            {selection.homeScore !== null && selection.awayScore !== null
                              ? ` · ${selection.homeScore}-${selection.awayScore}`
                              : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-semibold">{selection.price.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">
                            {RESULT_LABEL[selection.result]}
                          </p>
                        </div>
                      </div>
                      <Separator />
                    </div>
                  ))}

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div>
                      <p className="text-xs text-muted-foreground">Aposta</p>
                      <p className="font-mono font-semibold">{MZN.format(slip.stake)} MZN</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Cotação</p>
                      <p className="font-mono font-semibold">{slip.totalOdds.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {slip.status === "open" ? "Ganho possível" : "Pago"}
                      </p>
                      <p className="font-mono font-semibold">
                        {MZN.format(slip.status === "open" ? slip.potentialPayout : (slip.payout ?? 0))}{" "}
                        MZN
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
