/**
 * liveScoreService — camada de leitura dos jogos em direto.
 *
 * A UI lê sempre a nossa base de dados (nunca o fornecedor), por isso milhares
 * de utilizadores em simultâneo não geram um único pedido externo extra.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type LiveMatchEvent = {
  minute: number | null;
  extraMinute: number | null;
  kind: string;
  detail: string | null;
  side: "home" | "away" | null;
  player: string | null;
  assist: string | null;
};

export type LiveMatch = {
  id: string;
  status: string;
  providerStatus: string | null;
  competitionKey: string;
  competitionName: string;
  region: string | null;
  sportName: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  homeScore: number | null;
  awayScore: number | null;
  elapsed: number | null;
  extra: number | null;
  period: string | null;
  venue: string | null;
  round: string | null;
  commenceAt: string;
  liveUpdatedAt: string | null;
  events: LiveMatchEvent[];
};

export type LiveBoard = {
  configured: boolean;
  active: boolean;
  stale: boolean;
  lastSyncAt: string | null;
  sports: Array<{ key: string; name: string }>;
  live: LiveMatch[];
  today: LiveMatch[];
  upcoming: LiveMatch[];
  results: LiveMatch[];
};

const SELECT =
  "id, status, provider_status, home_team, away_team, home_logo, away_logo, home_score, away_score, elapsed_minutes, extra_minutes, period, venue, round, commence_at, live_updated_at, sport_competitions!inner(key, name, region, sports!inner(key, name))";

type Row = Record<string, unknown>;

function mapMatch(row: Row): LiveMatch {
  const competition = row["sport_competitions"] as {
    key: string;
    name: string;
    region: string | null;
    sports: { key: string; name: string } | { key: string; name: string }[];
  };
  const sport = Array.isArray(competition.sports) ? competition.sports[0] : competition.sports;
  return {
    id: row["id"] as string,
    status: row["status"] as string,
    providerStatus: (row["provider_status"] as string | null) ?? null,
    competitionKey: competition.key,
    competitionName: competition.name,
    region: competition.region ?? null,
    sportName: sport?.name ?? "Desporto",
    homeTeam: row["home_team"] as string,
    awayTeam: row["away_team"] as string,
    homeLogo: (row["home_logo"] as string | null) ?? null,
    awayLogo: (row["away_logo"] as string | null) ?? null,
    homeScore: row["home_score"] === null ? null : Number(row["home_score"]),
    awayScore: row["away_score"] === null ? null : Number(row["away_score"]),
    elapsed: row["elapsed_minutes"] === null ? null : Number(row["elapsed_minutes"]),
    extra: row["extra_minutes"] === null ? null : Number(row["extra_minutes"]),
    period: (row["period"] as string | null) ?? null,
    venue: (row["venue"] as string | null) ?? null,
    round: (row["round"] as string | null) ?? null,
    commenceAt: row["commence_at"] as string,
    liveUpdatedAt: (row["live_updated_at"] as string | null) ?? null,
    events: [],
  };
}

async function attachEvents(
  supabase: { from: (t: string) => any },
  matches: LiveMatch[],
  limitPerMatch = 4,
): Promise<void> {
  if (!matches.length) return;
  const { data } = await supabase
    .from("sport_match_events")
    .select("event_id, minute, extra_minute, kind, detail, team_side, player, assist")
    .in(
      "event_id",
      matches.map((m) => m.id),
    )
    .order("minute", { ascending: false })
    .limit(400);
  const byMatch = new Map<string, LiveMatchEvent[]>();
  for (const raw of (data ?? []) as Row[]) {
    const id = raw["event_id"] as string;
    const list = byMatch.get(id) ?? [];
    if (list.length >= limitPerMatch) continue;
    list.push({
      minute: raw["minute"] === null ? null : Number(raw["minute"]),
      extraMinute: raw["extra_minute"] === null ? null : Number(raw["extra_minute"]),
      kind: raw["kind"] as string,
      detail: (raw["detail"] as string | null) ?? null,
      side: (raw["team_side"] as "home" | "away" | null) ?? null,
      player: (raw["player"] as string | null) ?? null,
      assist: (raw["assist"] as string | null) ?? null,
    });
    byMatch.set(id, list);
  }
  for (const match of matches) match.events = byMatch.get(match.id) ?? [];
}

/** Quadro público: ao vivo, hoje, próximos e resultados. */
export const getLiveBoard = createServerFn({ method: "GET" }).handler(
  async (): Promise<LiveBoard> => {
    const configured = Boolean(process.env["API_FOOTBALL_KEY"]?.trim());
    const { publicClient } = await import("@/lib/investments/public-client.server");
    const supabase = publicClient();

    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);

    const [liveRes, todayRes, upcomingRes, resultsRes, sportsRes] = await Promise.all([
      supabase
        .from("sport_events")
        .select(SELECT)
        .in("status", ["live", "halftime", "suspended"])
        .order("commence_at", { ascending: true })
        .limit(80),
      supabase
        .from("sport_events")
        .select(SELECT)
        .eq("status", "scheduled")
        .gte("commence_at", now.toISOString())
        .lt("commence_at", dayEnd.toISOString())
        .order("commence_at", { ascending: true })
        .limit(60),
      supabase
        .from("sport_events")
        .select(SELECT)
        .eq("status", "scheduled")
        .gte("commence_at", dayEnd.toISOString())
        .order("commence_at", { ascending: true })
        .limit(60),
      supabase
        .from("sport_events")
        .select(SELECT)
        .in("status", ["finished", "settled", "closed"])
        .order("commence_at", { ascending: false })
        .limit(60),
      supabase.from("sports").select("key, name").eq("active", true).order("name"),
    ]);

    const live = ((liveRes.data ?? []) as Row[]).map(mapMatch);
    const today = ((todayRes.data ?? []) as Row[]).map(mapMatch);
    const upcoming = ((upcomingRes.data ?? []) as Row[]).map(mapMatch);
    const results = ((resultsRes.data ?? []) as Row[]).map(mapMatch);

    await attachEvents(supabase as never, live);
    await attachEvents(supabase as never, results.slice(0, 20), 3);

    const lastSyncAt =
      live
        .map((m) => m.liveUpdatedAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null;

    return {
      configured,
      active: configured,
      stale: Boolean(lastSyncAt) && Date.now() - new Date(lastSyncAt as string).getTime() > 300_000,
      lastSyncAt,
      sports: ((sportsRes.data ?? []) as Row[]).map((row) => ({
        key: row["key"] as string,
        name: row["name"] as string,
      })),
      live,
      today,
      upcoming,
      results,
    };
  },
);

