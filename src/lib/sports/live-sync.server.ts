/**
 * sportsSync + sportsEvents — escreve na base de dados o que o fornecedor
 * devolve, sem inventar nada.
 *
 *  - Uma chamada `/fixtures?live=all` cobre todos os jogos a decorrer.
 *  - Só os jogos que mudaram são escritos; cada mudança fica registada em
 *    `sport_live_updates` para os ecrãs receberem apenas o que alterou.
 *  - Acontecimentos são idempotentes (chave única por jogo).
 *  - Falhas do fornecedor não apagam nada: fica o último estado válido.
 */

import {
  BudgetError,
  fetchFixtureById,
  fetchLiveFixtures,
  providerConfigured,
  type ProviderFixture,
} from "./provider.server";

export type MatchStatus =
  | "scheduled"
  | "live"
  | "halftime"
  | "finished"
  | "postponed"
  | "cancelled"
  | "suspended";

const STATUS_MAP: Record<string, MatchStatus> = {
  TBD: "scheduled",
  NS: "scheduled",
  "1H": "live",
  "2H": "live",
  ET: "live",
  BT: "live",
  P: "live",
  LIVE: "live",
  HT: "halftime",
  FT: "finished",
  AET: "finished",
  PEN: "finished",
  PST: "postponed",
  CANC: "cancelled",
  ABD: "suspended",
  SUSP: "suspended",
  INT: "suspended",
  AWD: "finished",
  WO: "finished",
};

export function mapStatus(short: string): MatchStatus {
  return STATUS_MAP[short] ?? "scheduled";
}

const PERIOD_LABEL: Record<string, string> = {
  "1H": "1.ª parte",
  "2H": "2.ª parte",
  HT: "Intervalo",
  ET: "Prolongamento",
  BT: "Intervalo do prolongamento",
  P: "Penáltis",
  FT: "Final",
  AET: "Final (prolongamento)",
  PEN: "Final (penáltis)",
};

type SyncResult = {
  ok: boolean;
  requests: number;
  matches: number;
  changed: number;
  eventsInserted: number;
  errors: string[];
};

async function logSync(
  kind: string,
  result: SyncResult,
  durationMs: number,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("sports_sync_log").insert({
    kind,
    ok: result.ok,
    requests_used: result.requests,
    matches_touched: result.matches,
    events_inserted: result.eventsInserted,
    duration_ms: Math.round(durationMs),
    error: result.errors.length ? result.errors.slice(0, 5).join(" | ").slice(0, 500) : null,
  });
}

async function markError(message: string | null): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: cfg } = await supabaseAdmin
    .from("sports_provider_config")
    .select("id")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!cfg) return;
  await supabaseAdmin
    .from("sports_provider_config")
    .update(
      message
        ? { last_error: message.slice(0, 500), last_error_at: new Date().toISOString() }
        : { last_error: null, last_error_at: null },
    )
    .eq("id", cfg.id);
}

export type SportsConfig = {
  id: string;
  provider: string;
  active: boolean;
  liveIntervalSeconds: number;
  catalogIntervalSeconds: number;
  dailyRequestBudget: number;
  enabledSports: string[];
  requestsToday: number;
  requestsDay: string;
  lastLiveSyncAt: string | null;
  lastCatalogSyncAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
};

export async function readConfig(): Promise<SportsConfig | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("sports_provider_config")
    .select("*")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    provider: data.provider as string,
    active: Boolean(data.active),
    liveIntervalSeconds: Number(data.live_interval_seconds),
    catalogIntervalSeconds: Number(data.catalog_interval_seconds),
    dailyRequestBudget: Number(data.daily_request_budget),
    enabledSports: Array.isArray(data.enabled_sports)
      ? (data.enabled_sports as string[])
      : ["futebol"],
    requestsToday: Number(data.requests_today),
    requestsDay: data.requests_day as string,
    lastLiveSyncAt: (data.last_live_sync_at as string | null) ?? null,
    lastCatalogSyncAt: (data.last_catalog_sync_at as string | null) ?? null,
    lastError: (data.last_error as string | null) ?? null,
    lastErrorAt: (data.last_error_at as string | null) ?? null,
  };
}

