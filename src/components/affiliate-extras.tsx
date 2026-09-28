import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const mzn = (n: number) => `${Number(n).toLocaleString("pt-PT", { minimumFractionDigits: 2 })} MZN`;
const dt = (s: string) => new Date(s).toLocaleString("pt-PT", { timeZone: "Africa/Maputo" });
const STATUS: Record<string, string> = {
  pending: "Em validação", approved: "Aprovada", rejected: "Rejeitada", reversed: "Estornada",
  available: "Disponível", requested: "Pedido", paid: "Pago",
};
const EVENT: Record<string, string> = {
  signup: "Cadastro", first_deposit: "1.º depósito", bet: "Aposta", investment: "Investimento",
};
const past = (s: string) => new Date(s).getTime() <= Date.now();
/** Estado mostrado: uma pendência cujo prazo de validação terminou já está disponível. */
const stateOf = (c: { status: string; available_at: string }) =>
  c.status === "pending" && past(c.available_at) ? "available" : c.status;

export function AffiliateExtras({ affiliateId, link }: { affiliateId: string; link: string }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const q = useQuery({
    queryKey: ["affiliate-extras", affiliateId],
    queryFn: async () => {
      const [bal, com, pay, ban, cfg] = await Promise.all([
        supabase.rpc("affiliate_available", { _affiliate_id: affiliateId }),
        supabase.from("affiliate_commissions").select("*").eq("affiliate_id", affiliateId).order("created_at", { ascending: false }).limit(100),
        supabase.from("affiliate_payouts").select("*").eq("affiliate_id", affiliateId).order("created_at", { ascending: false }).limit(100),
        supabase.from("affiliate_banners").select("*").eq("active", true).order("created_at", { ascending: false }),
        supabase.from("affiliate_config").select("*").eq("id", 1).maybeSingle(),
      ]);
      return { balance: Number(bal.data ?? 0), com: com.data ?? [], pay: pay.data ?? [], ban: ban.data ?? [], cfg: cfg.data };
    },
  });
  const d = q.data;
  if (!d) return null;
  const pending = d.com.filter((c) => c.status === "pending" && !past(c.available_at)).reduce((s, c) => s + Number(c.amount), 0);
  const conversions = new Set(d.com.filter((c) => c.status !== "rejected").map((c) => c.referral_id)).size;

  const request = async () => {
    const v = Number(amount.replace(",", "."));
    const { error } = await supabase.rpc("affiliate_request_payout", { _amount: v });
    if (error) { toast.error(error.message); return; }
    toast.success("Pedido de levantamento enviado");
    setAmount("");
    qc.invalidateQueries({ queryKey: ["affiliate-extras", affiliateId] });
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <Box label="Conversões" value={String(conversions)} />
        <Box label="Em validação" value={mzn(pending)} />
        <Box label="Disponível" value={mzn(d.balance)} accent />
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h2 className="font-display font-semibold">Pedir levantamento</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          O valor aprovado é pago na sua carteira de apostas Betfcom, de onde pode levantar pelos métodos habituais.
          {d.cfg && Number(d.cfg.min_payout) > 0 && ` Mínimo: ${mzn(Number(d.cfg.min_payout))}.`}
        </p>
        <div className="mt-3 flex gap-2">
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Valor em MZN"
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm" />
          <button disabled={!amount || d.balance <= 0} onClick={request}
            className="rounded-md bg-[hsl(0_75%_50%)] px-4 py-2 text-sm font-semibold text-[hsl(0_0%_100%)] disabled:opacity-50">
            Pedir
          </button>
        </div>
      </div>

      <List title="Comissões" empty="Ainda sem comissões.">
        {d.com.map((c) => (
          <Row key={c.id} left={`${EVENT[c.event] ?? c.event} · ${dt(c.created_at)}`}
            right={`${mzn(Number(c.amount))} · ${STATUS[stateOf(c)] ?? c.status}`} />
        ))}
      </List>

      <List title="Levantamentos" empty="Ainda sem levantamentos.">
        {d.pay.map((p) => (
          <Row key={p.id} left={`${dt(p.created_at)}${p.transaction_reference ? ` · Ref ${p.transaction_reference}` : ""}`}
            right={`${mzn(Number(p.amount))} · ${STATUS[p.status]}`} />
        ))}
      </List>

      <div className="rounded-xl border bg-card p-5">
        <h2 className="font-display font-semibold">Banners e materiais</h2>
        {d.ban.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Sem materiais publicados ainda.</p> : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {d.ban.map((b) => (
              <div key={b.id} className="rounded-lg border p-3">
                <img src={b.image_url} alt={b.title} className="w-full rounded" loading="lazy" />
                <p className="mt-2 text-sm font-medium">{b.title} {b.size && <span className="text-muted-foreground">· {b.size}</span>}</p>
                <button className="mt-2 text-xs text-[hsl(220_80%_60%)] underline"
                  onClick={() => { navigator.clipboard.writeText(`<a href="${link}"><img src="${b.image_url}" alt="Betfcom SQs"></a>`); toast.success("Código copiado"); }}>
                  Copiar código com o meu link
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Box({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "border-[hsl(0_75%_50%)] bg-[hsl(0_75%_50%)]/10" : "bg-card"}`}>
      <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-base font-bold">{value}</p>
    </div>
  );
}
function List({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="font-display font-semibold">{title}</h2>
      {children.length ? <ul className="mt-3 divide-y text-sm">{children}</ul> : <p className="mt-2 text-sm text-muted-foreground">{empty}</p>}
    </div>
  );
}
function Row({ left, right }: { left: string; right: string }) {
  return <li className="flex justify-between gap-3 py-2"><span className="text-muted-foreground">{left}</span><span className="text-right font-medium">{right}</span></li>;
}
