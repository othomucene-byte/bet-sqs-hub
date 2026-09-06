import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Info, RefreshCw, Ticket } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SlipPanel, totalOdds, type SlipSelection } from "@/components/sports/slip-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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

/** Logótipo oficial da competição a partir da chave `af_<id>` (CDN público do fornecedor). */
function competitionLogo(key: string): string | null {
  const match = /^af_(\d+)$/.exec(key);
  if (!match) return null;
  return `https://media.api-sports.io/football/leagues/${match[1]}.png`;
}

function SportsPage() {
  const board = Route.useLoaderData() as SportsBoard;
  const navigate = useNavigate();
  const submit = useServerFn(placeBetSlip);

  const [signedIn, setSignedIn] = useState(false);
  const [competition, setCompetition] = useState<string>("all");
  const [selections, setSelections] = useState<SlipSelection[]>([]);
  const [stake, setStake] = useState<number>(SLIP_LIMITS.minStake);
  const [error, setError] = useState<string | null>(null);
  const [slipOpen, setSlipOpen] = useState(false);

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
      setSlipOpen(false);
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

  const slip = (
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
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-6 sm:px-4 sm:py-8">
        <header className="mb-5">
          <Badge variant="secondary" className="mb-2">
            SQs Apostas
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Desportos</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Jogos e cotações de mercado em meticais. O bilhete, o saldo e a liquidação são sempre
            decididos no servidor.
          </p>
          {board.updatedAt && (
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="size-3 shrink-0" />
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

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0">
            {board.competitions.length > 0 && (
              <div className="-mx-3 mb-4 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
                <button
                  type="button"
                  onClick={() => setCompetition("all")}
                  className={`flex w-20 shrink-0 flex-col items-center gap-1 rounded-xl border p-2 transition-colors ${
                    competition === "all"
                      ? "border-primary bg-primary/10"
                      : "border-border/60 bg-card hover:bg-muted"
                  }`}
                >
                  <span className="flex size-11 items-center justify-center rounded-lg bg-primary text-sm font-black text-primary-foreground">
                    {board.events.length}
                  </span>
                  <span className="w-full truncate text-center text-[10px] font-semibold leading-tight">
                    Todos
                  </span>
                </button>
                {board.competitions.map((item) => {
                  const logo = competitionLogo(item.key);
                  const activeComp = competition === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setCompetition(item.key)}
                      className={`flex w-20 shrink-0 flex-col items-center gap-1 rounded-xl border p-2 transition-colors ${
                        activeComp
                          ? "border-primary bg-primary/10"
                          : "border-border/60 bg-card hover:bg-muted"
                      }`}
                    >
                      <span className="flex size-11 items-center justify-center overflow-hidden rounded-lg bg-white p-1">
                        {logo ? (
                          <img
                            src={logo}
                            alt={item.name}
                            loading="lazy"
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <span className="text-xs font-black text-slate-700">
                            {item.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </span>
                      <span className="w-full truncate text-center text-[10px] font-semibold leading-tight">
                        {item.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="space-y-3">
              {events.map((event) => {
                const grouped = MARKET_ORDER.map((market) => ({
                  market,
                  odds: event.odds
                    .filter((odd) => odd.market === market)
                    .sort((a, b) => (a.line ?? 0) - (b.line ?? 0)),
                })).filter((group) => group.odds.length > 0);

                return (
                  <Card key={event.id} className="overflow-hidden">
                    <CardContent className="space-y-3 p-3 sm:p-4">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            {event.sportName} · {event.competitionName}
                          </p>
                          <p className="mt-0.5 text-sm font-bold leading-snug sm:text-base">
                            {event.homeTeam}
                            <span className="mx-1 font-normal text-muted-foreground">vs</span>
                            {event.awayTeam}
                          </p>
                        </div>
                        <p className="shrink-0 rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                          {dateFormatter.format(new Date(event.commenceAt))}
                        </p>
                      </div>

                      {grouped.map((group) => (
                        <div key={group.market}>
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {MARKET_NAMES[group.market]}
                          </p>
                          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6">
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
                                  className={`flex min-w-0 flex-col items-center justify-center rounded-lg border px-2 py-2 transition-colors ${
                                    active
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-border/60 bg-muted/40 hover:bg-muted active:bg-muted"
                                  }`}
                                >
                                  <span className="w-full truncate text-center text-[11px] opacity-80">
                                    {shortLabel(group.market, odd.selection, odd.line)}
                                  </span>
                                  <span className="font-mono text-sm font-bold">
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

          <aside className="hidden lg:sticky lg:top-24 lg:block lg:h-fit">
            {slip}
            {signedIn && (
              <Button asChild variant="outline" className="mt-3 w-full">
                <Link to="/bilhetes">
                  <Ticket className="size-4" /> Os meus bilhetes
                </Link>
              </Button>
            )}
          </aside>
        </div>

        {/* Espaço para a barra fixa do bilhete no telemóvel */}
        <div className="h-24 lg:hidden" aria-hidden />
      </main>

      {/* Barra fixa do bilhete (telemóvel e tablet) */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">
              {selections.length === 0
                ? "Bilhete vazio"
                : `${selections.length} seleç${selections.length === 1 ? "ão" : "ões"} · cotação ${totalOdds(selections).toFixed(2)}`}
            </p>
            <p className="truncate text-sm font-bold">
              Ganho possível{" "}
              <span className="font-mono text-primary">
                {new Intl.NumberFormat("pt-PT", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(Math.min(stake * totalOdds(selections), SLIP_LIMITS.maxPayout))}{" "}
                MZN
              </span>
            </p>
          </div>
          <Sheet open={slipOpen} onOpenChange={setSlipOpen}>
            <SheetTrigger asChild>
              <Button className="h-11 shrink-0 rounded-xl px-4 font-bold">
                <Ticket className="size-4" /> Bilhete ({selections.length})
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[90dvh] gap-0 overflow-y-auto rounded-t-2xl p-3">
              <SheetHeader className="pb-2 text-left">
                <SheetTitle className="text-base">O meu bilhete</SheetTitle>
              </SheetHeader>
              {slip}
              {signedIn && (
                <Button asChild variant="outline" className="mt-3 w-full">
                  <Link to="/bilhetes" onClick={() => setSlipOpen(false)}>
                    <Ticket className="size-4" /> Os meus bilhetes
                  </Link>
                </Button>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