// --------------------------------------------------------------- persistência

async function ensureFootballSport(): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("sports")
    .upsert({ key: "futebol", name: "Futebol", grouping: "Futebol", active: true }, { onConflict: "key" })
    .select("id")
    .single();
  return (data?.id as string | undefined) ?? null;
}

const competitionCache = new Map<string, string>();

async function ensureCompetition(
  sportId: string,
  league: ProviderFixture["league"],
): Promise<string | null> {
  const key = `af_${league.id}`;
  const cachedId = competitionCache.get(key);
  if (cachedId) return cachedId;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("sport_competitions")
    .upsert(
      {
        sport_id: sportId,
        key,
        name: league.name,
        region: league.country ?? null,
        active: true,
      },
      { onConflict: "key" },
    )
    .select("id")
    .single();
  const id = (data?.id as string | undefined) ?? null;
  if (id) competitionCache.set(key, id);
  return id;
}

async function ensureTeams(fixture: ProviderFixture): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rows = [fixture.teams.home, fixture.teams.away]
    .filter((team) => team?.id)
    .map((team) => ({
      provider: "api-football",
      external_id: String(team.id),
      name: team.name,
      logo: team.logo ?? null,
      country: fixture.league.country ?? null,
    }));
  if (!rows.length) return;
  await supabaseAdmin.from("sport_teams").upsert(rows, { onConflict: "provider,external_id" });
}

function eventKey(item: NonNullable<ProviderFixture["events"]>[number]): string {
  return [
    item.time?.elapsed ?? "",
    item.time?.extra ?? "",
    item.type ?? "",
    item.detail ?? "",
    item.team?.id ?? "",
    item.player?.name ?? "",
  ].join("|");
}

async function saveMatchEvents(
  eventId: string,
  fixture: ProviderFixture,
): Promise<number> {
  const items = fixture.events ?? [];
  if (!items.length) return 0;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const homeId = fixture.teams.home?.id;
  const rows = items.map((item) => ({
    event_id: eventId,
    external_key: eventKey(item),
    minute: item.time?.elapsed ?? null,
    extra_minute: item.time?.extra ?? null,
    kind: item.type ?? "Event",
    detail: item.detail ?? null,
    team_side: item.team?.id && homeId ? (item.team.id === homeId ? "home" : "away") : null,
    player: item.player?.name ?? null,
    assist: item.assist?.name ?? null,
    comments: item.comments ?? null,
  }));
  const { data, error } = await supabaseAdmin
    .from("sport_match_events")
    .upsert(rows, { onConflict: "event_id,external_key", ignoreDuplicates: true })
    .select("id");
  if (error) return 0;
  return (data ?? []).length;
}

async function saveMatchStats(eventId: string, fixture: ProviderFixture): Promise<void> {
  const blocks = fixture.statistics ?? [];
  if (!blocks.length) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const homeId = fixture.teams.home?.id;
  const rows: Array<{ event_id: string; team_side: string; metric: string; value: string | null }> = [];
  for (const block of blocks) {
    const side = block.team?.id && homeId ? (block.team.id === homeId ? "home" : "away") : null;
    if (!side) continue;
    for (const stat of block.statistics ?? []) {
      if (!stat.type) continue;
      rows.push({
        event_id: eventId,
        team_side: side,
        metric: stat.type,
        value: stat.value === null || stat.value === undefined ? null : String(stat.value),
      });
    }
  }
  if (!rows.length) return;
  await supabaseAdmin
    .from("sport_match_stats")
    .upsert(rows, { onConflict: "event_id,team_side,metric" });
}

