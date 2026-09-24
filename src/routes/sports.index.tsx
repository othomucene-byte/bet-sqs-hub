import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Radio, RefreshCw, WifiOff } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { applyDelta, LiveMatchCard } from "@/components/sports/live-match-card";
import { useSportsLive } from "@/hooks/use-sports-live";
import { getLiveBoard, type LiveBoard, type LiveMatch } from "@/lib/sports/live.functions";

export const Route = createFileRoute("/sports/")({
  loader: () => getLiveBoard(),
  errorComponent: () => (
    <main className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">Não foi possível carregar os jogos</h1>
      <p className="mt-2 text-muted-foreground">Dados ao vivo temporariamente indisponíveis.</p>
    </main>
  ),
  notFoundComponent: () => <p className="p-8">Página não encontrada.</p>,
  head: () => ({
    meta: [
      { title: "Jogos ao vivo e resultados — Betfcom SQs" },
      {
        name: "description",
        content:
          "Resultados em direto, jogos de hoje, próximos encontros e resultados finais das principais competições, atualizados automaticamente na Betfcom SQs.",
      },
      { property: "og:title", content: "Jogos ao vivo e resultados — Betfcom SQs" },
      {
        property: "og:description",
        content:
          "Placar em tempo real, minuto de jogo, golos e cartões das competições mais seguidas, em português.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SportsPage,
});

type Scope = "live" | "today" | "upcoming" | "results";

function SportsPage() {
  const initial = Route.useLoaderData();
  const fetchBoard = useServerFn(getLiveBoard);
  const [scope, setScope] = useState<Scope>(initial.live.length ? "live" : "today");
  const [sport, setSport] = useState<string>("all");

  const query = useQuery<LiveBoard>({
    queryKey: ["sports-live-board"],
    queryFn: () => fetchBoard(),
    initialData: initial,
    refetchInterval: 60_000,
  });

  const stream = useSportsLive(true, () => void query.refetch());
  const board = query.data;

  const lists: Record<Scope, LiveMatch[]> = useMemo(
    () => ({
      live: board.live.map((match) => applyDelta(match, stream.deltas[match.id])),
      today: board.today.map((match) => applyDelta(match, stream.deltas[match.id])),
      upcoming: board.upcoming,
      results: board.results,
    }),
    [board, stream.deltas],
  );

  const sportOptions = useMemo(() => {
    const names = new Set<string>();
    for (const list of Object.values(lists)) for (const match of list) names.add(match.sportName);
    return [...names].sort();
  }, [lists]);

  const visible = lists[scope].filter(
    (match) => sport === "all" || match.sportName === sport,
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Radio className="size-5 text-red-500" /> Jogos em direto
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Placar, minuto e acontecimentos atualizados automaticamente. Sem dados simulados.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={stream.connected ? "default" : "secondary"} className="gap-1">
              {stream.connected ? <Radio className="size-3" /> : <WifiOff className="size-3" />}
              {stream.connected ? "Em tempo real" : "A ligar…"}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </header>

        {!board.configured && (
          <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
            Dados ao vivo temporariamente indisponíveis: fornecedor desportivo não configurado.
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Tabs value={scope} onValueChange={(value) => setScope(value as Scope)}>
            <TabsList>
              <TabsTrigger value="live">Ao vivo ({lists.live.length})</TabsTrigger>
              <TabsTrigger value="today">Hoje</TabsTrigger>
              <TabsTrigger value="upcoming">Próximos</TabsTrigger>
              <TabsTrigger value="results">Resultados</TabsTrigger>
            </TabsList>
          </Tabs>
          {sportOptions.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              <Button
                size="sm"
                variant={sport === "all" ? "default" : "outline"}
                onClick={() => setSport("all")}
              >
                Todos
              </Button>
              {sportOptions.map((name) => (
                <Button
                  key={name}
                  size="sm"
                  variant={sport === name ? "default" : "outline"}
                  onClick={() => setSport(name)}
                >
                  {name}
                </Button>
              ))}
            </div>
          )}
        </div>

        <section className="mt-5 grid gap-3 sm:grid-cols-2">
          {visible.map((match) => (
            <LiveMatchCard key={match.id} match={match} />
          ))}
        </section>

        {!visible.length && (
          <p className="mt-10 rounded-2xl border border-border/60 bg-card/60 p-6 text-center text-sm text-muted-foreground">
            {scope === "live"
              ? "Nenhum jogo a decorrer neste momento."
              : "Sem jogos nesta lista por agora."}
          </p>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Quer apostar? Veja as cotações em{" "}
          <Link to="/desportos" className="underline">
            SQs Apostas
          </Link>
          .
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
