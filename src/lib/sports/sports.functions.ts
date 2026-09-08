import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

import { SLIP_LIMITS } from "./markets";

export type SportOdd = {
  market: string;
  selection: string;
  line: number | null;
  price: number;
};

export type SportEvent = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  commenceAt: string;
  homeLogo: string | null;
  awayLogo: string | null;
  competitionKey: string;
  competitionName: string;
  sportName: string;
  odds: SportOdd[];
};

export type SportsBoard = {
  configured: boolean;
  updatedAt: string | null;
  competitions: Array<{ key: string; name: string; sportName: string; events: number }>;
  events: SportEvent[];
};

/** Quadro público de desportos — lido da nossa base, nunca do fornecedor. */
export const getSportsBoard = createServerFn({ method: "GET" }).handler(
  async (): Promise<SportsBoard> => {
    const configured = Boolean(process.env["API_FOOTBALL_KEY"]?.trim());
    const { publicClient } = await import("@/lib/investments/public-client.server");
    const supabase = publicClient();

    const { data: rows } = await supabase
      .from("sport_events")
      .select(
        "id, home_team, away_team, home_logo, away_logo, commence_at, odds_updated_at, sport_competitions!inner(key, name, sports!inner(name))",
      )
      .eq("status", "scheduled")
      .gt("commence_at", new Date().toISOString())
      .order("commence_at", { ascending: true })
      .limit(120);

    const events: SportEvent[] = (rows ?? []).map((row) => {
      const competition = row.sport_competitions as unknown as {
        key: string;
        name: string;
        sports: { name: string } | { name: string }[];
      };
      const sport = Array.isArray(competition.sports) ? competition.sports[0] : competition.sports;
      return {
        id: row.id as string,
        homeTeam: row.home_team as string,
        awayTeam: row.away_team as string,
        commenceAt: row.commence_at as string,
        homeLogo: (row as { home_logo?: string | null }).home_logo ?? null,
        awayLogo: (row as { away_logo?: string | null }).away_logo ?? null,
        competitionKey: competition.key,
        competitionName: competition.name,
        sportName: sport?.name ?? "Desporto",
        odds: [],
      };
    });

    if (events.length) {
      const { data: odds } = await supabase
        .from("sport_odds")
        .select("event_id, market, selection, line, price")
        .eq("active", true)
        .in(
          "event_id",
          events.map((event) => event.id),
        );

      const byEvent = new Map<string, SportOdd[]>();
      for (const odd of odds ?? []) {
        const list = byEvent.get(odd.event_id as string) ?? [];
        list.push({
          market: odd.market as string,
          selection: odd.selection as string,
          line: odd.line === null ? null : Number(odd.line),
          price: Number(odd.price),
        });
        byEvent.set(odd.event_id as string, list);
      }
      for (const event of events) event.odds = byEvent.get(event.id) ?? [];
    }

    const withOdds = events.filter((event) => event.odds.length > 0);

    const competitions = new Map<string, { key: string; name: string; sportName: string; events: number }>();
    for (const event of withOdds) {
      const entry = competitions.get(event.competitionKey) ?? {
        key: event.competitionKey,
        name: event.competitionName,
        sportName: event.sportName,
        events: 0,
      };
      entry.events += 1;
      competitions.set(event.competitionKey, entry);
    }

    const { data: latest } = await supabase
      .from("sport_events")
      .select("odds_updated_at")
      .not("odds_updated_at", "is", null)
      .order("odds_updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      configured,
      updatedAt: (latest?.odds_updated_at as string | null) ?? null,
      competitions: [...competitions.values()].sort((a, b) => b.events - a.events),
      events: withOdds,
    };
  },
);

const selectionSchema = z.object({
  eventId: z.string().uuid(),
  market: z.enum(["h2h", "dc", "totals", "btts"]),
  selection: z.string().min(1).max(20),
  line: z.number().nullable().default(null),
  price: z.number().min(1.01).max(1000),
});

