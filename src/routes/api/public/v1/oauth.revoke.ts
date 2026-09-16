import { createFileRoute } from "@tanstack/react-router";

/** POST /api/public/v1/oauth/revoke — revoga um token de acesso ou de renovação. */
export const Route = createFileRoute("/api/public/v1/oauth/revoke")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { apiOptions } = await import("@/lib/developer/api-auth.server");
        return apiOptions();
      },
      POST: async ({ request }) => {
        const { corsHeaders } = await import("@/lib/developer/api-auth.server");
        const headers = { ...corsHeaders(), "Cache-Control": "no-store" };
        let token: string | null = null;
        try {
          const contentType = request.headers.get("content-type") ?? "";
          if (contentType.includes("application/json")) {
            const body = (await request.json()) as { token?: string };
            token = body.token ?? null;
          } else {
            token = new URLSearchParams(await request.text()).get("token");
          }
        } catch {
          return Response.json({ error: "invalid_request" }, { status: 400, headers });
        }
        if (!token) return Response.json({ error: "invalid_request" }, { status: 400, headers });
        const { revokeToken } = await import("@/lib/developer/oauth.server");
        await revokeToken(token);
        return Response.json({ ok: true }, { headers });
      },
    },
  },
});