/** Grava um jogo e devolve se algo mudou de facto. */
async function upsertFixture(
  sportId: string,
  fixture: ProviderFixture,
): Promise<{ changed: boolean; eventId: string | null; eventsInserted: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const competitionId = await ensureCompetition(sportId, fixture.league);
  if (!competitionId) return { changed: false, eventId: null, eventsInserted: 0 };
  await ensureTeams(fixture);

  const providerId = String(fixture.fixture.id);
  const short = fixture.fixture.status.short;
  const status = mapStatus(short);
  const elapsed = fixture.fixture.status.elapsed ?? null;
  const extra = fixture.fixture.status.extra ?? null;
  const homeScore = fixture.goals.home;
  const awayScore = fixture.goals.away;

  const { data: existing } = await supabaseAdmin
    .from("sport_events")
    .select("id, status, home_score, away_score, elapsed_minutes, settled_at")
    .eq("provider_event_id", providerId)
    .maybeSingle();

  // Jogos já liquidados não voltam atrás: o dinheiro é sagrado.
  const locked = Boolean(existing?.settled_at) || existing?.status === "settled" || existing?.status === "void";

  const payload = {
    competition_id: competitionId,
    provider_event_id: providerId,
    provider: "api-football",
    home_team: fixture.teams.home.name,
    away_team: fixture.teams.away.name,
    home_logo: fixture.teams.home.logo ?? null,
    away_logo: fixture.teams.away.logo ?? null,
    home_team_external_id: fixture.teams.home.id ? String(fixture.teams.home.id) : null,
    away_team_external_id: fixture.teams.away.id ? String(fixture.teams.away.id) : null,
    commence_at: new Date(fixture.fixture.date).toISOString(),
    provider_status: short,
    elapsed_minutes: elapsed,
    extra_minutes: extra,
    period: PERIOD_LABEL[short] ?? null,
    venue: fixture.fixture.venue?.name ?? null,
    round: fixture.league.round ?? null,
    home_score: homeScore,
    away_score: awayScore,
    live_updated_at: new Date().toISOString(),
    ...(locked ? {} : { status }),
  };

  const { data: saved, error } = await supabaseAdmin
    .from("sport_events")
    .upsert(payload, { onConflict: "provider_event_id" })
    .select("id")
    .single();
  if (error || !saved) return { changed: false, eventId: null, eventsInserted: 0 };

  const eventId = saved.id as string;
  const changed =
    !existing ||
    existing.status !== status ||
    existing.home_score !== homeScore ||
    existing.away_score !== awayScore ||
    existing.elapsed_minutes !== elapsed;

  const eventsInserted = await saveMatchEvents(eventId, fixture);
  await saveMatchStats(eventId, fixture);

  if (changed || eventsInserted) {
    await supabaseAdmin.from("sport_live_updates").insert({
      event_id: eventId,
      kind: existing && existing.status !== status ? "status" : eventsInserted ? "event" : "score",
      payload: {
        status,
        home_score: homeScore,
        away_score: awayScore,
        elapsed,
        extra,
        period: PERIOD_LABEL[short] ?? null,
      },
    });
  }

  return { changed, eventId, eventsInserted };
}

// ------------------------------------------------------------------- live sync

let inFlight: Promise<SyncResult> | null = null;

