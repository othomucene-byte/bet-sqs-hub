/**
 * Cliente do fornecedor de jogos e cotações (API-Football / API-Sports) e
 * sincronização.
 *
 * Regras:
 *  - A chave `API_FOOTBALL_KEY` é lida apenas dentro das funções, no servidor.
 *  - Sem chave nada é inventado: a plataforma reporta "não configurado".
 *  - A app nunca lê o fornecedor diretamente: escrevemos na base de dados e a
 *    UI lê sempre a nossa base.
 */

const BASE = "https://v3.football.api-sports.io";

/** Ligas sincronizadas (id da API-Football → nome). */
const LEAGUES: Array<{ id: number; name: string; region: string }> = [
  { id: 39, name: "Premier League", region: "Inglaterra" },
  { id: 140, name: "La Liga", region: "Espanha" },
  { id: 135, name: "Serie A", region: "Itália" },
  { id: 2, name: "Liga dos Campeões", region: "UEFA" },
  { id: 94, name: "Primeira Liga", region: "Portugal" },
  { id: 78, name: "Bundesliga", region: "Alemanha" },
];

const FIXTURES_PER_LEAGUE = 8;

export function oddsApiKey(): string | null {
  const key = process.env["API_FOOTBALL_KEY"];
  return key && key.trim() ? key.trim() : null;
}

type ApiFixture = {
  fixture: {
    id: number;
    date: string;
    status: { short: string };
  };
  league: { id: number; name: string; season: number };
  teams: { home: { name: string }; away: { name: string } };
  goals: { home: number | null; away: number | null };
};

type ApiOddsBetValue = { value: string; odd: string };
type ApiOddsFixture = {
  fixture: { id: number };
  bookmakers?: Array<{
    bets?: Array<{ id: number; name: string; values?: ApiOddsBetValue[] }>;
  }>;
};

async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = oddsApiKey();
  if (!key) throw new Error("API_FOOTBALL_KEY ausente");
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: { accept: "application/json", "x-apisports-key": key },
  });
  const body = (await res.json().catch(() => null)) as {
    response?: T;
    errors?: Record<string, string> | string[];
  } | null;
  if (!res.ok) {
    throw new Error(`fornecedor respondeu ${res.status}`);
  }
  const errors = body?.errors;
  if (errors && (Array.isArray(errors) ? errors.length : Object.keys(errors).length)) {
    const first = Array.isArray(errors) ? errors[0] : Object.values(errors)[0];
    throw new Error(String(first).slice(0, 200));
  }
  return (body?.response ?? ([] as unknown)) as T;
}

