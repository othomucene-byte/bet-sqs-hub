import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, MapPin, Radio } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { applyDelta, eventLine, statusLabel } from "@/components/sports/live-match-card";
import { useSportsLive } from "@/hooks/use-sports-live";
import { getMatchDetail, type MatchDetail } from "@/lib/sports/live.functions";

export const Route = createFileRoute("/sports/matches/$id")({
  loader: ({ params }) => getMatchDetail({ data: { id: params.id } }),
  errorComponent: () => (
    <main className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">Dados ao vivo temporariamente indisponíveis</h1>
    </main>
  ),
  notFoundComponent: () => <p className="p-8">Jogo não encontrado.</p>,
  head: () => ({
    meta: [
      { title: "Jogo ao vivo — Betfcom SQs" },
      {
        name: "description",
        content:
          "Placar ao minuto, cronologia de golos e cartões, estatísticas e estado do jogo em direto na Betfcom SQs.",
      },
      { property: "og:title", content: "Jogo ao vivo — Betfcom SQs" },
      {
        property: "og:description",
        content: "Acompanhe o jogo minuto a minuto com dados reais do fornecedor desportivo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MatchPage,
});

function Crest({ name, logo }: { name: string; logo: string | null }) {
  if (logo) {
    return <img src={logo} alt={name} className="size-14 object-contain" loading="lazy" />;
  }
  return (
    <div className="flex size-14 items-center justify-center rounded-xl bg-muted text-sm font-bold text-muted-foreground">
      {name.slice(0, 3).toUpperCase()}
    </div>
  );
}

function MatchPage() {
  const { id } = Route.useParams();
  const initial = Route.useLoaderData();
  const fetchDetail = useServerFn(getMatchDetail);

  const query = useQuery<MatchDetail | null>({
    queryKey: ["sports-match", id],
    queryFn: () => fetchDetail({ data: { id } }),
    initialData: initial,
    refetchInterval: 30_000,
  });

  const stream = useSportsLive(true, () => void query.refetch());
  const raw = query.data;

  if (!raw) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-2xl flex-1 px-4 py-20 text-center">
          <h1 className="text-xl font-bold">Jogo não encontrado</h1>
          <Link to="/sports" className="mt-3 inline-block text-sm underline">
            Voltar aos jogos
          </Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const match = { ...raw, ...applyDelta(raw, stream.deltas[raw.id]) } as MatchDetail;
  const isLive = match.status === "live" || match.status === "halftime";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Link to="/sports" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" /> Jogos
        </Link>

        <Card className="mt-3 overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="truncate">
                {match.competitionName}
                {match.round ? ` · ${match.round}` : ""}
              </span>
              {isLive ? (
                <Badge className="gap-1 bg-red-600 text-white hover:bg-red-600">
                  <Radio className="size-3" /> {statusLabel(match)}
                </Badge>
              ) : (
                <Badge variant="secondary">{statusLabel(match)}</Badge>
              )}
            </div>

            <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="flex flex-col items-center gap-2 text-center">
                <Crest name={match.homeTeam} logo={match.homeLogo} />
                <span className="text-sm font-semibold">{match.homeTeam}</span>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold tabular-nums">
                  {match.homeScore ?? "-"} <span className="text-muted-foreground">–</span>{" "}
                  {match.awayScore ?? "-"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {match.period ?? statusLabel(match)}
                </div>
              </div>
              <div className="flex flex-col items-center gap-2 text-center">
                <Crest name={match.awayTeam} logo={match.awayLogo} />
                <span className="text-sm font-semibold">{match.awayTeam}</span>
              </div>
            </div>

            {match.venue && (
              <p className="mt-4 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" /> {match.venue}
              </p>
            )}
          </CardContent>
        </Card>

        <section className="mt-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Cronologia
          </h2>
          {match.timeline.length ? (
            <ol className="space-y-2">
              {[...match.timeline].reverse().map((item, index) => (
                <li
                  key={`${item.minute}-${item.player}-${index}`}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/70 p-3 text-sm"
                >
                  <span className="w-10 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                    {item.minute === null ? "—" : `${item.minute}'`}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {eventLine(item)}
                    {item.detail ? <span className="text-muted-foreground"> · {item.detail}</span> : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.side === "home" ? match.homeTeam : item.side === "away" ? match.awayTeam : ""}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-xl border border-border/60 bg-card/60 p-4 text-sm text-muted-foreground">
              Sem acontecimentos registados pelo fornecedor para este jogo.
            </p>
          )}
        </section>

        {match.statistics.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Estatísticas
            </h2>
            <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card/70">
              {match.statistics.map((stat) => (
                <div
                  key={stat.metric}
                  className="grid grid-cols-[3rem_1fr_3rem] items-center gap-2 px-3 py-2 text-sm"
                >
                  <span className="text-left font-semibold tabular-nums">{stat.home ?? "—"}</span>
                  <span className="truncate text-center text-xs text-muted-foreground">
                    {stat.metric}
                  </span>
                  <span className="text-right font-semibold tabular-nums">{stat.away ?? "—"}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
