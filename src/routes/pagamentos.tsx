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
  Loader2,
  Lock,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const TITLE = "Pagamentos Netshop — BETFCOM SQs";
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
    ],
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

function MethodCard({ method, configured }: { method: NetshopMethod; configured: boolean }) {
  const Icon = kindIcon[method.kind];
  const logo = methodLogo[method.id];
  return (
    <Card className="card-elevated">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          {logo ? (
            <img
              src={logo}
              alt={`Logótipo ${method.name}`}
              width={40}
              height={40}
              className="size-10 rounded-xl object-contain"
            />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-xl bg-secondary">
              <Icon className="size-5 text-primary" />
            </div>
          )}
          <Badge variant={configured ? "default" : "outline"}>
            {configured ? "Ativo" : "Não configurado"}
          </Badge>
        </div>
        <CardTitle className="text-base">{method.name}</CardTitle>
        <CardDescription>
          {method.provider} · {method.currency}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>{method.notes}</p>
        <div className="flex flex-wrap gap-1.5">
          {method.directions.includes("deposit") && <Badge variant="secondary">Depósito</Badge>}
          {method.directions.includes("withdrawal") && (
            <Badge variant="secondary">Levantamento</Badge>
          )}
          <Badge variant="outline">mín. {method.minDeposit} MZN</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

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
          toast.error(res.message ?? "A operação foi recusada pelo provedor.");
        }
      } catch {
        /* silencioso: nova tentativa no próximo ciclo */
      }
      if (attempts >= 40) clearInterval(timer);
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
        toast.error(result.message ? `${base} (${result.message})` : base);
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
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-lg">
            {isDeposit ? "Novo depósito" : "Novo levantamento"}
          </CardTitle>
          <CardDescription>
            {isDeposit
              ? "O valor só entra na carteira depois de o gateway confirmar o pagamento por webhook."
              : "O valor fica reservado no ledger e só sai de vez após confirmação do payout."}
          </CardDescription>
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
            <p className="text-xs text-muted-foreground">
              As carteiras de apostas e de investimentos são contabilisticamente separadas.
            </p>
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
                  {enabled[m.id] ? "" : " (wallet não configurada)"}
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
              <p className="text-xs text-muted-foreground">
                Taxa para o cliente: 0 MZN
                {isDeposit && selected ? ` · mínimo ${selected.minDeposit} MZN` : ""}.
              </p>
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

      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-lg">Fluxo validado no servidor</CardTitle>
          <CardDescription>Ordem obrigatória de eventos para cada movimento.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4 text-sm">
            {(isDeposit
              ? [
                  "Pedido de depósito criado no backend com valor, carteira e método.",
                  "Netshop inicia a cobrança (USSD push ou checkout alojado).",
                  "Webhook assinado confirma o pagamento; a assinatura HMAC é verificada.",
                  "Ledger recebe a entrada com referência única (idempotente).",
                  "O saldo é atualizado no servidor — nunca pelo browser.",
                ]
              : [
                  "Pedido de levantamento validado no servidor (saldo suficiente).",
                  "Fundos reservados no ledger (hold) — saldo disponível reduzido.",
                  "Netshop executa o payout para a carteira móvel do titular.",
                  "Webhook confirma a execução e fecha a intenção.",
                  "Em falha, o valor reservado é reembolsado automaticamente.",
                ]
            ).map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
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
  const configured = status?.configured ?? false;
  const methodStatus: Partial<Record<NetshopMethod["id"], boolean>> = status?.methods ?? {};
  const activeCount = Object.values(methodStatus).filter(Boolean).length;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-12">
        <header className="max-w-3xl space-y-4">
          <Badge variant="outline" className="gap-1.5">
            <ShieldCheck className="size-3.5" />
            Netshop:{" "}
            {configured
              ? `${activeCount} wallet(s) ativa(s)${status?.gatewayOnline ? ", gateway online" : ", gateway sem resposta"}`
              : "A configurar"}
          </Badge>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Gateway de pagamentos Netshop
          </h1>
          <p className="text-muted-foreground">
            Depósitos e levantamentos em meticais (MZN) com M-Pesa, e-Mola, mKesh e cartão
            Visa/Mastercard. Sem taxas para o cliente — o saldo só muda após confirmação assinada
            pelo gateway ou reconciliação direta com a NetShop.
          </p>
        </header>

        <section className="mt-12">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Métodos de pagamento
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Métodos disponíveis para Moçambique, em meticais (MZN).
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {NETSHOP_METHODS.map((m) => (
              <MethodCard key={m.id} method={m} configured={Boolean(methodStatus[m.id])} />
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Depósitos e levantamentos
          </h2>
          <Tabs defaultValue="deposit" className="mt-6">
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

        <section className="mt-12">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Regras de segurança da integração
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              {
                title: "Credenciais só no servidor",
                text: "Wallet ID e API key nunca chegam ao browser; as chamadas partem de server functions.",
              },
              {
                title: "Webhook com assinatura verificada",
                text: "Confirmações são aceites apenas com HMAC-SHA256 válido e comparação em tempo constante.",
              },
              {
                title: "Idempotência por referência",
                text: "Cada movimento tem referência única; webhooks repetidos não duplicam saldo.",
              },
              {
                title: "Ledger imutável",
                text: "Nenhuma linha é editada nem apagada — correções entram como novos movimentos.",
              },
            ].map((item) => (
              <Card key={item.title} className="card-elevated">
                <CardHeader className="space-y-2">
                  <ShieldCheck className="size-5 text-primary" />
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <CardDescription>{item.text}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
