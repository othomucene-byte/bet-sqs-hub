import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Radio, WifiOff } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Badge } from "@/components/ui/badge";
import { applyDelta, LiveMatchCard } from "@/components/sports/live-match-card";
import { useSportsLive } from "@/hooks/use-sports-live";
import { getLiveBoard, type LiveBoard } from "@/lib/sports/live.functions";

export const Route = createFileRoute("/sports/live")({
  loader: () => getLiveBoard(),
  errorComponent: () => (
    <main className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">Dados ao vivo temporariamente indisponíveis</h1>
    </main>
  ),
  notFoundComponent: () => <p className="p-8">Página não encontrada.</p>,
  head: () => ({
    meta: [
      { title: "Ao vivo agora — Betfcom SQs" },
      {
        name: "description",
        content:
          "Todos os jogos a decorrer agora, com placar ao minuto, golos e cartões, transmitidos em tempo real pela Betfcom SQs.",
      },
      { property: "og:title", content: "Ao vivo agora — Betfcom SQs" },
      {
        property: "og:description",
        content: "Placar em direto de todos os jogos a decorrer, atualizado automaticamente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LiveOnlyPage,
});

function LiveOnlyPage() {
  const initial = Route.useLoaderData();
  const fetchBoard = useServerFn(getLiveBoard);
  const query = useQuery<LiveBoard>({
    queryKey: ["sports-live-board"],
    queryFn: () => fetchBoard(),
    initialData: initial,
    refetchInterval: 45_000,
  });
  const stream = useSportsLive(true, () => void query.refetch());

  const byCompetition = useMemo(() => {
    const groups = new Map<string, ReturnType<typeof applyDelta>[]>();
    for (const raw of query.data.live) {
      const match = applyDelta(raw, stream.deltas[raw.id]);
      const list = groups.get(match.competitionName) ?? [];
      list.push(match);
      groups.set(match.competitionName, list);
    }
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [query.data.live, stream.deltas]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <span className="size-2 animate-pulse rounded-full bg-red-500" /> Ao vivo agora
          </h1>
          <Badge variant={stream.connected ? "default" : "secondary"} className="gap-1">
            {stream.connected ? <Radio className="size-3" /> : <WifiOff className="size-3" />}
            {stream.connected ? "Em tempo real" : "A ligar…"}
          </Badge>
        </header>

        {!query.data.configured && (
          <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
            Dados ao vivo temporariamente indisponíveis.
          </p>
        )}

        {byCompetition.map(([competition, matches]) => (
          <section key={competition} className="mt-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {competition}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {matches.map((match) => (
                <LiveMatchCard key={match.id} match={match} />
              ))}
            </div>
          </section>
        ))}

        {!byCompetition.length && (
          <p className="mt-10 rounded-2xl border border-border/60 bg-card/60 p-6 text-center text-sm text-muted-foreground">
            Nenhum jogo a decorrer neste momento. Veja{" "}
            <Link to="/sports" className="underline">
              hoje e próximos
            </Link>
            .
          </p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