export type MatchDetail = LiveMatch & {
  statistics: Array<{ metric: string; home: string | null; away: string | null }>;
  timeline: LiveMatchEvent[];
};

/** Detalhe de um jogo. Pede o detalhe ao fornecedor só quando faz sentido. */
export const getMatchDetail = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<MatchDetail | null> => {
    const { enrichMatch } = await import("./live-sync.server");
    await enrichMatch(data.id).catch(() => null);

    const { publicClient } = await import("@/lib/investments/public-client.server");
    const supabase = publicClient();

    const { data: row } = await supabase
      .from("sport_events")
      .select(SELECT)
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return null;

    const match = mapMatch(row as Row) as MatchDetail;

    const [{ data: events }, { data: stats }] = await Promise.all([
      supabase
        .from("sport_match_events")
        .select("minute, extra_minute, kind, detail, team_side, player, assist")
        .eq("event_id", data.id)
        .order("minute", { ascending: true })
        .limit(200),
      supabase
        .from("sport_match_stats")
        .select("team_side, metric, value")
        .eq("event_id", data.id)
        .limit(200),
    ]);

    match.timeline = ((events ?? []) as Row[]).map((raw) => ({
      minute: raw["minute"] === null ? null : Number(raw["minute"]),
      extraMinute: raw["extra_minute"] === null ? null : Number(raw["extra_minute"]),
      kind: raw["kind"] as string,
      detail: (raw["detail"] as string | null) ?? null,
      side: (raw["team_side"] as "home" | "away" | null) ?? null,
      player: (raw["player"] as string | null) ?? null,
      assist: (raw["assist"] as string | null) ?? null,
    }));
    match.events = match.timeline.slice(-4).reverse();

    const byMetric = new Map<string, { home: string | null; away: string | null }>();
    for (const raw of (stats ?? []) as Row[]) {
      const metric = raw["metric"] as string;
      const entry = byMetric.get(metric) ?? { home: null, away: null };
      if (raw["team_side"] === "home") entry.home = (raw["value"] as string | null) ?? null;
      else entry.away = (raw["value"] as string | null) ?? null;
      byMetric.set(metric, entry);
    }
    match.statistics = [...byMetric.entries()].map(([metric, value]) => ({ metric, ...value }));

    return match;
  });

// ------------------------------------------------------------------ administração

export type SportsAdminState = {
  configured: boolean;
  config: {
    provider: string;
    active: boolean;
    liveIntervalSeconds: number;
    catalogIntervalSeconds: number;
    dailyRequestBudget: number;
    enabledSports: string[];
    requestsToday: number;
    lastLiveSyncAt: string | null;
    lastCatalogSyncAt: string | null;
    lastError: string | null;
    lastErrorAt: string | null;
  } | null;
  counts: { live: number; scheduled: number; finished: number; matchEvents: number };
  logs: Array<{
    id: number;
    kind: string;
    ok: boolean;
    requestsUsed: number;
    matchesTouched: number;
    eventsInserted: number;
    durationMs: number | null;
    error: string | null;
    createdAt: string;
  }>;
};

