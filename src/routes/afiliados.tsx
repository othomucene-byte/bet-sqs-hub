import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, MousePointerClick, UserPlus, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { AffiliateExtras } from "@/components/affiliate-extras";

export const Route = createFileRoute("/afiliados")({
  head: () => ({
    meta: [
      { title: "Programa de Afiliados — Betfcom SQs" },
      { name: "description", content: "Partilhe o seu link Betfcom SQs e acompanhe cliques e cadastros referidos." },
      { property: "og:title", content: "Programa de Afiliados — Betfcom SQs" },
      { property: "og:description", content: "Partilhe o seu link Betfcom SQs e acompanhe cliques e cadastros referidos." },
    ],
  }),
  component: AffiliatesPage,
});

async function loadMine() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { signedIn: false as const };
  const { data: aff } = await supabase.from("affiliates").select("*").eq("user_id", u.user.id).maybeSingle();
  if (!aff) return { signedIn: true as const, aff: null };
  const [clicks, refs] = await Promise.all([
    supabase.from("affiliate_clicks").select("id", { count: "exact", head: true }).eq("affiliate_id", aff.id),
    supabase.from("affiliate_referrals").select("id, created_at").eq("affiliate_id", aff.id).order("created_at", { ascending: false }).limit(50),
  ]);
  return { signedIn: true as const, aff, clicks: clicks.count ?? 0, refs: refs.data ?? [] };
}

function AffiliatesPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["affiliate-me"], queryFn: loadMine });
  const [busy, setBusy] = useState(false);
  const d = q.data;

  const join = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("affiliate_join");
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["affiliate-me"] });
  };

  const link = d && "aff" in d && d.aff ? `https://betfcom.com/?ref=${d.aff.code}` : "";

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="border-b-4 border-[hsl(0_75%_50%)] bg-[hsl(220_80%_30%)] px-4 py-12 text-[hsl(0_0%_100%)]">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-widest opacity-80">Betfcom SQs</p>
          <h1 className="mt-2 font-display text-3xl font-bold md:text-4xl">Programa de Afiliados</h1>
          <p className="mt-3 max-w-2xl opacity-90">
            Receba um link exclusivo, partilhe-o e acompanhe os cliques e os cadastros que traz. Só contam contas novas;
            autoindicações e duplicados são recusados automaticamente.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        {q.isLoading && <p className="text-muted-foreground">A carregar…</p>}

        {d && !d.signedIn && (
          <div className="rounded-xl border bg-card p-6">
            <p>Entre na sua conta para aderir ao programa.</p>
            <Link to="/auth" className="mt-4 inline-block rounded-md bg-[hsl(0_75%_50%)] px-5 py-2 font-semibold text-[hsl(0_0%_100%)]">
              Entrar / Criar conta
            </Link>
          </div>
        )}

        {d && d.signedIn && !d.aff && (
          <div className="rounded-xl border bg-card p-6">
            <h2 className="font-display text-lg font-semibold">Condições</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Um link por afiliado.</li>
              <li>Cadastro atribuído apenas a contas criadas nas 24h seguintes ao clique.</li>
              <li>Cliques não contam como conversões. Comissões conforme as regras em vigor, após validação.</li>
            </ul>
            <button disabled={busy} onClick={join} className="mt-5 rounded-md bg-[hsl(0_75%_50%)] px-5 py-2 font-semibold text-[hsl(0_0%_100%)] disabled:opacity-50">
              {busy ? "A inscrever…" : "Inscrever-me"}
            </button>
          </div>
        )}

        {d && d.signedIn && d.aff && (
          <>
            <div className="rounded-xl border border-[hsl(220_80%_45%)]/40 bg-card p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">O seu link</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input readOnly value={link} className="flex-1 rounded-md border bg-background px-3 py-2 text-sm" />
                <button onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado"); }}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-[hsl(220_80%_40%)] px-4 py-2 text-sm font-semibold text-[hsl(0_0%_100%)]">
                  <Copy className="size-4" /> Copiar
                </button>
                {typeof navigator !== "undefined" && "share" in navigator && (
                  <button onClick={() => navigator.share({ title: "Betfcom SQs", url: link }).catch(() => {})}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-[hsl(0_75%_50%)] px-4 py-2 text-sm font-semibold text-[hsl(0_0%_100%)]">
                    <Share2 className="size-4" /> Partilhar
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Stat icon={<MousePointerClick className="size-5" />} label="Cliques" value={d.clicks ?? 0} />
              <Stat icon={<UserPlus className="size-5" />} label="Cadastros" value={d.refs?.length ?? 0} />
            </div>
            <AffiliateExtras affiliateId={d.aff.id} link={link} />
            <div className="rounded-xl border bg-card p-5">
              <h2 className="font-display font-semibold">Cadastros recentes</h2>
              {d.refs?.length ? (
                <ul className="mt-3 divide-y text-sm">
                  {d.refs.map((r) => (
                    <li key={r.id} className="py-2 text-muted-foreground">
                      Novo cadastro · {new Date(r.created_at).toLocaleString("pt-PT", { timeZone: "Africa/Maputo" })}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Ainda sem cadastros.</p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-[hsl(0_75%_55%)]">{icon}<span className="text-xs uppercase text-muted-foreground">{label}</span></div>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}
