/**
 * Cliente do fornecedor de cotações (The Odds API) e sincronização.
 *
 * Regras:
 *  - A chave `ODDS_API_KEY` é lida apenas dentro das funções, no servidor.
 *  - Sem chave nada é inventado: a plataforma reporta "não configurado".
 *  - A app nunca lê o fornecedor diretamente: escrevemos na base de dados e a
 *    UI lê sempre a nossa base.
 */

const BASE = "https://api.the-odds-api.com/v4";

/** Grupos aceites do fornecedor e nome em português. */
const GROUPS: Record<string, string> = {
  Soccer: "Futebol",
  Basketball: "Basquetebol",
  "Tennis (ATP)": "Ténis",
  "Tennis (WTA)": "Ténis",
  Tennis: "Ténis",
};

/** Competições preferidas — sincronizadas primeiro para poupar quota. */
const PREFERRED = [
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_italy_serie_a",
  "soccer_uefa_champs_league",
  "soccer_portugal_primeira_liga",
  "basketball_nba",
];

const MAX_COMPETITIONS = 8;

export function oddsApiKey(): string | null {
  const key = process.env["ODDS_API_KEY"];
  return key && key.trim() ? key.trim() : null;
}

type ProviderSport = {
  key: string;
  group: string;
  title: string;
  description?: string;
  active: boolean;
  has_outrights: boolean;
};

type ProviderOutcome = { name: string; price: number; point?: number };
type ProviderEvent = {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team?: string;
  away_team?: string;
  bookmakers?: Array<{
    key: string;
    markets?: Array<{ key: string; outcomes?: ProviderOutcome[] }>;
  }>;
};

type ProviderScore = {
  id: string;
  completed: boolean;
  home_team?: string;
  away_team?: string;
  scores?: Array<{ name: string; score: string }> | null;
};

async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = oddsApiKey();
  if (!key) throw new Error("ODDS_API_KEY ausente");
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("apiKey", key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), { headers: { accept: "application/json" } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`fornecedor de cotações respondeu ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

function clampPrice(price: number): number | null {
  if (!Number.isFinite(price)) return null;
  const value = Math.round(price * 1000) / 1000;
  if (value < 1.01 || value > 1000) return null;
  return value;
}

function derivedDouble(a: number, b: number): number | null {
  const price = 1 / (1 / a + 1 / b);
  // margem já existente nas cotações do fornecedor; sem margem adicional
  return clampPrice(price);
}

type OddRow = { market: string; selection: string; line: number | null; price: number };

function buildOdds(event: ProviderEvent): OddRow[] {
  const home = event.home_team ?? "";
  const away = event.away_team ?? "";
  const rows: OddRow[] = [];

  const bookmakers = event.bookmakers ?? [];
  const findMarket = (key: string) => {
    for (const bm of bookmakers) {
      const market = (bm.markets ?? []).find((m) => m.key === key);
      if (market && (market.outcomes ?? []).length) return market;
    }
    return null;
  };

  const h2h = findMarket("h2h");
  let priceHome: number | null = null;
  let priceDraw: number | null = null;
  let priceAway: number | null = null;

  for (const outcome of h2h?.outcomes ?? []) {
    const price = clampPrice(outcome.price);
    if (price === null) continue;
    if (outcome.name === home) {
      priceHome = price;
      rows.push({ market: "h2h", selection: "HOME", line: null, price });
    } else if (outcome.name === away) {
      priceAway = price;
      rows.push({ market: "h2h", selection: "AWAY", line: null, price });
    } else if (outcome.name.toLowerCase() === "draw") {
      priceDraw = price;
      rows.push({ market: "h2h", selection: "DRAW", line: null, price });
    }
  }

  // Dupla chance derivada das probabilidades implícitas do 1X2 do fornecedor.
  if (priceHome && priceDraw && priceAway) {
    const dc1x = derivedDouble(priceHome, priceDraw);
    const dcx2 = derivedDouble(priceDraw, priceAway);
    const dc12 = derivedDouble(priceHome, priceAway);
    if (dc1x) rows.push({ market: "dc", selection: "1X", line: null, price: dc1x });
    if (dcx2) rows.push({ market: "dc", selection: "X2", line: null, price: dcx2 });
    if (dc12) rows.push({ market: "dc", selection: "12", line: null, price: dc12 });
  }

  const totals = findMarket("totals");
  const seen = new Set<string>();
  for (const outcome of totals?.outcomes ?? []) {
    const price = clampPrice(outcome.price);
    const line = typeof outcome.point === "number" ? Math.round(outcome.point * 100) / 100 : null;
    if (price === null || line === null) continue;
    const selection = outcome.name.toLowerCase() === "over" ? "OVER" : "UNDER";
    const dedupe = `${selection}:${line}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    rows.push({ market: "totals", selection, line, price });
  }

  const btts = findMarket("btts");
  for (const outcome of btts?.outcomes ?? []) {
    const price = clampPrice(outcome.price);
    if (price === null) continue;
    const selection = outcome.name.toLowerCase() === "yes" ? "YES" : "NO";
    rows.push({ market: "btts", selection, line: null, price });
  }

  return rows;
}