async function assertAdmin(context: {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  userId: string;
}): Promise<boolean> {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  return Boolean(data);
}

export const getSportsAdminState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SportsAdminState> => {
    if (!(await assertAdmin(context as never))) {
      return { configured: false, config: null, counts: { live: 0, scheduled: 0, finished: 0, matchEvents: 0 }, logs: [] };
    }
    const { readConfig } = await import("./live-sync.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const config = await readConfig();

    const [live, scheduled, finished, matchEvents, logs] = await Promise.all([
      supabaseAdmin.from("sport_events").select("id", { count: "exact", head: true }).in("status", ["live", "halftime"]),
      supabaseAdmin.from("sport_events").select("id", { count: "exact", head: true }).eq("status", "scheduled"),
      supabaseAdmin
        .from("sport_events")
        .select("id", { count: "exact", head: true })
        .in("status", ["finished", "settled", "closed"]),
      supabaseAdmin.from("sport_match_events").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("sports_sync_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    return {
      configured: Boolean(process.env["API_FOOTBALL_KEY"]?.trim()),
      config: config
        ? {
            provider: config.provider,
            active: config.active,
            liveIntervalSeconds: config.liveIntervalSeconds,
            catalogIntervalSeconds: config.catalogIntervalSeconds,
            dailyRequestBudget: config.dailyRequestBudget,
            enabledSports: config.enabledSports,
            requestsToday: config.requestsToday,
            lastLiveSyncAt: config.lastLiveSyncAt,
            lastCatalogSyncAt: config.lastCatalogSyncAt,
            lastError: config.lastError,
            lastErrorAt: config.lastErrorAt,
          }
        : null,
      counts: {
        live: live.count ?? 0,
        scheduled: scheduled.count ?? 0,
        finished: finished.count ?? 0,
        matchEvents: matchEvents.count ?? 0,
      },
      logs: ((logs.data ?? []) as Row[]).map((row) => ({
        id: Number(row["id"]),
        kind: row["kind"] as string,
        ok: Boolean(row["ok"]),
        requestsUsed: Number(row["requests_used"]),
        matchesTouched: Number(row["matches_touched"]),
        eventsInserted: Number(row["events_inserted"]),
        durationMs: row["duration_ms"] === null ? null : Number(row["duration_ms"]),
        error: (row["error"] as string | null) ?? null,
        createdAt: row["created_at"] as string,
      })),
    };
  });

const configInput = z.object({
  active: z.boolean().optional(),
  liveIntervalSeconds: z.number().int().min(15).max(3600).optional(),
  catalogIntervalSeconds: z.number().int().min(300).max(86_400).optional(),
  dailyRequestBudget: z.number().int().min(10).max(200_000).optional(),
  enabledSports: z.array(z.string().min(1).max(40)).max(20).optional(),
});

export const updateSportsConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => configInput.parse(input))
  .handler(async ({ data, context }) => {
    if (!(await assertAdmin(context as never))) {
      return { ok: false as const, error: "Sem permissões de administração." };
    }
    const { readConfig } = await import("./live-sync.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const config = await readConfig();
    if (!config) return { ok: false as const, error: "Configuração ausente." };

    const patch: Record<string, string | number | boolean | string[]> = {};
    if (data.active !== undefined) patch["active"] = data.active;
    if (data.liveIntervalSeconds !== undefined) patch["live_interval_seconds"] = data.liveIntervalSeconds;
    if (data.catalogIntervalSeconds !== undefined)
      patch["catalog_interval_seconds"] = data.catalogIntervalSeconds;
    if (data.dailyRequestBudget !== undefined) patch["daily_request_budget"] = data.dailyRequestBudget;
    if (data.enabledSports !== undefined) patch["enabled_sports"] = data.enabledSports;
    if (!Object.keys(patch).length) return { ok: true as const };

    const { error } = await supabaseAdmin
      .from("sports_provider_config")
      .update(patch as never)
      .eq("id", config.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const testSportsProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await assertAdmin(context as never))) {
      return { ok: false as const, error: "Sem permissões de administração." };
    }
    const { fetchProviderStatus, providerConfigured } = await import("./provider.server");
    if (!providerConfigured()) return { ok: false as const, error: "API_FOOTBALL_KEY não configurado." };
    try {
      const status = await fetchProviderStatus();
      return {
        ok: true as const,
        plan: status.subscription?.plan ?? null,
        activePlan: Boolean(status.subscription?.active),
        used: status.requests?.current ?? null,
        limit: status.requests?.limit_day ?? null,
      };
    } catch (error) {
      return { ok: false as const, error: (error as Error).message.slice(0, 300) };
    }
  });

export const syncLiveNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await assertAdmin(context as never))) {
      return { ok: false as const, error: "Sem permissões de administração." };
    }
    const { syncLiveMatches } = await import("./live-sync.server");
    const result = await syncLiveMatches(true);
    return { ok: result.ok, result };
  });