/** Sincroniza todos os jogos a decorrer. Uma execução por vez, por instância. */
export async function syncLiveMatches(force = false): Promise<SyncResult> {
  if (inFlight) return inFlight;
  inFlight = (async (): Promise<SyncResult> => {
    const startedAt = Date.now();
    const result: SyncResult = {
      ok: true,
      requests: 0,
      matches: 0,
      changed: 0,
      eventsInserted: 0,
      errors: [],
    };

    if (!providerConfigured()) {
      result.ok = false;
      result.errors.push("API_FOOTBALL_KEY não configurado");
      return result;
    }

    const config = await readConfig();
    if (!config) {
      result.ok = false;
      result.errors.push("configuração do fornecedor ausente");
      return result;
    }
    if (!config.active) {
      result.ok = false;
      result.errors.push("sincronização desativada pelo administrador");
      return result;
    }

    if (!force && config.lastLiveSyncAt) {
      const age = Date.now() - new Date(config.lastLiveSyncAt).getTime();
      if (age < config.liveIntervalSeconds * 1000) {
        return result; // ainda dentro do intervalo: nada a fazer
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let fixtures: ProviderFixture[] = [];
    try {
      fixtures = await fetchLiveFixtures();
      result.requests += 1;
    } catch (error) {
      result.ok = false;
      const message =
        error instanceof BudgetError
          ? "Orçamento diário de pedidos esgotado."
          : (error as Error).message.slice(0, 300);
      result.errors.push(message);
      await markError(message);
      await logSync("live", result, Date.now() - startedAt);
      return result;
    }

    const sportId = await ensureFootballSport();
    if (!sportId) {
      result.ok = false;
      result.errors.push("desporto base indisponível");
      return result;
    }

    const seen = new Set<string>();
    for (const fixture of fixtures) {
      try {
        const outcome = await upsertFixture(sportId, fixture);
        result.matches += 1;
        if (outcome.changed) result.changed += 1;
        result.eventsInserted += outcome.eventsInserted;
        seen.add(String(fixture.fixture.id));
      } catch (error) {
        result.errors.push(`jogo ${fixture.fixture.id}: ${(error as Error).message}`.slice(0, 200));
      }
    }

    // Jogos que deixaram de constar no direto e já passaram muito da hora:
    // encerram em "terminado" com o último resultado confirmado pelo fornecedor.
    const cutoff = new Date(Date.now() - 3 * 3_600_000).toISOString();
    const { data: stale } = await supabaseAdmin
      .from("sport_events")
      .select("id, provider_event_id")
      .in("status", ["live", "halftime"])
      .lt("commence_at", cutoff);
    for (const row of stale ?? []) {
      if (seen.has(String(row.provider_event_id))) continue;
      await supabaseAdmin
        .from("sport_events")
        .update({ status: "finished", period: "Final" })
        .eq("id", row.id);
      await supabaseAdmin
        .from("sport_live_updates")
        .insert({ event_id: row.id, kind: "status", payload: { status: "finished" } });
    }

    await supabaseAdmin
      .from("sports_provider_config")
      .update({ last_live_sync_at: new Date().toISOString() })
      .eq("id", config.id);
    if (result.ok) await markError(null);
    await logSync("live", result, Date.now() - startedAt);
    return result;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * Detalhe completo de um jogo (acontecimentos, estatísticas, escalações).
 * Só gasta um pedido quando o jogo está a decorrer e a informação está velha.
 */
export async function enrichMatch(eventId: string): Promise<{ ok: boolean; error?: string }> {
  if (!providerConfigured()) return { ok: false, error: "não configurado" };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("sport_events")
    .select("id, provider_event_id, status, live_updated_at, competition_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!row) return { ok: false, error: "jogo não encontrado" };

  const live = row.status === "live" || row.status === "halftime";
  const age = row.live_updated_at ? Date.now() - new Date(row.live_updated_at).getTime() : Infinity;
  if (!live && age < 3_600_000) return { ok: true };
  if (live && age < 60_000) return { ok: true };

  try {
    const fixture = await fetchFixtureById(String(row.provider_event_id));
    if (!fixture) return { ok: false, error: "sem resposta do fornecedor" };
    const sportId = await ensureFootballSport();
    if (!sportId) return { ok: false, error: "desporto base indisponível" };
    await upsertFixture(sportId, fixture);
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof BudgetError
        ? "Orçamento diário de pedidos esgotado."
        : (error as Error).message.slice(0, 200);
    return { ok: false, error: message };
  }
}
