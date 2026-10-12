import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  CreditCard,
  LayoutDashboard,
  Loader2,
  Lock,
  Receipt,
  Smartphone,
  Webhook,
} from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NETSHOP_METHODS, type NetshopMethod, type PaymentDirection } from "@/lib/payments/netshop";
import {
  createDepositIntent,
  getPaymentsStatus,
  requestWithdrawal,
  syncPaymentIntent,
} from "@/lib/payments/netshop.functions";
import logoCard from "@/assets/logo-card.png.asset.json";
import logoMpesa from "@/assets/logo-mpesa.png.asset.json";
import logoEmola from "@/assets/logo-emola.png.asset.json";
import logoMkesh from "@/assets/logo-mkesh.png.asset.json";

const TITLE = "Pagamentos Netshop — Betfcom SQs";
const DESCRIPTION =
  "Depósitos e levantamentos em MZN via Netshop: M-Pesa, e-Mola, mKesh, cartão Visa/Mastercard e transferência bancária, com validação no servidor e ledger imutável.";

export const Route = createFileRoute("/pagamentos")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://betfcom.com/pagamentos" },
      { property: "og:image", content: "https://betfcom.com/og-image.jpg" },
      { name: "twitter:image", content: "https://betfcom.com/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://betfcom.com/pagamentos" }],
  }),
  component: PagamentosPage,
});

const kindIcon = {
  mobile_money: Smartphone,
  card: CreditCard,
} as const;

/** Logos oficiais dos métodos (recortes das marcas enviadas pelo utilizador). */
const methodLogo: Partial<Record<NetshopMethod["id"], string>> = {
  mpesa: logoMpesa.url,
  emola: logoEmola.url,
  mkesh: logoMkesh.url,
  card: logoCard.url,
};

const ERROR_LABEL: Record<string, string> = {
  not_configured: "Este método não está ativo na conta do gateway.",
  no_wallet: "Carteira de apostas indisponível.",
  insufficient_funds: "Saldo insuficiente na Betting Wallet.",
  identifier_required: "Indica o número/identificador do pagador.",
  invalid_identifier: "Identificador inválido para o método escolhido.",
  method_unavailable: "Este método não permite levantamentos (payout B2C só M-Pesa e e-Mola).",
  amount_below_minimum: "Valor abaixo do mínimo do método escolhido.",
  failed: "O gateway recusou a operação. Tenta novamente.",
};

/** Traduz as razões devolvidas pelo gateway para linguagem do utilizador. */
function providerReason(message?: string | null): string | null {
  if (!message) return null;
  const raw = message.toLowerCase();
  if (raw.includes("timeout_no_callback")) {
    return "Não houve confirmação no telemóvel dentro do tempo limite. Repete e aprova o pedido com o teu PIN.";
  }
  if (raw.includes("method_disabled") || raw.includes("indisponível")) {
    return "O método está desativado no gateway. Usa outro método por agora.";
  }
  if (raw.includes("insufficient")) return "Saldo insuficiente na carteira móvel.";
  return message;
}