function currentSeason(): number {
  const now = new Date();
  // época europeia começa em agosto
  return now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

function clampPrice(price: number): number | null {
  if (!Number.isFinite(price)) return null;
  const value = Math.round(price * 1000) / 1000;
  if (value < 1.01 || value > 1000) return null;
  return value;
}

function derivedDouble(a: number, b: number): number | null {
  return clampPrice(1 / (1 / a + 1 / b));
}

type OddRow = { market: string; selection: string; line: number | null; price: number };

function buildOdds(entry: ApiOddsFixture): OddRow[] {
  const rows: OddRow[] = [];
  const bookmakers = entry.bookmakers ?? [];
  const findBet = (id: number) => {
    for (const bm of bookmakers) {
      const bet = (bm.bets ?? []).find((b) => b.id === id);
      if (bet && (bet.values ?? []).length) return bet;
    }
    return null;
  };
  const priceOf = (bet: ReturnType<typeof findBet>, name: string) => {
    const v = bet?.values?.find((x) => x.value.toLowerCase() === name.toLowerCase());
    const price = v ? clampPrice(Number(v.odd)) : null;
    return price;
  };

  // Match Winner (1X2)
  const h2h = findBet(1);
  let priceHome: number | null = null;
  let priceDraw: number | null = null;
  let priceAway: number | null = null;
  if (h2h) {
    priceHome = priceOf(h2h, "Home");
    priceDraw = priceOf(h2h, "Draw");
    priceAway = priceOf(h2h, "Away");
    if (priceHome) rows.push({ market: "h2h", selection: "HOME", line: null, price: priceHome });
    if (priceDraw) rows.push({ market: "h2h", selection: "DRAW", line: null, price: priceDraw });
    if (priceAway) rows.push({ market: "h2h", selection: "AWAY", line: null, price: priceAway });
  }

  // Dupla chance (id 12) ou derivada do 1X2
  const dc = findBet(12);
  if (dc) {
    const p1x = priceOf(dc, "Home/Draw");
    const p12 = priceOf(dc, "Home/Away");
    const px2 = priceOf(dc, "Draw/Away");
    if (p1x) rows.push({ market: "dc", selection: "1X", line: null, price: p1x });
    if (p12) rows.push({ market: "dc", selection: "12", line: null, price: p12 });
    if (px2) rows.push({ market: "dc", selection: "X2", line: null, price: px2 });
  } else if (priceHome && priceDraw && priceAway) {
    const dc1x = derivedDouble(priceHome, priceDraw);
    const dcx2 = derivedDouble(priceDraw, priceAway);
    const dc12 = derivedDouble(priceHome, priceAway);
    if (dc1x) rows.push({ market: "dc", selection: "1X", line: null, price: dc1x });
    if (dcx2) rows.push({ market: "dc", selection: "X2", line: null, price: dcx2 });
    if (dc12) rows.push({ market: "dc", selection: "12", line: null, price: dc12 });
  }

  // Mais/Menos golos (id 5)
  const totals = findBet(5);
  const seen = new Set<string>();
  for (const v of totals?.values ?? []) {
    const match = /^(Over|Under)\s+([\d.]+)$/i.exec(v.value.trim());
    if (!match) continue;
    const price = clampPrice(Number(v.odd));
    if (price === null) continue;
    const selection = match[1]!.toUpperCase();
    const line = Math.round(Number(match[2]) * 100) / 100;
    const dedupe = `${selection}:${line}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    rows.push({ market: "totals", selection, line, price });
  }

  // Ambas marcam (id 8)
  const btts = findBet(8);
  const pYes = priceOf(btts, "Yes");
  const pNo = priceOf(btts, "No");
  if (pYes) rows.push({ market: "btts", selection: "YES", line: null, price: pYes });
  if (pNo) rows.push({ market: "btts", selection: "NO", line: null, price: pNo });

  return rows;
}

const FINISHED = new Set(["FT", "AET", "PEN"]);
const ABANDONED = new Set(["PST", "CANC", "ABD", "AWD", "WO"]);

/** Sincroniza ligas, jogos e cotações. Devolve contagens reais. */
export async function syncSportsCatalog(): Promise<{
  competitions: number;
  events: number;
  odds: number;
  errors: string[];
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const errors: string[] = [];
  const season = currentSeason();

  const { data: sportRow, error: sportError } = await supabaseAdmin
    .from("sports")
    .upsert({ key: "futebol", name: "Futebol", grouping: "Futebol", active: true }, { onConflict: "key" })
    .select("id")
    .single();
  if (sportError || !sportRow) {
    return { competitions: 0, events: 0, odds: 0, errors: [`desporto: ${sportError?.message ?? "falhou"}`] };
  }

  let eventCount = 0;
  let oddsCount = 0;
  let compCount = 0;

  for (const league of LEAGUES) {
    const { data: compRow, error: compError } = await supabaseAdmin
      .from("sport_competitions")
      .upsert(
        {
          sport_id: sportRow.id,
          key: `af_${league.id}`,
          name: league.name,
          region: league.region,
          active: true,
        },
        { onConflict: "key" },
      )
      .select("id")
      .single();
    if (compError || !compRow) {
      errors.push(`competição ${league.name}: ${compError?.message ?? "falhou"}`);
      continue;
    }
    compCount += 1;

    let fixtures: ApiFixture[] = [];
    try {
      fixtures = await call<ApiFixture[]>("/fixtures", {
        league: String(league.id),
        season: String(season),
        next: String(FIXTURES_PER_LEAGUE),
      });
    } catch (error) {
      errors.push(`jogos ${league.name}: ${(error as Error).message}`);
      continue;
    }

    for (const fixture of fixtures) {
      const home = fixture.teams?.home?.name;
      const away = fixture.teams?.away?.name;
      if (!home || !away) continue;
      const commence = new Date(fixture.fixture.date);
      if (Number.isNaN(commence.getTime())) continue;

      const { data: eventRow, error: eventError } = await supabaseAdmin
        .from("sport_events")
        .upsert(
          {
            competition_id: compRow.id,
            provider_event_id: String(fixture.fixture.id),
            home_team: home,
            away_team: away,
            commence_at: commence.toISOString(),
            status: commence.getTime() <= Date.now() ? "live" : "scheduled",
            odds_updated_at: new Date().toISOString(),
          },
          { onConflict: "provider_event_id" },
        )
        .select("id, status")
        .single();
      if (eventError || !eventRow) {
        errors.push(`jogo ${fixture.fixture.id}: ${eventError?.message ?? "falhou"}`);
        continue;
      }
      eventCount += 1;

      // Cotações por jogo (o plano gratuito pode não incluir odds — nesse caso
      // o jogo fica visível sem botões de aposta, nunca com cotações inventadas)
      let oddsEntries: ApiOddsFixture[] = [];
      try {
        oddsEntries = await call<ApiOddsFixture[]>("/odds", {
          fixture: String(fixture.fixture.id),
        });
      } catch (error) {
        errors.push(`cotações ${fixture.fixture.id}: ${(error as Error).message}`);
        continue;
      }

      const rows = buildOdds(oddsEntries[0] ?? { fixture: { id: 0 } });
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
      if (oddsError) errors.push(`cotações do jogo ${fixture.fixture.id}: ${oddsError.message}`);
      else oddsCount += rows.length;
    }
  }

  return { competitions: compCount, events: eventCount, odds: oddsCount, errors };
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

  const { data: pending } = await supabaseAdmin
    .from("sport_events")
    .select("id, provider_event_id, home_team, away_team, commence_at")
    .in("status", ["scheduled", "live", "closed"])
    .lt("commence_at", new Date().toISOString());

  for (const event of pending ?? []) {
    const startedAgoHours =
      (Date.now() - new Date(event.commence_at as string).getTime()) / 3_600_000;

    let fixtures: ApiFixture[] = [];
    try {
      fixtures = await call<ApiFixture[]>("/fixtures", { id: event.provider_event_id });
    } catch (error) {
      errors.push(`resultado ${event.provider_event_id}: ${(error as Error).message}`);
      continue;
    }
    const fixture = fixtures[0];

    if (!fixture) {
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

    const short = fixture.fixture.status.short;

    if (ABANDONED.has(short)) {
      const { data, error } = await supabaseAdmin.rpc("void_sport_event", {
        _event_id: event.id,
      });
      if (error) errors.push(`anular ${event.provider_event_id}: ${error.message}`);
      else {
        voided += 1;
        slips += Number(data ?? 0);
      }
      continue;
    }

    if (!FINISHED.has(short)) {
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

    const homeScore = fixture.goals.home;
    const awayScore = fixture.goals.away;
    if (homeScore === null || awayScore === null || homeScore === undefined || awayScore === undefined) {
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

  return { settled, voided, slips, errors };
}
