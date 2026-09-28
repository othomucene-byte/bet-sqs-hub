import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/_authenticated/admin_/afiliados")({
  head: () => ({
    meta: [
      { title: "Administração de Afiliados — Betfcom SQs" },
      { name: "description", content: "Gerir afiliados, comissões, levantamentos e banners." },
      { property: "og:title", content: "Administração de Afiliados — Betfcom SQs" },
      { property: "og:description", content: "Gerir afiliados, comissões, levantamentos e banners." },
    ],
  }),
  component: AdminAffiliates,
});

const mzn = (n: number) => `${Number(n).toLocaleString("pt-PT", { minimumFractionDigits: 2 })} MZN`;
const dt = (s: string) => new Date(s).toLocaleString("pt-PT", { timeZone: "Africa/Maputo" });
const btn = "rounded px-2 py-1 text-xs font-semibold";
const blue = `${btn} bg-[hsl(220_80%_40%)] text-[hsl(0_0%_100%)]`;
const red = `${btn} bg-[hsl(0_75%_50%)] text-[hsl(0_0%_100%)]`;

async function load() {
  const { data: u } = await supabase.auth.getUser();
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: u.user!.id, _role: "admin" });
  if (!isAdmin) return { isAdmin: false as const };
  const [cfg, affs, refs, clicks, com, pay, ban] = await Promise.all([
    supabase.from("affiliate_config").select("*").eq("id", 1).single(),
    supabase.from("affiliates").select("*").order("created_at", { ascending: false }),
    supabase.from("affiliate_referrals").select("id, affiliate_id, created_at"),
    supabase.from("affiliate_clicks").select("affiliate_id"),
    supabase.from("affiliate_commissions").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("affiliate_payouts").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("affiliate_banners").select("*").order("created_at", { ascending: false }),
  ]);
  return { isAdmin: true as const, cfg: cfg.data!, affs: affs.data ?? [], refs: refs.data ?? [], clicks: clicks.data ?? [], com: com.data ?? [], pay: pay.data ?? [], ban: ban.data ?? [] };
}

