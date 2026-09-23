/**
 * sportsWebSocket — transmissão em tempo real dos jogos por SSE.
 *
 * O fornecedor não oferece WebSocket, por isso o backend faz a sondagem
 * inteligente (uma chamada cobre todos os jogos) e difunde apenas as
 * alterações para todos os clientes ligados. Nenhum utilizador fala com o
 * fornecedor.
 */

import { createFileRoute } from "@tanstack/react-router";

const TICK_MS = 5_000;
const MAX_LIFETIME_MS = 240_000;

type Delta = {
  id: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  elapsed: number | null;
  period: string | null;
  homeTeam: string;
  awayTeam: string;
};

async function handle(): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { syncLiveMatches } = await import("@/lib/sports/live-sync.server");

      let closed = false;
      let cursor = 0;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const { data: last } = await supabaseAdmin
        .from("sport_live_updates")
        .select("id")
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();
      cursor = Number(last?.id ?? 0);

      send("ready", { cursor, at: new Date().toISOString() });

      const startedAt = Date.now();
      const tick = async () => {
        if (closed) return;
        // Sondagem inteligente: respeita o intervalo e o orçamento diário.
        syncLiveMatches().catch(() => null);

        const { data: updates } = await supabaseAdmin
          .from("sport_live_updates")
          .select("id, event_id")
          .gt("id", cursor)
          .order("id", { ascending: true })
          .limit(200);

        if (updates?.length) {
          cursor = Number(updates[updates.length - 1]!.id);
          const ids = [...new Set(updates.map((row) => row.event_id as string))];
          const { data: rows } = await supabaseAdmin
            .from("sport_events")
            .select(
              "id, status, home_team, away_team, home_score, away_score, elapsed_minutes, period",
            )
            .in("id", ids);
          const deltas: Delta[] = (rows ?? []).map((row) => ({
            id: row.id as string,
            status: row.status as string,
            homeScore: row.home_score === null ? null : Number(row.home_score),
            awayScore: row.away_score === null ? null : Number(row.away_score),
            elapsed: row.elapsed_minutes === null ? null : Number(row.elapsed_minutes),
            period: (row.period as string | null) ?? null,
            homeTeam: row.home_team as string,
            awayTeam: row.away_team as string,
          }));
          if (deltas.length) send("matches", { cursor, matches: deltas });
        } else {
          send("heartbeat", { cursor, at: new Date().toISOString() });
        }

        if (Date.now() - startedAt > MAX_LIFETIME_MS) {
          send("bye", { reason: "rotate" });
          closed = true;
          try {
            controller.close();
          } catch {
            /* já fechado */
          }
          return;
        }
        setTimeout(() => void tick(), TICK_MS);
      };

      setTimeout(() => void tick(), 1_000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export const Route = createFileRoute("/api/public/sports/stream")({
  server: { handlers: { GET: () => handle() } },
});
