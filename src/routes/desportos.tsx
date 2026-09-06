import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Info, RefreshCw, Ticket } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SlipPanel, type SlipSelection } from "@/components/sports/slip-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { MARKET_NAMES, shortLabel, SLIP_LIMITS, type Market } from "@/lib/sports/markets";
import {
  getSportsBoard,
  placeBetSlip,
  type SportEvent,
  type SportsBoard,
} from "@/lib/sports/sports.functions";

export const Route = createFileRoute("/desportos")({
  loader: () => getSportsBoard(),
  errorComponent: () => (
    <main className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">Não foi possível carregar os desportos</h1>
      <p className="mt-2 text-muted-foreground">Tente novamente dentro de alguns instantes.</p>
    </main>
  ),
  notFoundComponent: () => <p className="p-8">Página não encontrada.</p>,
  head: () => ({
    meta: [
      { title: "SQs Apostas Desportivas — jogos e cotações atualizadas" },
      {
        name: "description",
        content:
          "Jogos e cotações atualizadas de futebol e outros desportos em meticais: resultado final, dupla chance e mais/menos golos, com bilhetes simples e múltiplos validados no servidor.",
      },
      { property: "og:title", content: "SQs Apostas Desportivas — BETFCOM SQs" },
      {
        property: "og:description",
        content:
          "Cotações de mercado, bilhetes simples e múltiplos e liquidação automática por resultado final. Apostar envolve risco.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SportsPage,
});

const MARKET_ORDER: Market[] = ["h2h", "dc", "totals", "btts"];

const dateFormatter = new Intl.DateTimeFormat("pt-PT", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function keyOf(item: { eventId: string; market: string; selection: string; line: number | null }) {
  return `${item.eventId}:${item.market}:${item.selection}:${item.line ?? ""}`;
}

function SportsPage() {
  const board = Route.useLoaderData() as SportsBoard;
  const navigate = useNavigate();
  const submit = useServerFn(placeBetSlip);

  const [signedIn, setSignedIn] = useState(false);
  const [competition, setCompetition] = useState<string>("all");
  const [selections, setSelections] = useState<SlipSelection[]>([]);
  const [stake, setStake] = useState(SLIP_LIMITS.minStake);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.session));
    });
    return () => {
      active = false;
    };
  }, []);

  const events = useMemo(
    () =>
      competition === "all"
        ? board.events
        : board.events.filter((event) => event.competitionKey === competition),
    [board.events, competition],
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await submit({
        data: {
          stake,
          idempotencyKey: crypto.randomUUID(),
          selections: selections.map((item) => ({
            eventId: item.eventId,
            market: item.market,
            selection: item.selection,
            line: item.line,
            price: item.price,
          })),
        },
      });
      if (!result.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: (result) => {
      setSelections([]);
      setError(null);
      toast.success("Bilhete registado", { description: `Referência ${result.reference ?? "—"}` });
    },
    onError: (err: Error) => setError(err.message),
  });

  function toggle(event: SportEvent, market: Market, selection: string, line: number | null, price: number) {
    const candidate: SlipSelection = {
      eventId: event.id,
      market,
      selection,
      line,
      price,
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
    };
    setError(null);
    setSelections((current) => {
      const exists = current.some((item) => keyOf(item) === keyOf(candidate));
      if (exists) return current.filter((item) => keyOf(item) !== keyOf(candidate));
      // Um jogo entra no bilhete apenas uma vez.
      const withoutEvent = current.filter((item) => item.eventId !== event.id);
      if (withoutEvent.length >= SLIP_LIMITS.maxSelections) return current;
      return [...withoutEvent, candidate];
    });
  }

  const selectedKeys = new Set(selections.map(keyOf));

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <header className="mb-6">
          <Badge variant="secondary" className="mb-2">
            SQs Apostas
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight">Desportos</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Jogos e cotações de mercado em meticais. O bilhete, o saldo e a liquidação são sempre
            decididos no servidor.
          </p>
          {board.updatedAt && (
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="size-3" />
              Cotações atualizadas em {dateFormatter.format(new Date(board.updatedAt))}
            </p>
          )}
        </header>

        {!board.configured && (
          <Card className="mb-6 border-dashed">
            <CardContent className="flex items-start gap-3 py-5 text-sm">
              <Info className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <p>
                <span className="font-semibold">Desportos não configurado.</span> Falta a chave do
                fornecedor de cotações, por isso não há jogos nem cotações — nada é simulado.
              </p>
            </CardContent>
          </Card>
        )}

        {board.configured && board.events.length === 0 && (
          <Card className="mb-6 border-dashed">
            <CardContent className="flex items-start gap-3 py-5 text-sm">
              <CalendarClock className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <p>
                Ainda não há jogos sincronizados. A sincronização corre automaticamente; um
                administrador também pode forçá-la no painel de administração.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <section>
            {board.competitions.length > 0 && (
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                <Button
                  variant={competition === "all" ? "default" : "outline"}
                  size="sm"
                  className="shrink-0 rounded-full"
                  onClick={() => setCompetition("all")}
                >
                  Todos ({board.events.length})
                </Button>
                {board.competitions.map((item) => (
                  <Button
                    key={item.key}
                    variant={competition === item.key ? "default" : "outline"}
                    size="sm"
                    className="shrink-0 rounded-full"
                    onClick={() => setCompetition(item.key)}
                  >
                    {item.name} ({item.events})
                  </Button>
                ))}
              </div>
            )}

            <div className="space-y-4">
              {events.map((event) => {
                const grouped = MARKET_ORDER.map((market) => ({
                  market,
                  odds: event.odds
                    .filter((odd) => odd.market === market)
                    .sort((a, b) => (a.line ?? 0) - (b.line ?? 0)),
                })).filter((group) => group.odds.length > 0);

                return (
                  <Card key={event.id} className="overflow-hidden">
                    <CardContent className="space-y-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            {event.sportName} · {event.competitionName}
                          </p>
                          <p className="text-base font-semibold">
                            {event.homeTeam} <span className="text-muted-foreground">vs</span>{" "}
                            {event.awayTeam}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {dateFormatter.format(new Date(event.commenceAt))}
                        </p>
                      </div>

                      {grouped.map((group) => (
                        <div key={group.market}>
                          <p className="mb-2 text-xs font-medium text-muted-foreground">
                            {MARKET_NAMES[group.market]}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {group.odds.slice(0, 6).map((odd) => {
                              const key = keyOf({
                                eventId: event.id,
                                market: group.market,
                                selection: odd.selection,
                                line: odd.line,
                              });
                              const active = selectedKeys.has(key);
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() =>
                                    toggle(event, group.market, odd.selection, odd.line, odd.price)
                                  }
                                  className={`flex min-w-[86px] flex-col items-center rounded-xl border px-3 py-2 text-sm transition-colors ${
                                    active
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "bg-muted/50 hover:bg-muted"
                                  }`}
                                >
                                  <span className="text-xs opacity-80">
                                    {shortLabel(group.market, odd.selection, odd.line)}
                                  </span>
                                  <span className="font-mono font-semibold">
                                    {odd.price.toFixed(2)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          <aside className="lg:sticky lg:top-24 lg:h-fit">
            <SlipPanel
              selections={selections}
              stake={stake}
              signedIn={signedIn}
              pending={mutation.isPending}
              error={error}
              onStake={setStake}
              onRemove={(item) =>
                setSelections((current) => current.filter((entry) => keyOf(entry) !== keyOf(item)))
              }
              onClear={() => setSelections([])}
              onSubmit={() => {
                if (!signedIn) {
                  void navigate({ to: "/auth" });
                  return;
                }
                mutation.mutate();
              }}
            />
            {signedIn && (
              <Button asChild variant="outline" className="mt-3 w-full">
                <Link to="/bilhetes">
                  <Ticket className="size-4" /> Os meus bilhetes
                </Link>
              </Button>
            )}
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