function AdminAffiliates() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-affiliates"], queryFn: load });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-affiliates"] });
  const run = async (p: PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    const { error } = await p;
    if (error) toast.error(error.message); else { toast.success(ok); refresh(); }
  };
  const d = q.data;
  const [cfg, setCfg] = useState<Record<string, unknown>>({});
  const [banner, setBanner] = useState({ title: "", url: "", size: "" });
  useEffect(() => { if (d?.isAdmin) setCfg(d.cfg); }, [d]);

  if (!d) return <div className="min-h-screen bg-background"><SiteHeader /><p className="p-6 text-muted-foreground">A carregar…</p></div>;
  if (!d.isAdmin) return <div className="min-h-screen bg-background"><SiteHeader /><p className="p-6">Acesso reservado a administradores.</p></div>;

  const codeOf = (id: string) => d.affs.find((a) => a.id === id)?.code ?? "—";
  const count = <T extends { affiliate_id: string }>(arr: T[], id: string) => arr.filter((x) => x.affiliate_id === id).length;
  // Sinal simples de fraude: muitos cadastros com poucos cliques.
  const suspicious = (id: string) => count(d.refs, id) >= 3 && count(d.refs, id) > count(d.clicks, id);

  const field = (k: string, label: string, type = "number") => (
    <label className="text-xs text-muted-foreground">{label}
      <input type={type} value={String(cfg[k] ?? "")} onChange={(e) => setCfg({ ...cfg, [k]: e.target.value })}
        className="mt-1 w-full rounded border bg-background px-2 py-1.5 text-sm text-foreground" />
    </label>
  );

  return (
    <div className="min-h-screen bg-background pb-16">
      <SiteHeader />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <h1 className="font-display text-2xl font-bold">Afiliados · Administração</h1>

        <section className="rounded-xl border-t-4 border-[hsl(220_80%_45%)] bg-card p-5">
          <h2 className="font-semibold">Regras de comissão</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(cfg.enabled)} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} /> Programa ativo</label>
            <label className="text-xs text-muted-foreground">Tipo
              <select value={String(cfg.commission_type ?? "percent")} onChange={(e) => setCfg({ ...cfg, commission_type: e.target.value })} className="mt-1 w-full rounded border bg-background px-2 py-1.5 text-sm text-foreground">
                <option value="percent">Percentagem</option><option value="fixed">Valor fixo (MZN)</option>
              </select>
            </label>
            {field("commission_value", cfg.commission_type === "fixed" ? "Valor por conversão (MZN)" : "Percentagem (%)")}
            <label className="text-xs text-muted-foreground">Evento
              <select value={String(cfg.trigger_event ?? "first_deposit")} onChange={(e) => setCfg({ ...cfg, trigger_event: e.target.value })} className="mt-1 w-full rounded border bg-background px-2 py-1.5 text-sm text-foreground">
                <option value="first_deposit">Primeiro depósito</option><option value="signup">Cadastro</option>
              </select>
            </label>
            {field("min_deposit", "Depósito mínimo (MZN)")}
            {field("attribution_hours", "Prazo do link (horas)")}
            {field("validation_days", "Validação (dias)")}
            {field("min_payout", "Levantamento mínimo (MZN)")}
          </div>
          <label className="mt-3 block text-xs text-muted-foreground">Regras de cancelamento e estorno
            <textarea value={String(cfg.reversal_rules ?? "")} onChange={(e) => setCfg({ ...cfg, reversal_rules: e.target.value })} rows={2} className="mt-1 w-full rounded border bg-background px-2 py-1.5 text-sm text-foreground" />
          </label>
          <button className={`${red} mt-3 px-4 py-2 text-sm`} onClick={() => run(supabase.rpc("affiliate_admin_config", { _cfg: cfg as never }), "Regras guardadas")}>Guardar regras</button>
        </section>

        <Table title="Afiliados" head={["Código", "Cliques", "Cadastros", "Estado", ""]}>
          {d.affs.map((a) => (
            <tr key={a.id} className="border-t">
              <td className="py-2 font-mono">{a.code} {suspicious(a.id) && <span className="ml-1 rounded bg-[hsl(0_75%_50%)]/20 px-1 text-[10px] text-[hsl(0_75%_60%)]">suspeito</span>}</td>
              <td>{count(d.clicks, a.id)}</td><td>{count(d.refs, a.id)}</td><td>{a.status === "active" ? "Ativo" : "Suspenso"}</td>
              <td className="text-right">
                <button className={a.status === "active" ? red : blue} onClick={() => run(supabase.rpc("affiliate_admin_status", { _id: a.id, _status: a.status === "active" ? "suspended" : "active" }), "Estado alterado")}>
                  {a.status === "active" ? "Suspender" : "Reativar"}
                </button>
              </td>
            </tr>
          ))}
        </Table>

        <Table title="Comissões" head={["Afiliado", "Evento", "Base", "Comissão", "Disponível em", "Estado", ""]}>
          {d.com.map((c) => (
            <tr key={c.id} className="border-t">
              <td className="py-2 font-mono">{codeOf(c.affiliate_id)}</td><td>{c.event === "signup" ? "Cadastro" : "1.º depósito"}</td>
              <td>{mzn(Number(c.base_amount))}</td><td>{mzn(Number(c.amount))}</td><td>{dt(c.available_at)}</td><td>{c.status}</td>
              <td className="space-x-1 text-right">
                {c.status === "pending" && <>
                  <button className={blue} onClick={() => run(supabase.rpc("affiliate_admin_commission", { _id: c.id, _status: "approved", _note: "" }), "Aprovada")}>Aprovar</button>
                  <button className={red} onClick={() => run(supabase.rpc("affiliate_admin_commission", { _id: c.id, _status: "rejected", _note: prompt("Motivo") ?? "" }), "Rejeitada")}>Rejeitar</button>
                </>}
                {c.status === "approved" && <button className={red} onClick={() => run(supabase.rpc("affiliate_admin_commission", { _id: c.id, _status: "reversed", _note: prompt("Motivo do estorno") ?? "" }), "Estornada")}>Estornar</button>}
              </td>
            </tr>
          ))}
        </Table>

        <Table title="Levantamentos" head={["Afiliado", "Valor", "Pedido", "Estado", "Referência", ""]}>
          {d.pay.map((p) => (
            <tr key={p.id} className="border-t">
              <td className="py-2 font-mono">{codeOf(p.affiliate_id)}</td><td>{mzn(Number(p.amount))}</td><td>{dt(p.created_at)}</td>
              <td>{p.status}</td><td className="font-mono text-xs">{p.transaction_reference ?? "—"}</td>
              <td className="space-x-1 text-right">
                {p.status === "requested" && <button className={blue} onClick={() => run(supabase.rpc("affiliate_admin_payout", { _id: p.id, _action: "approve", _note: "" }), "Aprovado")}>Aprovar</button>}
                {p.status === "approved" && <button className={blue} onClick={() => run(supabase.rpc("affiliate_admin_payout", { _id: p.id, _action: "pay", _note: "" }), "Pago na carteira")}>Pagar na carteira</button>}
                {(p.status === "requested" || p.status === "approved") && <button className={red} onClick={() => run(supabase.rpc("affiliate_admin_payout", { _id: p.id, _action: "reject", _note: prompt("Motivo") ?? "" }), "Rejeitado")}>Rejeitar</button>}
              </td>
            </tr>
          ))}
        </Table>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Banners</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-4">
            <input placeholder="Título" value={banner.title} onChange={(e) => setBanner({ ...banner, title: e.target.value })} className="rounded border bg-background px-2 py-1.5 text-sm" />
            <input placeholder="URL da imagem (https://…)" value={banner.url} onChange={(e) => setBanner({ ...banner, url: e.target.value })} className="rounded border bg-background px-2 py-1.5 text-sm md:col-span-2" />
            <input placeholder="Tamanho (ex. 728x90)" value={banner.size} onChange={(e) => setBanner({ ...banner, size: e.target.value })} className="rounded border bg-background px-2 py-1.5 text-sm" />
          </div>
          <button className={`${red} mt-3 px-4 py-2 text-sm`} disabled={!banner.title || !banner.url.startsWith("https://")}
            onClick={() => run(supabase.rpc("affiliate_admin_banner", { _title: banner.title, _image_url: banner.url, _size: banner.size, _id: null as never, _active: true }), "Banner adicionado").then(() => setBanner({ title: "", url: "", size: "" }))}>
            Adicionar banner
          </button>
          <ul className="mt-4 divide-y text-sm">
            {d.ban.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 py-2">
                <span>{b.title} {!b.active && <span className="text-muted-foreground">(oculto)</span>}</span>
                <button className={b.active ? red : blue} onClick={() => run(supabase.rpc("affiliate_admin_banner", { _title: b.title, _image_url: b.image_url, _size: b.size ?? "", _id: b.id, _active: !b.active }), "Atualizado")}>
                  {b.active ? "Ocultar" : "Mostrar"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

function Table({ title, head, children }: { title: string; head: string[]; children: React.ReactNode[] }) {
  return (
    <section className="overflow-x-auto rounded-xl border bg-card p-5">
      <h2 className="font-semibold">{title}</h2>
      {children.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nada por agora.</p> : (
        <table className="mt-3 w-full min-w-[560px] text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground"><tr>{head.map((h) => <th key={h} className="pb-2">{h}</th>)}</tr></thead>
          <tbody>{children}</tbody>
        </table>
      )}
    </section>
  );
}