function TransactionForm({
  direction,
  enabled,
}: {
  direction: PaymentDirection;
  enabled: Partial<Record<NetshopMethod["id"], boolean>>;
}) {
  const isDeposit = direction === "deposit";
  const methods = NETSHOP_METHODS.filter((m) => m.directions.includes(direction));
  const [method, setMethod] = useState(
    methods.find((m) => enabled[m.id])?.id ?? methods[0]?.id ?? "mpesa",
  );
  const [amount, setAmount] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  const callDeposit = useServerFn(createDepositIntent);
  const callWithdrawal = useServerFn(requestWithdrawal);
  const callSync = useServerFn(syncPaymentIntent);

  const selected = methods.find((m) => m.id === method) ?? methods[0];
  const needsIdentifier = selected?.kind !== "card";
  // Cada método tem a sua wallet NetShop: só está ativo o que tem wallet no servidor.
  const configured = Boolean(selected && enabled[selected.id]);

  /** Reconciliação: a NetShop é a fonte de verdade do estado. */
  function watchIntent(ref: string) {
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts += 1;
      try {
        const res = await callSync({ data: { reference: ref } });
        if (res.status === "succeeded") {
          clearInterval(timer);
          toast.success(
            isDeposit
              ? "Depósito confirmado — saldo atualizado no ledger."
              : "Levantamento concluído pelo provedor.",
          );
        } else if (res.status === "failed") {
          clearInterval(timer);
          toast.error(
            providerReason(res.message) ?? "A operação foi recusada pelo provedor.",
          );
        }
      } catch {
        /* silencioso: nova tentativa no próximo ciclo */
      }
      // O gateway pode levar vários minutos a fechar uma cobrança sem
      // confirmação (mKesh chega a ~6 min): acompanhar até 12 minutos.
      if (attempts >= 120) clearInterval(timer);

    }, 6000);
  }

  async function submit() {
    const value = Number(amount.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Indica um valor válido em MZN.");
      return;
    }
    if (isDeposit && selected && value < selected.minDeposit) {
      toast.error(`O mínimo em ${selected.name} é ${selected.minDeposit} MZN.`);
      return;
    }
    setBusy(true);
    try {
      const payload = {
        method: method as "mpesa" | "emola" | "mkesh" | "card",
        amount: value,
        ...(identifier ? { payerIdentifier: identifier.trim() } : {}),
        ...(isDeposit ? { returnUrl: `${window.location.origin}/pagamentos` } : {}),
      };
      const result = isDeposit
        ? await callDeposit({ data: payload })
        : await callWithdrawal({ data: payload });

      if (!result.ok) {
        const base = ERROR_LABEL[result.error] ?? "Operação recusada.";
        const reason = providerReason(result.message);
        toast.error(reason ? `${base} ${reason}` : base);

        return;
      }

      setReference(result.reference);
      if (result.checkoutUrl) {
        toast.success("Checkout criado — a redirecionar para o gateway…");
        window.location.assign(result.checkoutUrl);
        return;
      }
      if (result.status === "paid") {
        toast.success(
          isDeposit
            ? "Depósito confirmado — saldo atualizado no ledger."
            : "Levantamento concluído pelo provedor.",
        );
        return;
      }
      toast.success(
        isDeposit
          ? "Cobrança enviada. Confirma no telemóvel com o teu PIN."
          : "Levantamento em processamento. O valor fica reservado até confirmação.",
      );
      watchIntent(result.reference);
    } catch (err) {
      if (err instanceof Error && err.message.includes("Unauthorized")) {
        toast.error("Precisas de iniciar sessão para movimentar a carteira.");
      } else {
        toast.error("Falha de comunicação com o servidor.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-6">
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-lg">
            {isDeposit ? "Novo depósito" : "Novo levantamento"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor={`${direction}-wallet`}>Carteira</Label>
            <select
              id={`${direction}-wallet`}
              disabled
              className="h-10 w-full min-w-0 truncate rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option>Betting Wallet (MZN)</option>
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${direction}-method`}>Método Netshop</Label>
            <select
              id={`${direction}-method`}
              value={method}
              onChange={(e) => setMethod(e.target.value as typeof method)}
              disabled={busy}
              className="h-10 w-full min-w-0 truncate rounded-lg border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {methods.map((m) => (
                <option key={m.id} value={m.id} disabled={!enabled[m.id]}>
                  {m.name} — {m.provider}
                  {enabled[m.id] ? "" : " (indisponível de momento)"}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`${direction}-amount`}>Valor (MZN)</Label>
              <Input
                id={`${direction}-amount`}
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={!configured || busy}
              />
              {isDeposit && selected ? (
                <p className="text-xs text-muted-foreground">Mín. {selected.minDeposit} MZN</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${direction}-identifier`}>
                {needsIdentifier ? "Número / identificador" : "Identificador (opcional)"}
              </Label>
              <Input
                id={`${direction}-identifier`}
                placeholder={selected?.identifierHint ?? "84xxxxxxx"}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={!configured || busy}
              />
            </div>
          </div>

          <Button
            className="w-full"
            disabled={!configured || busy}
            onClick={() => void submit()}
          >
            {busy ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Lock className="mr-2 size-4" />
            )}
            {isDeposit ? "Depositar" : "Solicitar levantamento"}
          </Button>

          {reference && (
            <p className="flex items-start gap-2 rounded-lg bg-primary/5 p-3 text-xs text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                Referência <code className="rounded bg-secondary px-1 py-0.5">{reference}</code> —
                o saldo só muda quando o webhook da Netshop confirmar a operação.
              </span>
            </p>
          )}

          {!configured && (
            <p className="text-xs text-muted-foreground">
              A wallet NetShop de {selected?.name ?? "este método"} ainda não está configurada no
              servidor, por isso a operação está bloqueada.{" "}
              <Link to="/auth" className="font-medium text-primary underline-offset-4 hover:underline">
                Inicia sessão
              </Link>{" "}
              para movimentar a carteira quando estiver ativa.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PagamentosPage() {
  const fetchStatus = useServerFn(getPaymentsStatus);
  const { data: status } = useQuery({
    queryKey: ["payments-status"],
    queryFn: () => fetchStatus(),
    staleTime: 60_000,
  });
  const methodStatus: Partial<Record<NetshopMethod["id"], boolean>> = status?.methods ?? {};

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-12">
        <header className="space-y-2">
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Pagamentos
          </h1>
          <p className="text-muted-foreground">Depósitos e levantamentos em meticais (MZN).</p>
        </header>

        <section className="mt-10 overflow-hidden rounded-3xl border border-border bg-bet-surface p-6 sm:p-8">
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-background px-4 py-2 text-sm font-medium">
              <Smartphone className="size-4 text-primary" />
              O cliente paga por telemóvel ou cartão
            </div>

            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
              {NETSHOP_METHODS.map((m) => {
                const active = Boolean(methodStatus[m.id]);
                const Icon = kindIcon[m.kind];
                const logo = methodLogo[m.id];
                return (
                  <div
                    key={m.id}
                    className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-background p-4"
                  >
                    {logo ? (
                      <img src={logo} alt={m.name} className="size-10 rounded-xl object-contain" />
                    ) : (
                      <div className="flex size-10 items-center justify-center rounded-xl bg-secondary">
                        <Icon className="size-5 text-primary" />
                      </div>
                    )}
                    <span className="text-sm font-medium">{m.name}</span>
                    <Badge variant={active ? "default" : "outline"}>
                      {active ? "Ativo" : "Não configurado"}
                    </Badge>
                  </div>
                );
              })}
            </div>

            <div className="h-6 w-px bg-border" aria-hidden="true" />

            <div className="card-elevated flex w-full max-w-md flex-col items-center gap-2 rounded-2xl border border-primary/30 bg-background p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" />
                <span className="font-heading text-lg font-semibold">NetShop</span>
                <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
              </div>
              <p className="text-sm text-muted-foreground">
                Confirma com a operadora · Checkout e API
              </p>
              <Badge variant="secondary" className="gap-1.5">
                <Receipt className="size-3.5" />
                Recibo para o cliente
              </Badge>
            </div>

            <div className="w-full max-w-3xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Na plataforma
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { icon: Webhook, title: "Sistema", text: "Webhook assinado" },
                  { icon: ArrowUpFromLine, title: "Payout", text: "Envio automático" },
                  { icon: LayoutDashboard, title: "Painel", text: "Extratos e reconciliação" },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-background p-4"
                  >
                    <item.icon className="size-5 text-primary" />
                    <span className="text-sm font-semibold">{item.title}</span>
                    <span className="text-xs text-muted-foreground">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <Tabs defaultValue="deposit">
            <TabsList>
              <TabsTrigger value="deposit" className="gap-1.5">
                <ArrowDownToLine className="size-4" />
                Depósito
              </TabsTrigger>
              <TabsTrigger value="withdrawal" className="gap-1.5">
                <ArrowUpFromLine className="size-4" />
                Levantamento
              </TabsTrigger>
            </TabsList>
            <TabsContent value="deposit" className="mt-6">
              <TransactionForm direction="deposit" enabled={methodStatus} />
            </TabsContent>
            <TabsContent value="withdrawal" className="mt-6">
              <TransactionForm direction="withdrawal" enabled={methodStatus} />
            </TabsContent>
          </Tabs>
        </section>

      </main>
      <SiteFooter />
    </>
  );
}