/** Sincroniza catálogo, jogos e cotações. Devolve contagens reais. */
export async function syncSportsCatalog(): Promise<{
  competitions: number;
  events: number;
  odds: number;
  errors: string[];
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const errors: string[] = [];

  const list = await call<ProviderSport[]>("/sports", { all: "false" });
  const eligible = list.filter((s) => s.active && !s.has_outrights && GROUPS[s.group]);
  eligible.sort((a, b) => {
    const ia = PREFERRED.indexOf(a.key);
    const ib = PREFERRED.indexOf(b.key);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const chosen = eligible.slice(0, MAX_COMPETITIONS);

  let eventCount = 0;
  let oddsCount = 0;

  for (const sport of chosen) {
    const sportName = GROUPS[sport.group]!;
    const sportKey = sportName.toLowerCase();

    const { data: sportRow, error: sportError } = await supabaseAdmin
      .from("sports")
      .upsert({ key: sportKey, name: sportName, grouping: sportName, active: true }, { onConflict: "key" })
      .select("id")
      .single();
    if (sportError || !sportRow) {
      errors.push(`desporto ${sportName}: ${sportError?.message ?? "falhou"}`);
      continue;
    }

    const { data: compRow, error: compError } = await supabaseAdmin
      .from("sport_competitions")
      .upsert(
        {
          sport_id: sportRow.id,
          key: sport.key,
          name: sport.title,
          region: sport.description ?? null,
          active: true,
        },
        { onConflict: "key" },
      )
      .select("id")
      .single();
    if (compError || !compRow) {
      errors.push(`competição ${sport.key}: ${compError?.message ?? "falhou"}`);
      continue;
    }

    let events: ProviderEvent[] = [];
    try {
      events = await call<ProviderEvent[]>(`/sports/${sport.key}/odds`, {
        regions: "eu",
        markets: "h2h,totals",
        oddsFormat: "decimal",
        dateFormat: "iso",
      });
    } catch (error) {
      errors.push(`cotações ${sport.key}: ${(error as Error).message}`);
      continue;
    }

    for (const event of events) {
      if (!event.home_team || !event.away_team) continue;
      const commence = new Date(event.commence_time);
      if (Number.isNaN(commence.getTime())) continue;

      const { data: eventRow, error: eventError } = await supabaseAdmin
        .from("sport_events")
        .upsert(
          {
            competition_id: compRow.id,
            provider_event_id: event.id,
            home_team: event.home_team,
            away_team: event.away_team,
            commence_at: commence.toISOString(),
            status: commence.getTime() <= Date.now() ? "live" : "scheduled",
            odds_updated_at: new Date().toISOString(),
          },
          { onConflict: "provider_event_id" },
        )
        .select("id, status")
        .single();
      if (eventError || !eventRow) {
        errors.push(`jogo ${event.id}: ${eventError?.message ?? "falhou"}`);
        continue;
      }
      eventCount += 1;

      const rows = buildOdds(event);
      await supabaseAdmin.from("sport_odds").delete().eq("event_id", eventRow.id);
      if (!rows.length) continue;

      const { error: oddsError } = await supabaseAdmin.from("sport_odds").insert(
        rows.map((row) => ({
          event_id: eventRow.id,
          market: row.market,
          selection: row.selection,
          line: row.line,
          price: row.price,
          active: true,
        })),
      );
      if (oddsError) errors.push(`cotações do jogo ${event.id}: ${oddsError.message}`);
      else oddsCount += rows.length;
    }
  }

  return { competitions: chosen.length, events: eventCount, odds: oddsCount, errors };
}

/** Busca resultados finais e liquida jogos e bilhetes no servidor. */
export async function syncSportsResults(): Promise<{
  settled: number;
  voided: number;
  slips: number;
  errors: string[];
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const errors: string[] = [];
  let settled = 0;
  let voided = 0;
  let slips = 0;

  const { data: competitions } = await supabaseAdmin
    .from("sport_competitions")
    .select("id, key")
    .eq("active", true);

  for (const competition of competitions ?? []) {
    const { data: pending } = await supabaseAdmin
      .from("sport_events")
      .select("id, provider_event_id, home_team, away_team, commence_at")
      .eq("competition_id", competition.id)
      .in("status", ["scheduled", "live", "closed"])
      .lt("commence_at", new Date().toISOString());

    if (!pending?.length) continue;

    let scores: ProviderScore[] = [];
    try {
      scores = await call<ProviderScore[]>(`/sports/${competition.key}/scores`, {
        daysFrom: "3",
        dateFormat: "iso",
      });
    } catch (error) {
      errors.push(`resultados ${competition.key}: ${(error as Error).message}`);
      continue;
    }

    const byId = new Map(scores.map((score) => [score.id, score]));

    for (const event of pending) {
      const score = byId.get(event.provider_event_id);
      const startedAgoHours =
        (Date.now() - new Date(event.commence_at as string).getTime()) / 3_600_000;

      if (!score || !score.completed) {
        // Jogos muito antigos sem resultado do fornecedor são anulados (devolução).
        if (startedAgoHours > 48) {
          const { data, error } = await supabaseAdmin.rpc("void_sport_event", {
            _event_id: event.id,
          });
          if (error) errors.push(`anular ${event.provider_event_id}: ${error.message}`);
          else {
            voided += 1;
            slips += Number(data ?? 0);
          }
        }
        continue;
      }

      const home = score.scores?.find((s) => s.name === event.home_team)?.score;
      const away = score.scores?.find((s) => s.name === event.away_team)?.score;
      const homeScore = home === undefined ? Number.NaN : Number(home);
      const awayScore = away === undefined ? Number.NaN : Number(away);

      if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
        errors.push(`resultado ilegível em ${event.provider_event_id}`);
        continue;
      }

      const { data, error } = await supabaseAdmin.rpc("settle_sport_event", {
        _event_id: event.id,
        _home: homeScore,
        _away: awayScore,
      });
      if (error) errors.push(`liquidar ${event.provider_event_id}: ${error.message}`);
      else {
        settled += 1;
        slips += Number(data ?? 0);
      }
    }
  }

  return { settled, voided, slips, errors };
}
