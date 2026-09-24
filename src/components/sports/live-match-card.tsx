import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LiveMatch, LiveMatchEvent } from "@/lib/sports/live.functions";
import type { LiveDelta } from "@/hooks/use-sports-live";

const MAPUTO = "Africa/Maputo";

function hour(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: MAPUTO,
    }).format(new Date(iso));
  } catch {
    return "--:--";
  }
}

function dayLabel(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-PT", {
      day: "2-digit",
      month: "short",
      timeZone: MAPUTO,
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

function TeamCrest({ name, logo }: { name: string; logo: string | null }) {
  if (logo) {
    return (
      <img
        src={logo}
        alt={name}
        loading="lazy"
        className="size-9 rounded-lg bg-muted/60 object-contain p-0.5"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />
    );
  }
  return (
    <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
      {name.slice(0, 3).toUpperCase()}
    </div>
  );
}

function eventIcon(kind: string, detail: string | null): string {
  const value = `${kind} ${detail ?? ""}`.toLowerCase();
  if (value.includes("goal")) return "⚽";
  if (value.includes("red")) return "🟥";
  if (value.includes("yellow")) return "🟨";
  if (value.includes("subst")) return "🔁";
  if (value.includes("var")) return "📺";
  return "•";
}

export function eventLine(item: LiveMatchEvent): string {
  const minute = item.minute === null ? "" : `${item.minute}${item.extraMinute ? `+${item.extraMinute}` : ""}'`;
  const who = item.player ?? item.detail ?? item.kind;
  return `${who} ${minute}`.trim();
}

export function statusLabel(match: Pick<LiveMatch, "status" | "period" | "elapsed">): string {
  if (match.status === "halftime") return "Intervalo";
  if (match.status === "suspended") return "Suspenso";
  if (match.status === "finished" || match.status === "settled" || match.status === "closed")
    return "Terminado";
  if (match.status === "postponed") return "Adiado";
  if (match.status === "cancelled") return "Cancelado";
  if (match.status === "live") return match.elapsed !== null ? `${match.elapsed}'` : "Ao vivo";
  return "Agendado";
}

export function applyDelta(match: LiveMatch, delta: LiveDelta | undefined): LiveMatch {
  if (!delta) return match;
  return {
    ...match,
    status: delta.status,
    homeScore: delta.homeScore,
    awayScore: delta.awayScore,
    elapsed: delta.elapsed,
    period: delta.period,
  };
}

export function LiveMatchCard({ match }: { match: LiveMatch }) {
  const isLive = match.status === "live" || match.status === "halftime";
  const finished = ["finished", "settled", "closed"].includes(match.status);
  const scored = match.homeScore !== null && match.awayScore !== null;

  return (
    <Link
      to="/sports/matches/$id"
      params={{ id: match.id }}
      className="block rounded-2xl border border-border/70 bg-card/80 p-4 transition hover:border-primary/60 hover:bg-card"
    >
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate font-medium">
          {match.competitionName}
          {match.region ? ` · ${match.region}` : ""}
        </span>
        {isLive ? (
          <Badge className="gap-1 bg-red-600 text-white hover:bg-red-600">
            <span className="size-1.5 animate-pulse rounded-full bg-white" />
            {match.status === "halftime" ? "Intervalo" : "AO VIVO"}
          </Badge>
        ) : (
          <span className="shrink-0">
            {finished ? "Terminado" : `${dayLabel(match.commenceAt)} · ${hour(match.commenceAt)}`}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <TeamCrest name={match.homeTeam} logo={match.homeLogo} />
          <span className="truncate text-sm font-semibold">{match.homeTeam}</span>
        </div>
        <div className="text-center">
          <div
            className={cn(
              "text-2xl font-bold tabular-nums leading-none",
              isLive && "text-primary",
            )}
          >
            {scored ? `${match.homeScore} – ${match.awayScore}` : hour(match.commenceAt)}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">{statusLabel(match)}</div>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2">
          <span className="truncate text-right text-sm font-semibold">{match.awayTeam}</span>
          <TeamCrest name={match.awayTeam} logo={match.awayLogo} />
        </div>
      </div>

      {match.events.length > 0 && (
        <div className="mt-3 space-y-1 rounded-xl bg-muted/40 p-2">
          {match.events.slice(0, 3).map((item, index) => (
            <div
              key={`${item.minute}-${item.player}-${index}`}
              className={cn(
                "flex items-center gap-2 text-xs text-muted-foreground",
                item.side === "away" && "flex-row-reverse text-right",
              )}
            >
              <span>{eventIcon(item.kind, item.detail)}</span>
              <span className="truncate">{eventLine(item)}</span>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}