const slipInput = z.object({
  stake: z.number().min(SLIP_LIMITS.minStake).max(SLIP_LIMITS.maxStake),
  selections: z.array(selectionSchema).min(1).max(SLIP_LIMITS.maxSelections),
  idempotencyKey: z.string().uuid(),
  funding: z.enum(["wallet", "free_bet"]).default("wallet"),
  freeBetId: z.string().uuid().nullable().optional(),
});

/** Registo do bilhete. Cotação, estado do jogo e saldo são validados no servidor. */
export const placeBetSlip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => slipInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const args = {
      _user_id: context.userId,
      _stake: data.stake,
      _idempotency_key: data.idempotencyKey,
      _funding: data.funding,
      _free_bet_id: data.funding === "free_bet" ? (data.freeBetId ?? null) : null,
      _selections: data.selections.map((item) => ({
        event_id: item.eventId,
        market: item.market,
        selection: item.selection,
        line: item.line,
        price: item.price,
      })),
    };

    const { data: slip, error } = await supabaseAdmin.rpc(
      "place_bet_slip",
      args as unknown as {
        _user_id: string;
        _stake: number;
        _idempotency_key: string;
        _selections: never;
      },
    );


    if (error) return { ok: false as const, error: error.message };
    return {
      ok: true as const,
      reference: (slip as { reference: string } | null)?.reference ?? null,
    };
  });

export type BetSlipView = {
  id: string;
  reference: string;
  kind: "single" | "multiple";
  stake: number;
  totalOdds: number;
  potentialPayout: number;
  payout: number | null;
  status: "open" | "won" | "lost" | "void";
  createdAt: string;
  selections: Array<{
    market: string;
    selection: string;
    line: number | null;
    price: number;
    result: "pending" | "won" | "lost" | "void";
    homeTeam: string;
    awayTeam: string;
    commenceAt: string;
    homeScore: number | null;
    awayScore: number | null;
  }>;
};

/** Bilhetes do utilizador autenticado (RLS: só os próprios). */
export const getMyBetSlips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BetSlipView[]> => {
    const { data: slips } = await context.supabase
      .from("bet_slips")
      .select(
        "id, reference, kind, stake, total_odds, potential_payout, payout, status, created_at, bet_selections(market, selection, line, price, result, sport_events(home_team, away_team, commence_at, home_score, away_score))",
      )
      .order("created_at", { ascending: false })
      .limit(50);

    return (slips ?? []).map((slip) => ({
      id: slip.id as string,
      reference: slip.reference as string,
      kind: slip.kind as "single" | "multiple",
      stake: Number(slip.stake),
      totalOdds: Number(slip.total_odds),
      potentialPayout: Number(slip.potential_payout),
      payout: slip.payout === null ? null : Number(slip.payout),
      status: slip.status as "open" | "won" | "lost" | "void",
      createdAt: slip.created_at as string,
      selections: ((slip.bet_selections ?? []) as unknown[]).map((raw) => {
        const row = raw as {
          market: string;
          selection: string;
          line: number | null;
          price: number;
          result: string;
          sport_events:
            | {
                home_team: string;
                away_team: string;
                commence_at: string;
                home_score: number | null;
                away_score: number | null;
              }
            | null;
        };
        return {
          market: row.market,
          selection: row.selection,
          line: row.line === null ? null : Number(row.line),
          price: Number(row.price),
          result: row.result as "pending" | "won" | "lost" | "void",
          homeTeam: row.sport_events?.home_team ?? "—",
          awayTeam: row.sport_events?.away_team ?? "—",
          commenceAt: row.sport_events?.commence_at ?? "",
          homeScore: row.sport_events?.home_score ?? null,
          awayScore: row.sport_events?.away_score ?? null,
        };
      }),
    }));
  });

/** Sincronização manual — só administradores. */
export const syncSportsNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) return { ok: false as const, error: "Sem permissões de administração." };

    const { oddsApiKey, syncSportsCatalog, syncSportsResults } = await import("./odds.server");
    if (!oddsApiKey()) return { ok: false as const, error: "Desportos não configurado." };

    const catalog = await syncSportsCatalog();
    const results = await syncSportsResults();
    return { ok: true as const, catalog, results };
  });
